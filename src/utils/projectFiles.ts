import JSZip from "jszip";
import { migrateProject, StoryProject } from "../domain/project";

export const STORYLIFE_PROJECT_MIME_TYPE = "application/zip";
const STORYLIFE_FORMAT = "storylife-portable-project";
const STORYLIFE_PACKAGE_VERSION = 1;
const STORYLIFE_ASSET_PREFIX = "storylife-asset://";

interface StoryLifeArchiveAsset {
  path: string;
  mimeType: string;
  originalName: string;
}

interface StoryLifeArchiveManifest {
  format: typeof STORYLIFE_FORMAT;
  packageVersion: number;
  projectFile: string;
  assets: StoryLifeArchiveAsset[];
}

interface MediaBinding {
  source: string;
  nameHint: string;
  typeHint: "image" | "video" | "audio";
  setSource: (source: string) => void;
}

export function createStoryLifeProjectFileName(projectName: string): string {
  const baseName = projectName
    .trim()
    .replace(/(?:\.storylife)?\.json$/i, "")
    .replace(/\.storylife$/i, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .slice(0, 90)
    .trim();
  return `${baseName || "StoryLife Project"}.storylife`;
}

export async function createStoryLifeProjectArchive(
  sourceProject: StoryProject
): Promise<Blob> {
  const project = structuredClone(sourceProject);
  const zip = new JSZip();
  const assets: StoryLifeArchiveAsset[] = [];
  const archivedSourceMap = new Map<string, string>();

  for (const binding of getProjectMediaBindings(project)) {
    const source = binding.source.trim();
    if (!source) continue;
    const existingArchivePath = archivedSourceMap.get(source);
    if (existingArchivePath) {
      binding.setSource(`${STORYLIFE_ASSET_PREFIX}${existingArchivePath}`);
      continue;
    }

    const media = await readBrowserMedia(source, binding.typeHint);
    if (!media) {
      throw new Error(
        `Could not include ${binding.nameHint}. Re-select this media file and save again.`
      );
    }
    const extension = extensionForMimeType(media.mimeType, binding.typeHint);
    const archivePath = `assets/asset_${String(assets.length + 1).padStart(4, "0")}.${extension}`;
    zip.file(archivePath, media.bytes);
    assets.push({
      path: archivePath,
      mimeType: media.mimeType,
      originalName: `${sanitizeAssetName(binding.nameHint)}.${extension}`
    });
    archivedSourceMap.set(source, archivePath);
    binding.setSource(`${STORYLIFE_ASSET_PREFIX}${archivePath}`);
  }

  const manifest: StoryLifeArchiveManifest = {
    format: STORYLIFE_FORMAT,
    packageVersion: STORYLIFE_PACKAGE_VERSION,
    projectFile: "project.json",
    assets
  };
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file("project.json", `${JSON.stringify(project, null, 2)}\n`);
  return zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
    mimeType: STORYLIFE_PROJECT_MIME_TYPE
  });
}

export async function loadStoryLifeProjectFile(file: File): Promise<StoryProject> {
  const bytes = await file.arrayBuffer();
  if (isZipData(bytes)) {
    return loadStoryLifeProjectArchive(bytes);
  }
  return migrateProject(parseLegacyProjectText(await file.text()));
}

export async function loadStoryLifeProjectArchive(
  bytes: ArrayBuffer
): Promise<StoryProject> {
  const zip = await JSZip.loadAsync(bytes);
  const projectEntry = zip.file("project.json");
  if (!projectEntry) {
    throw new Error("StoryLife container is missing project.json.");
  }
  const manifestEntry = zip.file("manifest.json");
  const manifest = manifestEntry
    ? parseManifest(await manifestEntry.async("string"))
    : null;
  const mimeByPath = new Map(
    (manifest?.assets ?? []).map((asset) => [asset.path, asset.mimeType])
  );
  const project = migrateProject(JSON.parse(await projectEntry.async("string")));

  for (const binding of getProjectMediaBindings(project)) {
    if (!binding.source.startsWith(STORYLIFE_ASSET_PREFIX)) continue;
    const archivePath = binding.source.slice(STORYLIFE_ASSET_PREFIX.length);
    if (!isSafeArchiveAssetPath(archivePath)) {
      throw new Error(`Unsafe media path in StoryLife container: ${archivePath}`);
    }
    const assetEntry = zip.file(archivePath);
    if (!assetEntry) {
      throw new Error(`StoryLife container is missing media file ${archivePath}.`);
    }
    const base64 = await assetEntry.async("base64");
    const mimeType = mimeByPath.get(archivePath) ?? mimeTypeFromPath(archivePath);
    binding.setSource(`data:${mimeType};base64,${base64}`);
  }
  return project;
}

export function parseLegacyProjectText(contents: string): unknown {
  const raw = JSON.parse(contents) as unknown;
  if (
    isRecord(raw) &&
    raw.format === STORYLIFE_FORMAT &&
    isRecord(raw.project)
  ) {
    return raw.project;
  }
  return raw;
}

export async function saveStoryLifeProjectInBrowser(
  project: StoryProject,
  fileName: string
): Promise<"shared" | "downloaded" | "canceled"> {
  const archive = await createStoryLifeProjectArchive(project);
  const file = new File([archive], fileName, {
    type: STORYLIFE_PROJECT_MIME_TYPE
  });
  const shareData: ShareData = {
    files: [file],
    title: "StoryLife Project"
  };

  if (isAppleTouchDevice() && navigator.share && navigator.canShare?.(shareData)) {
    try {
      await navigator.share(shareData);
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return "canceled";
      }
    }
  }

  const url = URL.createObjectURL(archive);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "downloaded";
}

function getProjectMediaBindings(project: StoryProject): MediaBinding[] {
  const bindings: MediaBinding[] = [];
  for (const scene of project.scenes) {
    bindings.push({
      source: scene.imagePath,
      nameHint: `${scene.id}_image`,
      typeHint: scene.visualMediaType,
      setSource: (source) => { scene.imagePath = source; }
    });
    bindings.push({
      source: scene.soundPath,
      nameHint: `${scene.id}_sound`,
      typeHint: "audio",
      setSource: (source) => { scene.soundPath = source; }
    });
    for (const variant of scene.imageVariants) {
      bindings.push({
        source: variant.imagePath,
        nameHint: `${scene.id}_${variant.id}`,
        typeHint: "image",
        setSource: (source) => { variant.imagePath = source; }
      });
      if (!variant.animation) continue;
      bindings.push({
        source: variant.animation.sourceImagePath,
        nameHint: `${scene.id}_${variant.id}_source`,
        typeHint: "image",
        setSource: (source) => { variant.animation!.sourceImagePath = source; }
      });
      if (variant.animation.type === "aiFrames") {
        variant.animation.frames.forEach((frame, frameIndex) => {
          if (frame.source === "original") return;
          bindings.push({
            source: frame.imagePath,
            nameHint: `${scene.id}_${variant.id}_frame_${frameIndex + 1}`,
            typeHint: "image",
            setSource: (source) => { frame.imagePath = source; }
          });
        });
      }
    }
  }
  bindings.push({
    source: project.audio.backgroundMusicPath,
    nameHint: "background_music",
    typeHint: "audio",
    setSource: (source) => { project.audio.backgroundMusicPath = source; }
  });
  for (const reference of project.characterReferences) {
    bindings.push({
      source: reference.imagePath,
      nameHint: `${reference.id}_reference`,
      typeHint: "image",
      setSource: (source) => { reference.imagePath = source; }
    });
  }
  for (const folder of project.mediaLibrary.folders) {
    for (const asset of folder.assets) {
      bindings.push({
        source: asset.path,
        nameHint: asset.name || asset.id,
        typeHint: asset.type,
        setSource: (source) => { asset.path = source; }
      });
    }
  }
  return bindings;
}

async function readBrowserMedia(
  source: string,
  typeHint: "image" | "video" | "audio"
): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
  const dataFile = parseDataUrl(source);
  if (dataFile) return dataFile;
  if (!/^(blob:|https?:)/i.test(source)) return null;
  try {
    const response = await fetch(source);
    if (!response.ok) return null;
    const mimeType = response.headers.get("content-type")?.split(";")[0] ||
      mimeTypeFromPath(source, typeHint);
    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      mimeType
    };
  } catch {
    return null;
  }
}

function parseDataUrl(dataUrl: string): { bytes: Uint8Array; mimeType: string } | null {
  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,([\s\S]*)$/);
  if (!match) return null;
  const mimeType = match[1] || "application/octet-stream";
  if (match[2]) {
    const binary = atob(match[3]);
    return {
      mimeType,
      bytes: Uint8Array.from(binary, (character) => character.charCodeAt(0))
    };
  }
  return {
    mimeType,
    bytes: new TextEncoder().encode(decodeURIComponent(match[3]))
  };
}

function isZipData(bytes: ArrayBuffer): boolean {
  const signature = new Uint8Array(bytes, 0, Math.min(4, bytes.byteLength));
  return signature.length >= 4 && signature[0] === 0x50 && signature[1] === 0x4b;
}

function parseManifest(contents: string): StoryLifeArchiveManifest | null {
  try {
    const raw = JSON.parse(contents) as unknown;
    if (!isRecord(raw) || raw.format !== STORYLIFE_FORMAT || !Array.isArray(raw.assets)) {
      return null;
    }
    return {
      format: STORYLIFE_FORMAT,
      packageVersion: Number(raw.packageVersion) || 1,
      projectFile: typeof raw.projectFile === "string" ? raw.projectFile : "project.json",
      assets: raw.assets.filter(isRecord).map((asset) => ({
        path: typeof asset.path === "string" ? asset.path : "",
        mimeType: typeof asset.mimeType === "string"
          ? asset.mimeType
          : "application/octet-stream",
        originalName: typeof asset.originalName === "string" ? asset.originalName : "media"
      })).filter((asset) => isSafeArchiveAssetPath(asset.path))
    };
  } catch {
    return null;
  }
}

function isSafeArchiveAssetPath(path: string): boolean {
  return path.startsWith("assets/") && !path.includes("..") && !path.includes("\\");
}

function extensionForMimeType(
  mimeType: string,
  typeHint: "image" | "video" | "audio"
): string {
  const normalized = mimeType.toLowerCase();
  const extensionMap: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/ogg": "ogg",
    "audio/mp4": "m4a",
    "audio/webm": "webm"
  };
  return extensionMap[normalized] ?? (typeHint === "image" ? "png" : typeHint === "video" ? "mp4" : "bin");
}

function mimeTypeFromPath(
  path: string,
  typeHint: "image" | "video" | "audio" = "image"
): string {
  const cleanPath = path.split(/[?#]/)[0].toLowerCase();
  const extension = cleanPath.includes(".") ? cleanPath.split(".").pop() ?? "" : "";
  const mimeMap: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    mp4: "video/mp4",
    mov: "video/quicktime",
    m4v: "video/mp4",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    m4a: "audio/mp4",
    webm: typeHint === "audio" ? "audio/webm" : "video/webm"
  };
  return mimeMap[extension] ?? (typeHint === "audio"
    ? "application/octet-stream"
    : typeHint === "video" ? "video/mp4" : "image/png");
}

function sanitizeAssetName(value: string): string {
  return value.replace(/[^a-z0-9_-]+/gi, "_").replace(/^_+|_+$/g, "") || "media";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAppleTouchDevice(): boolean {
  return (
    /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  );
}

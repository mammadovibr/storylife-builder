import JSZip from "jszip";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const STORYLIFE_FORMAT = "storylife-portable-project";
const STORYLIFE_PACKAGE_VERSION = 1;
const STORYLIFE_ASSET_PREFIX = "storylife-asset://";

interface ArchiveAsset {
  path: string;
  mimeType: string;
  originalName: string;
}

interface MediaBinding {
  source: string;
  nameHint: string;
  typeHint: "image" | "video" | "audio";
  setSource: (source: string) => void;
}

interface ProjectLike {
  scenes?: Array<{
    id?: string;
    imagePath?: string;
    visualMediaType?: "image" | "video";
    soundPath?: string;
    imageVariants?: Array<{
      id?: string;
      imagePath?: string;
      animation?: {
        sourceImagePath?: string;
        frames?: Array<{ source?: string; imagePath?: string }>;
      };
    }>;
  }>;
  audio?: { backgroundMusicPath?: string };
  characterReferences?: Array<{ id?: string; imagePath?: string }>;
  mediaLibrary?: {
    folders?: Array<{
      assets?: Array<{ id?: string; name?: string; path?: string; type?: string }>;
    }>;
  };
}

export function isStoryLifeArchive(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}

export async function createStoryLifeArchive(projectJson: string): Promise<Buffer> {
  const project = unwrapLegacyContainer(JSON.parse(projectJson) as unknown) as ProjectLike;
  const zip = new JSZip();
  const assets: ArchiveAsset[] = [];
  const archivedSourceMap = new Map<string, string>();

  for (const binding of getMediaBindings(project)) {
    const source = binding.source.trim();
    if (!source) continue;
    const existingArchivePath = archivedSourceMap.get(source);
    if (existingArchivePath) {
      binding.setSource(`${STORYLIFE_ASSET_PREFIX}${existingArchivePath}`);
      continue;
    }

    const media = await readDesktopMedia(source, binding.typeHint);
    const extension = extensionForMimeType(media.mimeType, binding.typeHint);
    const archivePath = `assets/asset_${String(assets.length + 1).padStart(4, "0")}.${extension}`;
    zip.file(archivePath, media.buffer);
    assets.push({
      path: archivePath,
      mimeType: media.mimeType,
      originalName: `${sanitizeAssetName(binding.nameHint)}.${extension}`
    });
    archivedSourceMap.set(source, archivePath);
    binding.setSource(`${STORYLIFE_ASSET_PREFIX}${archivePath}`);
  }

  zip.file("manifest.json", JSON.stringify({
    format: STORYLIFE_FORMAT,
    packageVersion: STORYLIFE_PACKAGE_VERSION,
    projectFile: "project.json",
    assets
  }, null, 2));
  zip.file("project.json", `${JSON.stringify(project, null, 2)}\n`);
  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 }
  });
}

export async function readStoryLifeArchive(
  buffer: Buffer,
  extractionDirectory?: string
): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const projectEntry = zip.file("project.json");
  if (!projectEntry) {
    throw new Error("StoryLife container is missing project.json.");
  }
  const manifestEntry = zip.file("manifest.json");
  const mimeByPath = new Map<string, string>();
  if (manifestEntry) {
    const manifest = JSON.parse(await manifestEntry.async("string")) as unknown;
    if (isRecord(manifest) && Array.isArray(manifest.assets)) {
      for (const asset of manifest.assets) {
        if (isRecord(asset) && typeof asset.path === "string") {
          mimeByPath.set(
            asset.path,
            typeof asset.mimeType === "string" ? asset.mimeType : mimeTypeFromPath(asset.path)
          );
        }
      }
    }
  }

  const project = JSON.parse(await projectEntry.async("string")) as ProjectLike;
  const extractedSourceByPath = new Map<string, string>();
  for (const binding of getMediaBindings(project)) {
    if (!binding.source.startsWith(STORYLIFE_ASSET_PREFIX)) continue;
    const archivePath = binding.source.slice(STORYLIFE_ASSET_PREFIX.length);
    if (!isSafeArchiveAssetPath(archivePath)) {
      throw new Error(`Unsafe media path in StoryLife container: ${archivePath}`);
    }
    const assetEntry = zip.file(archivePath);
    if (!assetEntry) {
      throw new Error(`StoryLife container is missing media file ${archivePath}.`);
    }
    const existingExtractedSource = extractedSourceByPath.get(archivePath);
    if (existingExtractedSource) {
      binding.setSource(existingExtractedSource);
      continue;
    }
    const mediaBuffer = await assetEntry.async("nodebuffer");
    const mimeType = mimeByPath.get(archivePath) ?? mimeTypeFromPath(archivePath);
    const restoredSource = extractionDirectory
      ? await extractArchiveMedia(
          extractionDirectory,
          archivePath,
          mediaBuffer
        )
      : `data:${mimeType};base64,${mediaBuffer.toString("base64")}`;
    extractedSourceByPath.set(archivePath, restoredSource);
    binding.setSource(restoredSource);
  }
  return `${JSON.stringify(project, null, 2)}\n`;
}

async function extractArchiveMedia(
  extractionDirectory: string,
  archivePath: string,
  mediaBuffer: Buffer
): Promise<string> {
  const destinationPath = join(extractionDirectory, ...archivePath.split("/"));
  await mkdir(dirname(destinationPath), { recursive: true });
  await writeFile(destinationPath, mediaBuffer);
  return destinationPath;
}

function getMediaBindings(project: ProjectLike): MediaBinding[] {
  const bindings: MediaBinding[] = [];
  for (const scene of project.scenes ?? []) {
    bindings.push({
      source: typeof scene.imagePath === "string" ? scene.imagePath : "",
      nameHint: `${scene.id || "scene"}_image`,
      typeHint: scene.visualMediaType === "video" ? "video" : "image",
      setSource: (source) => { scene.imagePath = source; }
    });
    bindings.push({
      source: typeof scene.soundPath === "string" ? scene.soundPath : "",
      nameHint: `${scene.id || "scene"}_sound`,
      typeHint: "audio",
      setSource: (source) => { scene.soundPath = source; }
    });
    for (const variant of scene.imageVariants ?? []) {
      bindings.push({
        source: typeof variant.imagePath === "string" ? variant.imagePath : "",
        nameHint: `${scene.id || "scene"}_${variant.id || "variant"}`,
        typeHint: "image",
        setSource: (source) => { variant.imagePath = source; }
      });
      if (variant.animation) {
        bindings.push({
          source: typeof variant.animation.sourceImagePath === "string"
            ? variant.animation.sourceImagePath
            : "",
          nameHint: `${scene.id || "scene"}_${variant.id || "variant"}_source`,
          typeHint: "image",
          setSource: (source) => { variant.animation!.sourceImagePath = source; }
        });
        for (const [frameIndex, frame] of (variant.animation.frames ?? []).entries()) {
          if (frame.source === "original") continue;
          bindings.push({
            source: typeof frame.imagePath === "string" ? frame.imagePath : "",
            nameHint: `${scene.id || "scene"}_${variant.id || "variant"}_frame_${frameIndex + 1}`,
            typeHint: "image",
            setSource: (source) => { frame.imagePath = source; }
          });
        }
      }
    }
  }
  if (project.audio) {
    bindings.push({
      source: typeof project.audio.backgroundMusicPath === "string"
        ? project.audio.backgroundMusicPath
        : "",
      nameHint: "background_music",
      typeHint: "audio",
      setSource: (source) => { project.audio!.backgroundMusicPath = source; }
    });
  }
  for (const reference of project.characterReferences ?? []) {
    bindings.push({
      source: typeof reference.imagePath === "string" ? reference.imagePath : "",
      nameHint: `${reference.id || "character"}_reference`,
      typeHint: "image",
      setSource: (source) => { reference.imagePath = source; }
    });
  }
  for (const folder of project.mediaLibrary?.folders ?? []) {
    for (const asset of folder.assets ?? []) {
      bindings.push({
        source: typeof asset.path === "string" ? asset.path : "",
        nameHint: asset.name || asset.id || "media",
        typeHint: asset.type === "audio" ? "audio" : asset.type === "video" ? "video" : "image",
        setSource: (source) => { asset.path = source; }
      });
    }
  }
  return bindings;
}

async function readDesktopMedia(
  source: string,
  typeHint: "image" | "video" | "audio"
): Promise<{ buffer: Buffer; mimeType: string }> {
  const dataFile = parseDataUrl(source);
  if (dataFile) return dataFile;

  if (/^https?:/i.test(source)) {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Could not download project media: ${source}`);
    }
    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      mimeType: response.headers.get("content-type")?.split(";")[0] ||
        mimeTypeFromPath(source, typeHint)
    };
  }

  const filePath = source.startsWith("file://") ? fileURLToPath(source) : source;
  try {
    return {
      buffer: await readFile(filePath),
      mimeType: mimeTypeFromPath(filePath, typeHint)
    };
  } catch {
    throw new Error(`Could not include media file in the portable project: ${filePath}`);
  }
}

function parseDataUrl(dataUrl: string): { buffer: Buffer; mimeType: string } | null {
  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,([\s\S]*)$/);
  if (!match) return null;
  const mimeType = match[1] || "application/octet-stream";
  const buffer = match[2]
    ? Buffer.from(match[3], "base64")
    : Buffer.from(decodeURIComponent(match[3]), "utf8");
  return { buffer, mimeType };
}

function unwrapLegacyContainer(raw: unknown): unknown {
  return isRecord(raw) && raw.format === STORYLIFE_FORMAT && isRecord(raw.project)
    ? raw.project
    : raw;
}

function isSafeArchiveAssetPath(path: string): boolean {
  return path.startsWith("assets/") && !path.includes("..") && !path.includes("\\");
}

function extensionForMimeType(
  mimeType: string,
  typeHint: "image" | "video" | "audio"
): string {
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
  return extensionMap[mimeType.toLowerCase()] ?? (typeHint === "image" ? "png" : typeHint === "video" ? "mp4" : "bin");
}

function mimeTypeFromPath(
  path: string,
  typeHint: "image" | "video" | "audio" = "image"
): string {
  const extension = extname(path.split(/[?#]/)[0]).toLowerCase();
  const mimeMap: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".m4v": "video/mp4",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".m4a": "audio/mp4",
    ".webm": typeHint === "audio" ? "audio/webm" : "video/webm"
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

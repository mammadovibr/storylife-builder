export async function savePicture(
  imagePath: string,
  suggestedBaseName: string
): Promise<"saved" | "canceled"> {
  const source = imagePath.trim();
  if (!source) {
    throw new Error("There is no picture to save.");
  }

  const suggestedName = createPictureFileName(source, suggestedBaseName);
  if (window.storyLife?.savePicture) {
    const result = await window.storyLife.savePicture(source, suggestedName);
    return result.canceled ? "canceled" : "saved";
  }

  const response = await fetch(source);
  if (!response.ok) {
    throw new Error("Could not read this picture for saving.");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = suggestedName;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "saved";
}

function createPictureFileName(source: string, baseName: string): string {
  const sanitizedBaseName = baseName
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .slice(0, 80)
    .trim() || "scene-picture";
  const extension = readPictureExtension(source);
  return `${sanitizedBaseName}${extension}`;
}

function readPictureExtension(source: string): string {
  const dataMimeType = source.match(/^data:(image\/[a-z0-9.+-]+)[;,]/i)?.[1].toLowerCase();
  if (dataMimeType === "image/jpeg") return ".jpg";
  if (dataMimeType === "image/webp") return ".webp";
  if (dataMimeType === "image/gif") return ".gif";

  const cleanSource = source.split(/[?#]/)[0];
  const extension = cleanSource.match(/\.(png|jpe?g|webp|gif)$/i)?.[0].toLowerCase();
  return extension === ".jpeg" ? ".jpg" : extension || ".png";
}

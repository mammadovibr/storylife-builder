export function applyColorOpacity(color: string, opacity: number): string {
  const normalized = color.trim();
  const alpha = Math.max(0, Math.min(1, opacity));

  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
    return hexToRgba(normalized, alpha);
  }

  if (!/^(?:linear|radial|conic)-gradient\(/i.test(normalized)) {
    return normalized;
  }

  return normalized
    .replace(
      /rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(\d*\.?\d+))?\s*\)/gi,
      (_match, red: string, green: string, blue: string, existingAlpha?: string) => {
        const combinedAlpha = existingAlpha === undefined
          ? alpha
          : Math.max(0, Math.min(1, Number(existingAlpha))) * alpha;
        return `rgba(${red}, ${green}, ${blue}, ${combinedAlpha})`;
      }
    )
    .replace(/#[0-9a-fA-F]{6}\b/g, (hex) => hexToRgba(hex, alpha));
}

function hexToRgba(hex: string, alpha: number): string {
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

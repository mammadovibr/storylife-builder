const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

function generatePwaIcons(outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  for (const size of [180, 192, 512]) {
    fs.writeFileSync(
      path.join(outputDir, `storylife-${size}.png`),
      createIconPng(size)
    );
  }
}

function createIconPng(size) {
  const pixels = Buffer.alloc(size * size * 4);
  fill(pixels, size, [244, 238, 228, 255]);

  const inset = Math.round(size * 0.09);
  const radius = Math.round(size * 0.19);
  roundedRect(pixels, size, inset, inset, size - inset * 2, size - inset * 2, radius, [39, 91, 82, 255]);

  const lineColor = [246, 219, 169, 255];
  const nodeColor = [255, 250, 241, 255];
  const lineWidth = Math.max(4, Math.round(size * 0.035));
  const leftX = Math.round(size * 0.31);
  const rightX = Math.round(size * 0.69);
  const topY = Math.round(size * 0.32);
  const middleY = Math.round(size * 0.51);
  const bottomY = Math.round(size * 0.70);

  line(pixels, size, leftX, topY, leftX, middleY, lineWidth, lineColor);
  line(pixels, size, leftX, middleY, rightX, middleY, lineWidth, lineColor);
  line(pixels, size, rightX, middleY, rightX, bottomY, lineWidth, lineColor);
  circle(pixels, size, leftX, topY, Math.round(size * 0.085), nodeColor);
  circle(pixels, size, leftX, middleY, Math.round(size * 0.085), lineColor);
  circle(pixels, size, rightX, middleY, Math.round(size * 0.085), nodeColor);
  circle(pixels, size, rightX, bottomY, Math.round(size * 0.085), nodeColor);

  return encodePng(pixels, size, size);
}

function fill(pixels, size, color) {
  for (let index = 0; index < size * size; index += 1) {
    pixels.set(color, index * 4);
  }
}

function roundedRect(pixels, size, x, y, width, height, radius, color) {
  for (let py = y; py < y + height; py += 1) {
    for (let px = x; px < x + width; px += 1) {
      const dx = Math.max(x + radius - px, 0, px - (x + width - radius - 1));
      const dy = Math.max(y + radius - py, 0, py - (y + height - radius - 1));
      if (dx * dx + dy * dy <= radius * radius) setPixel(pixels, size, px, py, color);
    }
  }
}

function line(pixels, size, x1, y1, x2, y2, width, color) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
  for (let step = 0; step <= steps; step += 1) {
    const progress = steps === 0 ? 0 : step / steps;
    circle(
      pixels,
      size,
      Math.round(x1 + (x2 - x1) * progress),
      Math.round(y1 + (y2 - y1) * progress),
      Math.ceil(width / 2),
      color
    );
  }
}

function circle(pixels, size, centerX, centerY, radius, color) {
  for (let y = centerY - radius; y <= centerY + radius; y += 1) {
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      if ((x - centerX) ** 2 + (y - centerY) ** 2 <= radius ** 2) {
        setPixel(pixels, size, x, y, color);
      }
    }
  }
}

function setPixel(pixels, size, x, y, color) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  pixels.set(color, (y * size + x) * 4);
}

function encodePng(pixels, width, height) {
  const scanlines = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    scanlines[rowStart] = 0;
    pixels.copy(scanlines, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(scanlines, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

module.exports = { generatePwaIcons };

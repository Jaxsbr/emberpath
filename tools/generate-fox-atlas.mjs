/**
 * Generates the fox character texture atlas (fox.png + fox.json).
 * Uses Node.js built-in zlib — no external dependencies.
 *
 * Usage: node tools/generate-fox-atlas.mjs
 * Output: assets/characters/fox.png, assets/characters/fox.json
 */

import { writeFileSync } from 'fs';
import { deflateSync } from 'zlib';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'assets', 'characters');

// --- Color palette (paper-puppet warm tones) ---
const ORANGE = [210, 130, 50, 255];       // main body
const RUSSET = [165, 85, 35, 255];         // darker accents
const CREAM = [240, 215, 175, 255];        // belly, snout
const BROWN = [120, 70, 30, 255];          // ear tips, paw pads
const TAIL_TIP = [235, 195, 120, 255];     // lighter tail end
const BLACK = [30, 25, 20, 255];           // eyes and nose

// --- Part definitions: name, width, height, color, shape ---
const parts = [
  { name: 'body',                   w: 48, h: 36, color: ORANGE, shape: 'ellipse' },
  { name: 'head',                   w: 32, h: 30, color: ORANGE, shape: 'ellipse' },
  { name: 'snout',                  w: 14, h: 10, color: CREAM,  shape: 'ellipse' },
  { name: 'left-ear',               w: 12, h: 18, color: ORANGE, shape: 'triangle', tipColor: BROWN },
  { name: 'right-ear',              w: 12, h: 18, color: ORANGE, shape: 'triangle', tipColor: BROWN },
  { name: 'tail-1',                 w: 22, h: 16, color: RUSSET, shape: 'ellipse' },
  { name: 'tail-2',                 w: 18, h: 14, color: ORANGE, shape: 'ellipse' },
  { name: 'tail-3',                 w: 16, h: 14, color: TAIL_TIP, shape: 'ellipse' },
  { name: 'front-left-upper-leg',   w: 10, h: 16, color: ORANGE, shape: 'rect' },
  { name: 'front-left-lower-leg',   w: 8,  h: 14, color: RUSSET, shape: 'rect' },
  { name: 'front-right-upper-leg',  w: 10, h: 16, color: ORANGE, shape: 'rect' },
  { name: 'front-right-lower-leg',  w: 8,  h: 14, color: RUSSET, shape: 'rect' },
  { name: 'back-left-upper-leg',    w: 12, h: 16, color: ORANGE, shape: 'rect' },
  { name: 'back-left-lower-leg',    w: 10, h: 14, color: RUSSET, shape: 'rect' },
  { name: 'back-right-upper-leg',   w: 12, h: 16, color: ORANGE, shape: 'rect' },
  { name: 'back-right-lower-leg',   w: 10, h: 14, color: RUSSET, shape: 'rect' },
  { name: 'left-eye',               w: 4,  h: 4,  color: BLACK,  shape: 'ellipse' },
  { name: 'right-eye',              w: 4,  h: 4,  color: BLACK,  shape: 'ellipse' },
  { name: 'nose',                   w: 3,  h: 3,  color: BLACK,  shape: 'ellipse' },
  // Ankles (4)
  { name: 'front-left-ankle',       w: 6,  h: 6,  color: BROWN,  shape: 'ellipse' },
  { name: 'front-right-ankle',      w: 6,  h: 6,  color: BROWN,  shape: 'ellipse' },
  { name: 'back-left-ankle',        w: 6,  h: 6,  color: BROWN,  shape: 'ellipse' },
  { name: 'back-right-ankle',       w: 6,  h: 6,  color: BROWN,  shape: 'ellipse' },
  // Paws (4)
  { name: 'front-left-paw',         w: 8,  h: 8,  color: RUSSET, shape: 'ellipse' },
  { name: 'front-right-paw',        w: 8,  h: 8,  color: RUSSET, shape: 'ellipse' },
  { name: 'back-left-paw',          w: 8,  h: 8,  color: RUSSET, shape: 'ellipse' },
  { name: 'back-right-paw',         w: 8,  h: 8,  color: RUSSET, shape: 'ellipse' },
  // Toes — front-left (4)
  { name: 'front-left-toe-1',       w: 3,  h: 3,  color: BROWN,  shape: 'ellipse' },
  { name: 'front-left-toe-2',       w: 3,  h: 3,  color: BROWN,  shape: 'ellipse' },
  { name: 'front-left-toe-3',       w: 3,  h: 3,  color: BROWN,  shape: 'ellipse' },
  { name: 'front-left-toe-4',       w: 3,  h: 3,  color: BROWN,  shape: 'ellipse' },
  // Toes — front-right (4)
  { name: 'front-right-toe-1',      w: 3,  h: 3,  color: BROWN,  shape: 'ellipse' },
  { name: 'front-right-toe-2',      w: 3,  h: 3,  color: BROWN,  shape: 'ellipse' },
  { name: 'front-right-toe-3',      w: 3,  h: 3,  color: BROWN,  shape: 'ellipse' },
  { name: 'front-right-toe-4',      w: 3,  h: 3,  color: BROWN,  shape: 'ellipse' },
  // Toes — back-left (4)
  { name: 'back-left-toe-1',        w: 3,  h: 3,  color: BROWN,  shape: 'ellipse' },
  { name: 'back-left-toe-2',        w: 3,  h: 3,  color: BROWN,  shape: 'ellipse' },
  { name: 'back-left-toe-3',        w: 3,  h: 3,  color: BROWN,  shape: 'ellipse' },
  { name: 'back-left-toe-4',        w: 3,  h: 3,  color: BROWN,  shape: 'ellipse' },
  // Toes — back-right (4)
  { name: 'back-right-toe-1',       w: 3,  h: 3,  color: BROWN,  shape: 'ellipse' },
  { name: 'back-right-toe-2',       w: 3,  h: 3,  color: BROWN,  shape: 'ellipse' },
  { name: 'back-right-toe-3',       w: 3,  h: 3,  color: BROWN,  shape: 'ellipse' },
  { name: 'back-right-toe-4',       w: 3,  h: 3,  color: BROWN,  shape: 'ellipse' },
];

// --- Atlas packing (simple row-based) ---
const PAD = 2;
let atlasW = 0;
let atlasH = 0;
const frames = {};

// Lay out in rows, max width ~256
let rowX = PAD;
let rowY = PAD;
let rowMaxH = 0;
const MAX_ROW_W = 256;

for (const part of parts) {
  if (rowX + part.w + PAD > MAX_ROW_W) {
    rowX = PAD;
    rowY += rowMaxH + PAD;
    rowMaxH = 0;
  }
  part.x = rowX;
  part.y = rowY;
  rowX += part.w + PAD;
  rowMaxH = Math.max(rowMaxH, part.h);
  atlasW = Math.max(atlasW, part.x + part.w + PAD);
}
atlasH = rowY + rowMaxH + PAD;

// Round up to power of 2 for GPU friendliness
atlasW = nextPow2(atlasW);
atlasH = nextPow2(atlasH);

function nextPow2(v) {
  let p = 1;
  while (p < v) p *= 2;
  return p;
}

// --- Pixel drawing ---
const pixels = new Uint8Array(atlasW * atlasH * 4); // RGBA, initialized to 0 (transparent)

function setPixel(x, y, r, g, b, a) {
  if (x < 0 || x >= atlasW || y < 0 || y >= atlasH) return;
  const idx = (y * atlasW + x) * 4;
  pixels[idx] = r;
  pixels[idx + 1] = g;
  pixels[idx + 2] = b;
  pixels[idx + 3] = a;
}

function drawEllipse(cx, cy, rx, ry, color) {
  const [r, g, b, a] = color;
  for (let dy = -ry; dy <= ry; dy++) {
    for (let dx = -rx; dx <= rx; dx++) {
      const nx = dx / rx;
      const ny = dy / ry;
      const dist = nx * nx + ny * ny;
      if (dist <= 1.0) {
        // Soft edge: anti-alias at the boundary
        const edgeDist = 1.0 - dist;
        const alpha = edgeDist < 0.15 ? Math.round(a * (edgeDist / 0.15)) : a;
        setPixel(cx + dx, cy + dy, r, g, b, alpha);
      }
    }
  }
}

function drawRect(x, y, w, h, color) {
  const [r, g, b, a] = color;
  // Rounded corners (radius 2)
  const cr = 2;
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      // Check if inside rounded rect
      let inside = true;
      // Top-left corner
      if (dx < cr && dy < cr) {
        inside = ((cr - dx) ** 2 + (cr - dy) ** 2) <= cr * cr;
      }
      // Top-right corner
      if (dx >= w - cr && dy < cr) {
        inside = ((dx - (w - cr - 1)) ** 2 + (cr - dy) ** 2) <= cr * cr;
      }
      // Bottom-left corner
      if (dx < cr && dy >= h - cr) {
        inside = ((cr - dx) ** 2 + (dy - (h - cr - 1)) ** 2) <= cr * cr;
      }
      // Bottom-right corner
      if (dx >= w - cr && dy >= h - cr) {
        inside = ((dx - (w - cr - 1)) ** 2 + (dy - (h - cr - 1)) ** 2) <= cr * cr;
      }
      if (inside) {
        setPixel(x + dx, y + dy, r, g, b, a);
      }
    }
  }
}

function drawTriangle(x, y, w, h, color, tipColor) {
  // Pointed ear shape — wider at bottom, pointed at top
  const [r, g, b, a] = color;
  const tipH = Math.floor(h * 0.3); // top 30% gets tipColor
  for (let dy = 0; dy < h; dy++) {
    const progress = dy / h; // 0 at top, 1 at bottom
    const halfW = (w / 2) * progress;
    const cx = Math.floor(w / 2);
    for (let dx = 0; dx < w; dx++) {
      if (Math.abs(dx - cx) <= halfW + 0.5) {
        const useColor = dy < tipH ? (tipColor || color) : color;
        setPixel(x + dx, y + dy, useColor[0], useColor[1], useColor[2], useColor[3]);
      }
    }
  }
}

// Draw each part
for (const part of parts) {
  if (part.shape === 'ellipse') {
    const cx = part.x + Math.floor(part.w / 2);
    const cy = part.y + Math.floor(part.h / 2);
    drawEllipse(cx, cy, Math.floor(part.w / 2), Math.floor(part.h / 2), part.color);
  } else if (part.shape === 'rect') {
    drawRect(part.x, part.y, part.w, part.h, part.color);
  } else if (part.shape === 'triangle') {
    drawTriangle(part.x, part.y, part.w, part.h, part.color, part.tipColor);
  }

  // Build JSON frame entry
  frames[part.name] = {
    frame: { x: part.x, y: part.y, w: part.w, h: part.h },
    rotated: false,
    trimmed: false,
    spriteSourceSize: { x: 0, y: 0, w: part.w, h: part.h },
    sourceSize: { w: part.w, h: part.h },
  };
}

// --- PNG encoding ---
function createPNG(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const ihdrChunk = pngChunk('IHDR', ihdr);

  // IDAT — filter byte (0 = None) before each row, then deflate
  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 4)] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = y * (1 + width * 4) + 1 + x * 4;
      rawData[dstIdx] = rgba[srcIdx];
      rawData[dstIdx + 1] = rgba[srcIdx + 1];
      rawData[dstIdx + 2] = rgba[srcIdx + 2];
      rawData[dstIdx + 3] = rgba[srcIdx + 3];
    }
  }
  const compressed = deflateSync(rawData);
  const idatChunk = pngChunk('IDAT', compressed);

  // IEND
  const iendChunk = pngChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);

  const crcData = Buffer.concat([typeBytes, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData), 0);

  return Buffer.concat([len, typeBytes, data, crc]);
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  CRC_TABLE[n] = c;
}

// --- Write output files ---
const pngBuffer = createPNG(atlasW, atlasH, pixels);
writeFileSync(join(OUT_DIR, 'fox.png'), pngBuffer);

const atlasJSON = {
  frames,
  meta: {
    app: 'emberpath-atlas-gen',
    version: '1.0',
    image: 'fox.png',
    format: 'RGBA8888',
    size: { w: atlasW, h: atlasH },
    scale: '1',
  },
};
writeFileSync(join(OUT_DIR, 'fox.json'), JSON.stringify(atlasJSON, null, 2));

console.log(`Generated atlas: ${atlasW}x${atlasH}, ${parts.length} parts`);
console.log(`  → ${join(OUT_DIR, 'fox.png')}`);
console.log(`  → ${join(OUT_DIR, 'fox.json')}`);

#!/usr/bin/env node
/*
 * #214 P2 — lossless sprite-sheet packer.
 *
 * The game ships every animation frame as its own PNG: 96 fox-pip + 7×72 NPC =
 * 607 individual files, each its own HTTP request. On a real connection that
 * request pile-up — not the bytes — is what makes the world take seconds to load.
 *
 * This script packs each character's frames into ONE uniform-grid sheet (607
 * files → 8), writing:
 *   - assets/sheets/<sheetId>.png         the packed grid
 *   - src/data/sprite-sheets.json         frameWidth/height, columns, and a
 *                                         logical-key → frame-index map
 * The loader (GameScene) reads the manifest and loads each sheet once via
 * load.spritesheet, referencing frames by index. Same pixels, same animations.
 *
 * LOSSLESS IS A HARD REQUIREMENT (Jaco's boundary: don't change the art). Every
 * packed cell is cropped back out and PSNR-compared to its source frame; the run
 * ABORTS unless every comparison is infinite (pixel-identical). Columns=12 divides
 * both 96 and 72 exactly, so grids are full — no padding cells.
 *
 * Deterministic and idempotent: same inputs → byte-identical sheet + manifest.
 * Re-run any time the source frames change.
 */
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');
const OUT_DIR = path.join(ASSETS, 'sheets');
const MANIFEST = path.join(ROOT, 'src', 'data', 'sprite-sheets.json');
const COLUMNS = 12;

const DIRECTIONS = [
  'north', 'north-east', 'east', 'south-east',
  'south', 'south-west', 'west', 'north-west',
];

// Mirror of the in-game registries. Kept here (not imported) so the packer is a
// plain CJS tool with no build step; the counts are asserted against disk below.
const PIP = { anims: { idle: 4, walk: 8 }, static: false, dir: 'characters/fox-pip' };
const NPC_IDS = ['marsh-hermit', 'old-man', 'heron', 'wren', 'driftwood', 'quill', 'golden-stag'];
const NPC = { anims: { idle: 4, walk: 4 }, static: true };

// The canonical frame order for a character — the single source of truth the
// sheet layout AND the manifest indices both derive from. Row-major in the grid.
function frameOrder(spec, baseDir) {
  const frames = [];
  for (const anim of ['idle', 'walk']) {
    const n = spec.anims[anim];
    for (const dir of DIRECTIONS) {
      for (let i = 0; i < n; i++) {
        frames.push({ key: `${anim}-${dir}-${i}`, src: path.join(ASSETS, baseDir, anim, dir, `frame_00${i}.png`) });
      }
    }
  }
  if (spec.static) {
    for (const dir of DIRECTIONS) {
      frames.push({ key: `static-${dir}`, src: path.join(ASSETS, baseDir, 'static', `${dir}.png`) });
    }
  }
  return frames;
}

function probeSize(file) {
  const out = execFileSync('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file,
  ]).toString().trim();
  const [w, h] = out.split(',').map(Number);
  return { w, h };
}

function psnrAverage(a, b) {
  // ffmpeg prints e.g. "... average:inf ..." to stderr; inf == pixel-identical.
  const res = spawnSync('ffmpeg', ['-i', a, '-i', b, '-lavfi', 'psnr', '-f', 'null', '-'],
    { encoding: 'utf8' }).stderr;
  const m = res.match(/average:([\d.]+|inf)/);
  return m ? m[1] : 'MISSING';
}

function packCharacter(sheetId, spec, baseDir) {
  const frames = frameOrder(spec, baseDir);
  const count = frames.length;
  if (count % COLUMNS !== 0) throw new Error(`${sheetId}: ${count} frames not divisible by ${COLUMNS}`);
  const rows = count / COLUMNS;

  // Uniform dimensions within a character (asserted) — required for a clean grid.
  let fw = null, fh = null;
  for (const f of frames) {
    if (!fs.existsSync(f.src)) throw new Error(`${sheetId}: missing frame ${f.src}`);
    const { w, h } = probeSize(f.src);
    if (fw === null) { fw = w; fh = h; }
    else if (w !== fw || h !== fh) throw new Error(`${sheetId}: non-uniform frame ${f.src} (${w}x${h} != ${fw}x${fh})`);
  }

  // Stage frames as a zero-padded sequence so ffmpeg's image2 demuxer reads them
  // in our exact canonical order, then tile into one grid.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `pack-${sheetId}-`));
  frames.forEach((f, i) => fs.copyFileSync(f.src, path.join(tmp, `${String(i).padStart(4, '0')}.png`)));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPng = path.join(OUT_DIR, `${sheetId}.png`);
  execFileSync('ffmpeg', [
    '-y', '-start_number', '0', '-framerate', '1', '-i', path.join(tmp, '%04d.png'),
    '-frames:v', '1', '-vf', `tile=${COLUMNS}x${rows},format=rgba`, '-pix_fmt', 'rgba', outPng,
  ], { stdio: ['ignore', 'ignore', 'ignore'] });

  // LOSSLESS PROOF: crop every cell back out and PSNR-compare to its source.
  let checked = 0;
  for (let i = 0; i < count; i++) {
    const col = i % COLUMNS, row = Math.floor(i / COLUMNS);
    const cell = path.join(tmp, `cell-${i}.png`);
    execFileSync('ffmpeg', ['-y', '-i', outPng, '-vf', `crop=${fw}:${fh}:${col * fw}:${row * fh}`,
      '-frames:v', '1', cell], { stdio: ['ignore', 'ignore', 'ignore'] });
    const avg = psnrAverage(cell, frames[i].src);
    if (avg !== 'inf') throw new Error(`${sheetId}: frame ${i} (${frames[i].key}) NOT lossless — PSNR avg=${avg}`);
    checked++;
  }
  fs.rmSync(tmp, { recursive: true, force: true });

  const index = {};
  frames.forEach((f, i) => { index[f.key] = i; });
  const bytes = fs.statSync(outPng).size;
  console.log(`  ${sheetId}: ${count} frames → ${COLUMNS}x${rows} grid, ${fw}x${fh}px cells, ${(bytes / 1024).toFixed(1)}KB, ${checked}/${count} lossless ✓`);
  return { frameWidth: fw, frameHeight: fh, columns: COLUMNS, count, index };
}

function main() {
  const only = process.argv[2]; // optional: pack just one sheetId for a fast proof
  const manifest = {};
  console.log('Packing sprite sheets (lossless)…');
  const jobs = [['fox-pip', PIP, PIP.dir], ...NPC_IDS.map((id) => [`npc-${id}`, NPC, `npc/${id}`])];
  for (const [sheetId, spec, dir] of jobs) {
    if (only && only !== sheetId) continue;
    manifest[sheetId] = packCharacter(sheetId, spec, dir);
  }
  // Merge into any existing manifest when packing a single sheet, so a partial
  // run doesn't drop the others.
  let merged = manifest;
  if (only && fs.existsSync(MANIFEST)) {
    merged = { ...JSON.parse(fs.readFileSync(MANIFEST, 'utf8')), ...manifest };
  }
  fs.writeFileSync(MANIFEST, JSON.stringify(merged, null, 2) + '\n');
  console.log(`Manifest → ${path.relative(ROOT, MANIFEST)} (${Object.keys(merged).length} sheets)`);
}

main();

#!/usr/bin/env node
/*
 * apply-staged-collision.cjs  (#119, U3)
 * ----------------------------------------------------------------------------
 * The PORT step of the collision-staging workflow (docs/workflow/collision-staging.md):
 *
 *     Jaco paints + Saves in the editor  →  staged/collision/<areaId>.json
 *       →  THIS script reports the diff vs the area's REAL current collision
 *       →  I hand-apply the proven cells to src/data/areas/<areaId>.ts
 *       →  verify (build + behind-fade scenario + MP4)  →  drop staged  →  commit.
 *
 * It is a REPORTER, not an auto-rewriter: it never edits game code. Auto-editing
 * the imperative map builders / object-footprint literals is fragile and would
 * silently mis-place a band; instead it prints an exact, attributed before/after
 * so the human porting step is mechanical and off-by-one-proof.
 *
 * Why no off-by-one (the explicit U3 risk): the "current" blocked set is computed
 * with the SAME predicate the editor seeds from — the real `cellBlocks` from
 * src/systems/collision.ts, over the real AreaDefinition from the area registry,
 * with a faithful port of GameScene.buildObjectCollisionMap. Identical inputs +
 * identical predicate ⇒ identical grid. The staged file is in the editor's exact
 * cell coordinates, so the diff is a pure set comparison in one coordinate system.
 *
 * Usage:
 *   node autonomy/apply-staged-collision.cjs <areaId> [options]
 *   node autonomy/apply-staged-collision.cjs ashen-isle
 *   node autonomy/apply-staged-collision.cjs ashen-isle --staged path/to/file.json
 *   node autonomy/apply-staged-collision.cjs ashen-isle --json out/diff.json
 *   node autonomy/apply-staged-collision.cjs ashen-isle --flags '{"atoned":true}'
 *
 * Exit codes: 0 = ran (diff may be empty or non-empty), 1 = usage/IO/validation error.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const Module = require('module');

const REPO_ROOT = path.resolve(__dirname, '..');
const SRC = path.join(REPO_ROOT, 'src');

// ---------------------------------------------------------------------------
// TypeScript require hook — transpile .ts on require so we can import the REAL
// game modules (no second copy of collision logic to drift). Pure-JS tsc; no
// native esbuild binary involved, so it runs anywhere node does.
// ---------------------------------------------------------------------------
const ts = require('typescript');
require.extensions['.ts'] = function (mod, filename) {
  const src = fs.readFileSync(filename, 'utf8');
  const out = ts.transpileModule(src, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      isolatedModules: true,
    },
    fileName: filename,
  });
  mod._compile(out.outputText, filename);
};

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const out = { areaId: null, staged: null, json: null, flags: {} };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--staged') out.staged = rest[++i];
    else if (a === '--json') out.json = rest[++i];
    else if (a === '--flags') out.flags = JSON.parse(rest[++i]);
    else if (!a.startsWith('--') && !out.areaId) out.areaId = a;
    else die(`unknown argument: ${a}`);
  }
  if (!out.areaId) die('missing <areaId> (e.g. ashen-isle)');
  return out;
}

function die(msg) {
  console.error(`apply-staged-collision: ${msg}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Condition evaluator — mirrors src/systems/conditions.ts exactly, against an
// explicit flag map (default empty = fresh boot, which is how the editor is
// opened). Mirrored rather than imported because the real flags module pulls in
// browser-only sandbox/saveState; the logic here is small and pinned to it.
// ---------------------------------------------------------------------------
function makeEvaluator(flags) {
  const getFlag = (name) => (name in flags ? flags[name] : undefined);
  const evalClause = (clause) => {
    const m = clause.match(/^(\S+)\s*(==|>=|>|<=|<|!=)\s*(.+)$/);
    if (!m) return false;
    const [, flagName, op, rawValue] = m;
    const fv = getFlag(flagName);
    let expected;
    if (rawValue === 'true') expected = true;
    else if (rawValue === 'false') expected = false;
    else if (!isNaN(Number(rawValue))) expected = Number(rawValue);
    else expected = rawValue;
    const actual = fv ?? (typeof expected === 'boolean' ? false : typeof expected === 'number' ? 0 : '');
    switch (op) {
      case '==': return actual === expected;
      case '!=': return actual !== expected;
      case '>=': return Number(actual) >= Number(expected);
      case '>': return Number(actual) > Number(expected);
      case '<=': return Number(actual) <= Number(expected);
      case '<': return Number(actual) < Number(expected);
      default: return false;
    }
  };
  return (condition) => condition.split(/\s+AND\s+/).every((c) => evalClause(c.trim()));
}

// ---------------------------------------------------------------------------
// Build the object-collision map + per-cell attribution. Faithful port of
// GameScene.buildObjectCollisionMap (#346 base-only footprint model).
// ---------------------------------------------------------------------------
function buildObjectCollision(area, OBJECT_KINDS, evaluate) {
  const blocked = new Map(); // "col,row" -> [sourceLabel, ...]
  const add = (col, row, label) => {
    const key = `${col},${row}`;
    const cur = blocked.get(key);
    if (cur) cur.push(label);
    else blocked.set(key, [label]);
  };
  for (const inst of area.objects) {
    if (inst.condition && !evaluate(inst.condition)) continue;
    const def = OBJECT_KINDS[inst.kind];
    if (!def) {
      console.warn(`  ! object at (${inst.col},${inst.row}) has unknown kind '${inst.kind}' — skipped`);
      continue;
    }
    if (def.passable) continue;
    const cf = def.collisionFootprint;
    const label = `${inst.kind}@(${inst.col},${inst.row})`;
    if (cf) {
      for (let dy = 0; dy < cf.h; dy++) {
        for (let dx = 0; dx < cf.w; dx++) {
          add(inst.col + cf.dx + dx, inst.row + cf.dy + dy, label);
        }
      }
    } else {
      add(inst.col, inst.row, label);
    }
  }
  return blocked;
}

// ---------------------------------------------------------------------------
// Rectangle cover — greedy maximal rectangles over a cell set, for compact,
// human-portable reporting ("rows 21-27 cols 36-43" rather than 56 cells).
// ---------------------------------------------------------------------------
function rectCover(cells) {
  const remaining = new Set(cells); // "col,row"
  const has = (c, r) => remaining.has(`${c},${r}`);
  const rects = [];
  const sorted = [...cells].map((k) => k.split(',').map(Number)).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  for (const [c0, r0] of sorted) {
    if (!has(c0, r0)) continue;
    // grow width along the row
    let w = 1;
    while (has(c0 + w, r0)) w++;
    // grow height while every cell of the row-band is present
    let h = 1;
    grow: while (true) {
      for (let c = c0; c < c0 + w; c++) if (!has(c, r0 + h)) break grow;
      h++;
    }
    for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++) remaining.delete(`${c},${r}`);
    rects.push({ col0: c0, row0: r0, col1: c0 + w - 1, row1: r0 + h - 1, count: w * h });
  }
  return rects;
}

function fmtRect(rc) {
  if (rc.col0 === rc.col1 && rc.row0 === rc.row1) return `cell (${rc.col0},${rc.row0})`;
  return `cols ${rc.col0}-${rc.col1} rows ${rc.row0}-${rc.row1} (${rc.count} cells)`;
}

// ---------------------------------------------------------------------------
// ASCII before/after — windowed to the changed region (padded), so the diff is
// eyeball-checkable against the painted grid.
//   #  blocked, unchanged       .  clear, unchanged
//   +  ADD (paint new block)    -  REMOVE (cleared to walkable)
// ---------------------------------------------------------------------------
function renderAscii(cols, rows, current, desired, add, remove) {
  const changed = [...add, ...remove].map((k) => k.split(',').map(Number));
  if (changed.length === 0) return '(no changes)';
  let minC = cols, maxC = 0, minR = rows, maxR = 0;
  for (const [c, r] of changed) {
    minC = Math.min(minC, c); maxC = Math.max(maxC, c);
    minR = Math.min(minR, r); maxR = Math.max(maxR, r);
  }
  const PAD = 2;
  minC = Math.max(0, minC - PAD); minR = Math.max(0, minR - PAD);
  maxC = Math.min(cols - 1, maxC + PAD); maxR = Math.min(rows - 1, maxR + PAD);
  const addSet = new Set(add), remSet = new Set(remove);
  const header = '     ' + Array.from({ length: maxC - minC + 1 }, (_, i) => String((minC + i) % 10)).join('');
  const lines = [header];
  for (let r = minR; r <= maxR; r++) {
    let line = String(r).padStart(3, ' ') + ': ';
    for (let c = minC; c <= maxC; c++) {
      const key = `${c},${r}`;
      if (addSet.has(key)) line += '+';
      else if (remSet.has(key)) line += '-';
      else if (current.has(key)) line += '#';
      else line += '.';
    }
    lines.push(line);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const opts = parseArgs(process.argv);

  // Load the real game modules through the TS hook.
  const { getArea } = require(path.join(SRC, 'data/areas/registry.ts'));
  const { cellBlocks } = require(path.join(SRC, 'systems/collision.ts'));
  const { OBJECT_KINDS } = require(path.join(SRC, 'maps/objects.ts'));

  const area = getArea(opts.areaId);
  if (!area) die(`unknown areaId '${opts.areaId}' (see src/data/areas/registry.ts)`);

  const stagedPath = opts.staged
    ? path.resolve(opts.staged)
    : path.join(REPO_ROOT, 'staged', 'collision', `${opts.areaId}.json`);
  if (!fs.existsSync(stagedPath)) {
    die(`no staged file at ${path.relative(REPO_ROOT, stagedPath)} — paint + Save in the editor first ` +
        `(tools/editor → Map collision tab, area "${opts.areaId}").`);
  }
  const staged = JSON.parse(fs.readFileSync(stagedPath, 'utf8'));

  // Dimension guard — the load-bearing off-by-one check. A staged file from a
  // different map size means the painted grid does not line up with this area.
  if (staged.cols !== area.mapCols || staged.rows !== area.mapRows) {
    die(`staged grid is ${staged.cols}x${staged.rows} but ${opts.areaId} is ` +
        `${area.mapCols}x${area.mapRows} — wrong area or stale map. Aborting (would mis-place every cell).`);
  }

  const evaluate = makeEvaluator(opts.flags || {});

  // --- current blocked set (terrain via REAL cellBlocks + object footprints) ---
  const objBlocks = buildObjectCollision(area, OBJECT_KINDS, evaluate);
  const passability = { terrain: area.terrain, objectBlockMap: new Map([...objBlocks.keys()].map((k) => [k, true])) };
  const current = new Set();
  const terrainOnly = new Set(); // blocked by terrain, no object
  for (let row = 0; row < area.mapRows; row++) {
    for (let col = 0; col < area.mapCols; col++) {
      if (cellBlocks(col, row, passability)) {
        const key = `${col},${row}`;
        current.add(key);
        if (!objBlocks.has(key)) terrainOnly.add(key);
      }
    }
  }

  // --- desired set (staged) ---
  const desired = new Set(staged.blocked.map(([c, r]) => `${c},${r}`));

  // --- diff ---
  const add = [...desired].filter((k) => !current.has(k)); // wants blocked, currently clear
  const remove = [...current].filter((k) => !desired.has(k)); // currently blocked, wants clear

  // --- attribution of each REMOVE (what to edit to free it) ---
  const attribute = (key) => {
    const srcs = objBlocks.get(key);
    if (srcs && srcs.length) return srcs.join(' + ');
    if (terrainOnly.has(key)) return 'terrain WALL (map cell)';
    return 'terrain/out-of-bounds';
  };

  // --- report ---
  const rel = (p) => path.relative(REPO_ROOT, p);
  console.log(`\n=== collision port report — ${opts.areaId} (${area.mapCols}x${area.mapRows}) ===`);
  console.log(`staged:  ${rel(stagedPath)}  (saved ${staged.savedAt || 'unknown'})`);
  console.log(`current blocked cells: ${current.size}   desired: ${desired.size}`);
  console.log(`changes: +${add.length} to block, -${remove.length} to free\n`);

  if (add.length === 0 && remove.length === 0) {
    console.log('✓ staged map already matches current collision — nothing to port.\n');
  } else {
    if (remove.length) {
      console.log(`-- FREE these ${remove.length} cell(s) (currently blocked, painted walkable):`);
      for (const rc of rectCover(remove)) {
        const sources = new Set();
        for (let r = rc.row0; r <= rc.row1; r++)
          for (let c = rc.col0; c <= rc.col1; c++) sources.add(attribute(`${c},${r}`));
        console.log(`   ${fmtRect(rc)}  ←  ${[...sources].join(', ')}`);
      }
      console.log('');
    }
    if (add.length) {
      console.log(`-- BLOCK these ${add.length} cell(s) (currently walkable, painted blocked):`);
      for (const rc of rectCover(add)) console.log(`   ${fmtRect(rc)}`);
      console.log('   → add as a collisionFootprint band on the covering object, or a WALL/collision-block.\n');
    }
    console.log('grid (window around changes):');
    console.log(renderAscii(area.mapCols, area.mapRows, current, desired, new Set(add), new Set(remove)));
    console.log('  legend: # blocked  . clear  + block-this  - free-this\n');
  }

  if (opts.json) {
    const outPath = path.resolve(opts.json);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const toPairs = (set) => [...set].map((k) => k.split(',').map(Number));
    fs.writeFileSync(outPath, JSON.stringify({
      areaId: opts.areaId,
      cols: area.mapCols,
      rows: area.mapRows,
      currentCount: current.size,
      desiredCount: desired.size,
      add: toPairs(new Set(add)),
      remove: toPairs(new Set(remove)).map(([c, r]) => ({ col: c, row: r, source: attribute(`${c},${r}`) })),
    }, null, 2) + '\n');
    console.log(`wrote machine-readable diff → ${rel(outPath)}\n`);
  }
}

main();

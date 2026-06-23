# Collision staging — paint → port → verify → commit

The repeatable flow for changing what blocks Pip in an area, without ever editing
collision by eye. You paint the desired blocked cells over the live scene, save
them to a **staged** file, and a reporter tells you exactly which cells changed
and which object/terrain source owns each one — so porting the change into game
code is mechanical, not guesswork.

Built for #119 (Pip walks behind the cottage); reusable for any area's collision.

## The chain

```
  editor → Map collision tab         you paint + Save in the browser
        │                            → staged/collision/<id>.json   (gitignored)
        ▼
  autonomy/apply-staged-collision.cjs   reports the diff vs REAL current collision (U3)
        │                               (which cells, attributed to each source)
        ▼
  hand-edit src/data/areas/<id>.ts    apply the proven cells (footprint / WALL)
        │
        ▼
  verify: build + behind-fade scenario + MP4   prove it before it ships
        │
        ▼
  drop staged/  →  commit              only the proven values land in git
```

## 1. Paint (the editor — Map collision tab)

The area-collision paint tool lives in the standalone editor app (#184 ported it
out of the old in-game `?editor=collision` boot). Run `cd tools/editor && npm run
dev` and open the **Map collision** tab; pick the area from the tab's dropdown
(e.g. `ashen-isle`). The grid is **seeded from the area's real collision** — every
cell that blocks Pip today starts red. You edit the *diff*:

- **Click / drag** toggles cells (the first cell in a drag decides add-or-remove;
  the whole drag is consistently one or the other).
- The embedded HUD shows the blocked count and a **Save** button that writes the
  staged file.

Save POSTs to the dev-only `/__collision/save` endpoint, which writes
`staged/collision/<areaId>.json`:

```jsonc
{ "areaId": "ashen-isle", "cols": 50, "rows": 38,
  "blocked": [[c,r], …],            // the FULL desired blocked-cell set, tile coords
  "savedAt": "2026-…Z" }
```

`staged/` is **gitignored** — nothing the editor writes can accidentally ship.
The endpoint exists only in `vite dev`; a production build has no save route.

## 2. Port report (the reporter — U3)

```bash
node autonomy/apply-staged-collision.cjs <areaId>
#   --staged <path>   read a specific staged file (default staged/collision/<id>.json)
#   --json   <path>   also write the diff as machine-readable JSON
#   --flags  '<json>' evaluate conditional objects under these flags (default: fresh boot)
```

It loads the **real** `AreaDefinition` and the **real** `cellBlocks` predicate
(via a TypeScript require-hook — same code the editor seeds from), computes the
current blocked set, and diffs it against the staged desired set. Output:

- `+N to block` — painted blocked, currently walkable → needs a new collider.
- `-N to free`  — currently blocked, painted walkable → **attributed to its
  source**, e.g. `cottage-large@(36,21)` (reduce that object's
  `collisionFootprint`) or `terrain WALL (map cell)` (flip `m[r][c]` to FLOOR in
  the map builder).
- A windowed ASCII before/after grid (`#` blocked · `.` clear · `+` block-this ·
  `-` free-this) to eyeball against what you painted.

**Off-by-one safety:** the report aborts if the staged grid size ≠ the area's
`mapCols × mapRows`. Because current and desired are both in the editor's exact
cell coordinates and the predicate is the live one, a staged file saved with **no
edits** reports an empty diff (verified — see U3 below).

## 3. Apply (by hand — deliberately)

The reporter never edits game code (auto-rewriting the imperative map builders and
footprint literals is fragile — a mis-placed band ships silently). The two
collision sources in `src/data/areas/<id>.ts`:

- **Object footprint** — `collisionFootprint: { dx, dy, w, h }` on the kind in
  `src/maps/objects.ts` (relative to the object's anchor cell). The base-only
  model (#346): a tall object blocks just a low band so its body stays walkable
  for walk-behind + the see-through fade. See
  `docs/solutions/implementation/tall-building-collision-band-at-base.md`.
- **Terrain WALL** — `m[r][c] = W` in the area's map builder (perimeter walls,
  water, etc.).

Pick the single source per Fork 2 (prefer footprint for buildings/props so the
body stays walkable; terrain for true walls/water).

## 4. Verify before commit (hard gate)

- `npm run build` clean (`tsc --noEmit && vite build`).
- The behind-fade / relevant **testbench scenario** passes headless
  (`?scenario=<id>`), and the F4 debug overlay (`?debugCollision=1`, U1) shows
  only the intended cells blocked.
- **MP4** for any motion (walk-behind, fade) → GATE 2 preview approval.

## 5. Commit

Commit only the proven `src/data/areas/<id>.ts` / `src/maps/objects.ts` changes.
**Drop the staged file** — it's a scratchpad, gitignored, never committed.

## Verification of this workflow (U3)

`autonomy/capture-collision-baseline.cjs <areaId>` boots the editor app headless,
opens the Map collision tab, and Saves with zero edits, capturing the true seeded
set. Proven for `ashen-isle`: editor seed = **379 cells**; the reporter's computed
current set = **379**, empty diff. A hand-edited staged file (free 2 footprint
cells, block 2 free cells) reports exactly those 4 changes, the freed cells
attributed to `cottage-large@(36,21)`. No off-by-one.

# emberpath editor — the local-only authoring tool

This is the single home for **all** of emberpath's authoring tools. It is a
standalone Vite app, separate from the game, and it runs **locally only**.

> **⛔ HARD CONSTRAINT — never publish this.**
> The editor must never be added to the root build or the GitHub Pages artifact
> (#182, Jaco 2026-06-21: "all the tools in a dedicated place while avoiding
> publishing the tool to github pages"). It is a dev tool. Pages only ever serves
> the **game** — `deploy-pages.yml` runs the **root** `npm run build` and uploads
> the root `dist/`; this app has its own `dist/` that is never deployed. The
> `test/pages-boundary.test.ts` guard fails the build if any game `src/` file ever
> imports from `tools/editor/`, which would drag the editor into the published bundle.

## Run it

```bash
cd tools/editor
npm install      # first time only
npm run dev      # serves on http://localhost:5174
```

The **root** dev server (`npm run dev` at the repo root, port 5173) is for
**playing / testing the game**. This editor (port 5174) is for **authoring its
data**. Two apps, two ports, one source of truth: both read the same game code via
the `@game/*` alias (`tools/editor → ../../src`), so the editor never forks the
game's registries or render math.

## Tools (one nav, no URL params)

| Tab | What it edits | Saves to |
|-----|---------------|----------|
| **Map** | Terrain paint + object placement per area | Export TypeScript (copy → paste) |
| **Dialogue** | NPC prompts + portraits | Export TypeScript (copy → paste) |
| **Flow** | Conversation graph (read-only view) | — |
| **Collision** | Per-**object** sub-cell collision shapes | auto-writes `src/data/object-shapes.json` |
| **Shadow** | Per-object & per-character ground shadows | auto-writes `src/data/object-shapes.json` / `character-shapes.json` |

The Collision and Shadow tabs host the game's own editor systems
(`src/systems/objectShapeEditor.ts`, `src/systems/shadowEditor.ts`) verbatim on an
editor-owned Phaser scene — the live preview is byte-identical to the game because
both share `src/maps/shadows.ts` (no fork). Their save endpoints are the dev-only
Vite plugins in `vite-plugins/`, registered in this app's `vite.config.ts` with the
repo root so they write back into the game's committed data files.

## Known follow-ups (not yet in the editor)

These were intentionally deferred from the #182 unification PR; tracked as a
follow-up issue:

- **Area (per-tile) collision** — `CollisionEditorSystem` still opens in-game via
  `?editor=collision&area=<id>` because it needs a full area render (terrain +
  objects) as a backdrop. Porting that render into the editor scene is the
  remaining migration.
- **Map / Dialogue auto-save** — these still use copy-paste "Export TypeScript".
  Auto-write endpoints (`/__area/save`, `/__dialogue/save`) are the planned upgrade.
- Once area-collision lives here, the in-game `?editor=` dispatch can be removed
  from `GameScene`/`sandbox`/`TitleScene` entirely.

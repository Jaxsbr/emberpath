# Phase retrospective — tile-architecture

**Phase finalised by operator.** Architectural deliverables (US-92..US-98 code-side: data model, Wang resolver, collision unification, PixelLab tilesets, PixelLab objects, editor, per-cell tileset selection + marsh-trap terrain-flip) all shipped to `build/tile-architecture`. Content-side hand-paint of both areas + Kenney atlas removal + `decorationsTileset` field cleanup + degenerate-mode warning Set removal + in-engine manual smoke are operator-deferred to a follow-up phase (likely `tile-content` or merged into `briar-wilds` setup work). Operator opted to ship the architecture now via this PR so the foundation is mergeable; the content authoring proceeds against a stable base.

## Metrics (so far)

13 logged tasks. 2 investigate, 11 implement, 1 fail (task 9 — PixelLab service failure), 0 code-side rework. 5 PixelLab object generations + 1 grass tileset reroll were content-side rerolls (in-spec budget consumption, not build-loop rework).

- **Rework rate (code):** 0%
- **Investigate ratio:** 15% (one consolidated inventory rather than per-story)
- **Health:** healthy on the code side. Content-side rerolls within budget (US-95: 6/10 generations; US-96: 24/36 generations).

## Build-log failure classes

- **`external-service-quota-misroute`** — first-seen (task 9: 9 PixelLab tileset generations fired against the maxed-out `mcp__pixellab-team__` server before the operator caught the wrong-server mistake; should have used the personal `mcp__pixellab__` from the start). Captured as Learning **EP-05** in `docs/plan/LEARNINGS.md` mid-phase. **No compounding fix needed** — first occurrence and EP-05 already prescribes prevention (check git log for prior PixelLab usage; default to personal server; stop on two consecutive "Unknown error" failures).
- **`pixellab-tier-concurrency-cap`** — first-seen (US-96 first batch of 18 hit the Tier 1 max-8-concurrent limit; 8 of the 18 had to be re-fired sequentially after the first batch cleared). Tooling observation. **No compounding fix needed** — first occurrence.
- **`pixellab-random-generation-failure`** — first-seen (5 of 18 objects returned 500 from the download endpoint; rerolls landed on retry; door-wood needed reroll #2 for a near-empty result). Service-quirk class. **No compounding fix needed** — first occurrence.

## Operator-walkthrough findings

When the operator actually sat down with the new editor (US-97), four real authoring blockers surfaced that the spec didn't anticipate:

1. **No way to zoom.** The canvas was fixed at 16 pixels per tile. Fine for a bird's-eye view; useless when you need to nudge a single vertex on a 16×16 PixelLab tile or scan a corner of a 50×38 area on a small laptop. *(Fixed in US-97/US-98 follow-up: Ctrl/Cmd+wheel zoom, +/− buttons, Ctrl+0 reset.)*
2. **Painting "didn't work" for most terrains.** The paint changed the underlying terrain data, but the rendered tile didn't visibly change — because each Wang tileset is a single (primary, secondary) pair and `area.tileset` named just one. Painting `path` on Ashen Isle silently fell back to the grass→sand tileset. *(Fixed in US-98: per-cell tileset selection picks the matching tileset per cell instead of using a single area-wide one.)*
3. **No way to author triggers, NPCs, exits, or map transitions.** The editor only handles terrain and objects. Everything else is still hand-edited in the area `.ts` files. The editor renders triggers and NPCs as overlays so they're visible, but there's no UI to add or move them. *(Deferred to a future `editor-authoring-tools` phase.)*
4. **The whole thing needs a walkthrough session.** The four issues above were spotted in a few minutes of actually trying to use the editor. There are almost certainly more. A 30-minute session driving the editor against a real authoring task is needed to capture every "I'd want to do X here" friction point. *(Scheduled before specing the next editor-focused phase.)*

These are documented in `docs/plan/editor-known-issues.md` for the next iteration's input.

## Why this matters across phases

This is the **third time across phases** that the build loop has shipped something that compiles cleanly but turns out to have real usability gaps when an operator drives it for the first time:

- **`foundation` phase** — virtual joystick on mobile didn't work because Phaser routes touch-emulated pointers through different objects than the build-loop verify ever sees. Compile passed; touch input was broken.
- **`mobile-ux` phase** — viewport zoom and orientation handling broke under DevTools mobile emulation in ways the build couldn't catch.
- **`tile-architecture` phase (this one)** — the editor compiled fine and the tests had nothing to fail on, but four real authoring blockers were sitting there waiting for the operator.

Both prior retros looked at this pattern and decided it didn't quite trigger the twice-seen rule because *"these aren't build-loop failures — they're things the operator caught after the fact."* That dodge worked for two occurrences. With three, the pattern is real and it costs operator time every phase that ships an author-facing surface.

The fix — agreed below — pushes prevention upstream into spec-author. The build loop's verify is compile-only by construction; the prevention point is one step earlier, at spec time, by requiring operator-walkthrough criteria that are **written as plain-language step-by-step guides, not abstract jargon**, so they actually get used.

## Compounding fixes proposed and applied

| Target | Change | Reason |
|---|---|---|
| `/Users/jacobusbrink/Jaxs/projects/sabs/skills/spec-author/SKILL.md` | Added "Operator-walkthrough completion gate (compounded)" rule under "Compounded done-when rules". When a phase delivers an author-facing surface, the spec MUST include at least one operator-walkthrough done-when criterion written as a **plain-language step-by-step test guide** (numbered concrete actions + what should visibly happen). Abstract framings ("operator runs the surface for 10 minutes against a representative scenario") explicitly fail the rule and must be rewritten. Steps end with: "If any step doesn't behave as described, record it in `docs/plan/<phase>-known-issues.md` (or equivalent). Phase cannot be marked complete until each gap is either fixed or explicitly deferred to a follow-up phase." | `platform-testing-gap` seen in `foundation`, `mobile-ux`, and `tile-architecture` (3× across phases). Build-loop's compile-only verify can't catch ergonomics; the prevention point is upstream in spec-author defining the right phase-completion gate. The plain-language constraint is core to the fix — operator confirmed the original abstract wording was itself the kind of AI jargon that gets ignored. |

**Approved by operator and applied** — file edited on disk. Note: the sabs plugin lives at `/Users/jacobusbrink/Jaxs/projects/sabs/` which is gitignored in the workspace repo and has no `.git` of its own — the plugin is local-only on this machine. The fix takes effect immediately for any future spec-author invocation on this machine; there is no portable record of the change beyond the file itself. If the plugin is later promoted to its own repo, this commit needs to be reconstructed from the SKILL.md history.

## What's deferred to a follow-up phase

The operator finalised the retro and merged the architectural foundation. The following items remain and are tracked for the next phase:

- **Hand-paint both areas** via the new editor (Ashen Isle + Fog Marsh terrain vertices + object placement). Spec recommends opening `tools/editor`, painting each area, clicking Export TypeScript, pasting into the area files.
- **Remove now-redundant Kenney decorations** from `ashen-isle.ts` and `fog-marsh.ts` once their visual role is taken over by hand-painted terrain + objects.
- **Delete `tiny-town`/`tiny-dungeon`** TILESETS entries and `assets/tilesets/tiny-town/` + `assets/tilesets/tiny-dungeon/` directories.
- **Remove `decorationsTileset`** field from `AreaDefinition` (depends on no remaining Kenney decorations).
- **Remove degenerate-mode warning Set** from `wang.ts` (depends on no degenerate tilesets registered).
- **Manual smoke**: in-engine at desktop ~1280×720 + mobile DevTools 360×640 across both areas, save-state compat, Reset Progress flow.

The follow-up phase that picks these up will inherit a clean architectural base. Operator-walkthrough criteria for that phase MUST be specced under the new "Operator-walkthrough completion gate" rule landed in spec-author this retro — written as plain-language step-by-step test guides, not abstract jargon.

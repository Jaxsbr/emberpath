# Test bench — scenario boot & sandbox saves

Boot the game straight into a mid-game state for testing, **without ever touching
the real save**. Useful for manual checks and for the headless playtest harness.

## URL params

| Param | Effect |
|-------|--------|
| `?scenario=<id>` | Wipe the sandbox namespace, apply the scenario's flags, and jump straight into its area + position (skips the Title menu). Implies sandbox. |
| `?sandbox=1` | Use the throwaway save namespace for this tab without applying a scenario (e.g. after a scenario boot, a refresh keeps you in the sandbox run). |

Examples (served build, e.g. `npx vite preview`):
- `http://localhost:5180/?scenario=ember-in-marsh`
- `http://localhost:5180/?scenario=has-words-at-bridge`
- `http://localhost:5180/?scenario=trapped-in-marsh`

## How the save stays safe

All flag/save reads & writes route through `src/sandbox.ts`, which picks the
storage namespace **once, from the URL, at import time**:

- Normal play → `emberpath_flags` / `emberpath_save` (the real save).
- `?sandbox=1` / `?scenario=…` → `emberpath_sandbox_flags` / `emberpath_sandbox_save`.

The real keys are never read or written during a sandbox run. Close the tab or
reload without the param and you're back on the real save automatically — it was
never touched.

> Import-order contract: `flags.ts` reads localStorage at module-init, so
> `main.ts` imports `./sandbox` **before** the scene imports. Don't reorder it.

## Scenarios

Scenarios are version-controlled in `src/scenarios/`. A scenario is:

```ts
{ id, description, areaId, position?: { col, row }, flags: Record<string, FlagValue> }
```

Add one by creating `src/scenarios/<id>.ts` and registering it in
`src/scenarios/registry.ts`. **Always include the area's intro flag**
(e.g. `ashen_intro_played: true`) so a headless boot skips cutscenes
deterministically. `ember_warmth` is a `0.0–1.0` scale (`1` = full).

## Headless verification

The playtest harness drives a scenario by navigating a headless browser to
`?scenario=<id>`, waiting for the canvas, then capturing frames (a **GIF** for
anything with motion, a still for static art) — see `autonomy/playtest.md`.

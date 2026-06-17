import { FlagValue } from '../triggers/flags';

// A named, version-controlled mid-game state for the test bench. Booting a
// scenario wipes the SANDBOX namespace, writes these flags, and drops Pip into
// `areaId` at `position` (or the area's playerSpawn if omitted) — the real save
// is never touched. Selected via `?scenario=<id>` (see TitleScene.applyScenario).
//
// Authoring rule: include any `*_intro_played` flag your area gates its opening
// cinematic on (e.g. `ashen_intro_played: true`) so a headless boot is
// deterministic and skips cutscenes.
export interface Scenario {
  id: string;
  description: string;
  areaId: string;
  position?: { col: number; row: number };
  flags: Record<string, FlagValue>;
}

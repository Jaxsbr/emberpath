---
title: "chore: Auto-sync vendored skills into the persona's container mount"
type: refactor
status: completed
date: 2026-06-20
---

# chore: Auto-sync vendored skills into the persona's container mount

## Summary

Kill the silent drift between the game repo's `.claude/skills/*` (source of truth) and the
copy the persona actually loads at `/home/node/.claude/skills/*`. Issue #158 framed the fix as
host-side only (in `nanoclaw`, outside this container). This plan adds a **reachable persona-side
auto-sync** — a `sync-skills.sh` helper that refreshes the mount from the mounted game repo on
every session, plus a drift detector — so a committed skill edit goes live with **zero manual
copy**, today, without waiting on the host change. The pure spawn-time host fix stays tracked as
follow-up (owner: Jaco) but is no longer the only path off the drift.

---

## Problem Frame

The vendored CE + emberpath skills were brought online by a **one-time copy** of the game repo's
`.claude/skills/*` into the persona's container mount (`/home/node/.claude/skills/`). Real dirs
there survive respawn, so discovery works — but the copy never refreshes. The moment a skill is
edited in the game repo (a hand edit, or `/ce-compound` / `ce-compound-refresh` rewriting a
skill), the mount copy goes stale and the persona keeps running the **old** skill while the
committed source says otherwise. Silent, invisible divergence between "the skill in git" and "the
skill the agent runs." Issue #158's interim mitigation is a manual host-side `cp -R` that the
persona has been told to remember before every skill edit (the CLAUDE.local.md #158 caveat) —
fragile, easy to forget, and the exact failure mode it warns about.

**Key reachability finding (verified this session):** both sides of the copy are visible *inside*
the persona container — the game repo at `/workspace/extra/emberpath/.claude/skills/` and the live
mount at `/home/node/.claude/skills/`, which is **writable**. So the persona can perform the
refresh itself; it does not need host access for the interim. What it genuinely cannot do is hook
the container *spawn* — that code lives in `nanoclaw`, which is not mounted here.

---

## Requirements

- R1. A committed skill edit in the game repo (`.claude/skills/<name>`) becomes the version the
  persona loads, with **no manual copy step** by the persona or Jaco.
- R2. The refresh is automatic — it runs as part of the normal session lifecycle, not as a
  remembered manual chore.
- R3. The game repo `.claude/skills/*` remains the single source of truth; the sync only writes
  the mount, never the reverse, and never touches the built-in symlinked skills.
- R4. Accidental divergence (e.g. a skill edited directly in the mount instead of the game repo)
  is **detectable** before it is silently lost on respawn.
- R5. The CLAUDE.local.md #158 caveat and the issue's manual-copy mitigation are retired (or
  clearly re-scoped to the residual host-side gap) once the persona-side sync is live.

---

## Scope Boundaries

- Not modifying `nanoclaw` host source — it is not mounted in this container and cannot be edited
  from here. The host-side spawn-time fix is captured as follow-up, not built here.
- Not changing skill *content* — this is purely about which copy the persona loads.
- Not touching the built-in skills symlinked from `/app/skills/` (agent-browser, wiki, etc.).
  Sync targets only the real-dir skills sourced from the game repo (`ce-*`, `emberpath-*`).
- Not building a file-watcher / daemon — the refresh is tied to the session lifecycle, which is
  sufficient for a single-persona, low-edit-rate workflow.

### Deferred to Follow-Up Work

- **Host-side spawn-time auto-refresh in `nanoclaw`** (the literal #158 "Done when" #1): extend
  `syncSkillSymlinks` (or a `group-init.ts` hook) in `nanoclaw/src/container-runner.ts` to refresh
  `.claude-shared/skills/<name>` from `<mounted-repo>/.claude/skills/<name>` on every spawn.
  Owner: Jaco / host operator. Tracked on #158. This plan's persona-side sync makes that fix a
  belt-and-suspenders nicety rather than the only path off the drift.

---

## Context & Research

### Relevant Code and Patterns

- `/workspace/extra/emberpath/.claude/skills/` — **source of truth**, the mounted game repo. 11
  real-dir skills: `ce-brainstorm`, `ce-compound`, `ce-compound-refresh`, `ce-demo-reel`,
  `ce-doc-review`, `ce-plan`, `ce-report-bug`, `ce-test-browser`, `ce-work`,
  `emberpath-art-review`, `emberpath-pr-review`.
- `/home/node/.claude/skills/` — the **live mount** the persona loads. Confirmed writable from the
  container. Built-ins are symlinks to `/app/skills/`; the vendored skills are real dirs. Also
  currently holds two stragglers not in the game repo: `feedback` and `emberpath-feedback`
  (the deprecated alias) — the sync must be additive/refresh-only and must NOT delete mount-only
  skills, or it would wipe these.
- `autonomy/session-gate.sh` — the cron pre-task gate (every 15 min) that wakes exactly one
  session and writes `.session.lock`. Candidate hook point **if** its execution context has the
  `/home/node/.claude/skills/` mount (to be verified — see U2).
- `autonomy/session-lock.sh` + the ORIENT step of the work cycle (`methodology.md`) — the
  guaranteed-reachable hook point: the agent itself runs at ORIENT and provably has both mounts.
- `autonomy/*.cjs` / `*.sh` — established home for the persona's operating scripts; the new helper
  belongs here alongside `boot-smoke.cjs`, `premerge.sh`, `gh.cjs`.

### Institutional Learnings

- The #158 caveat in CLAUDE.local.md is itself a symptom of the missing automation — a remembered
  manual step is exactly what keeps biting. The fix is to remove the need to remember.
- Sync direction is load-bearing: the game repo is canonical. A naive bidirectional or
  mount-authoritative sync would let an in-mount edit overwrite committed source — the opposite of
  the intended invariant (R3).

### External References

- None — internal tooling, no external surface.

---

## Key Technical Decisions

- **Persona-side sync, not host-side, as the shipped fix.** The host fix is unreachable from this
  container; the persona-side refresh is reachable, automatic, and satisfies the *intent* of
  #158's "Done when #1" (zero manual copy). Rationale: deliver the value now; keep the host fix as
  optional hardening.
- **One-directional copy: game repo → mount, refresh-only.** `rsync`-style refresh (or `cp -R`
  per-skill) that updates/adds the 11 vendored skills and leaves everything else in the mount
  untouched. Never write back to the game repo; never delete mount-only entries (protects
  `feedback` / `emberpath-feedback`). Enforces R3 and avoids R4-class data loss.
- **Hook at ORIENT (guaranteed), opportunistically also at the gate (if its context allows).**
  ORIENT is provably reachable and runs every session — that alone satisfies R1/R2. If U2 confirms
  the gate's shell sees the mount, also call the helper there so the refresh happens even before
  the agent's first action. Belt-and-suspenders, no downside.
- **Drift detector is a warning, not a blocker.** A `--check` mode compares mount vs game repo and
  reports divergence (especially mount-newer, which signals an in-mount edit at risk of being
  lost). Surfaces R4 without halting a session.
- **Source-of-truth discipline stays documented.** Editing a skill always means editing the game
  repo copy then syncing — never editing the loaded mount copy. The helper makes the right path
  the easy path, and the docs/caveat are updated to match (R5).

---

## Open Questions

### Resolved During Planning

- *Can the persona fix this at all, given #158 says "the persona can't fix this itself"?* — Yes,
  partially: it can't hook spawn (host code), but it **can** refresh the mount from inside the
  container (both paths visible + mount writable, verified). The unreachable part is narrowed to
  the spawn-time host hook only.
- *Which direction does the sync go?* — game repo → mount, refresh-only. The game repo is
  canonical (R3).
- *Will the sync wipe `feedback` / `emberpath-feedback` (mount-only, not in game repo)?* — No, by
  the refresh-only / never-delete rule. Called out explicitly because a `rsync --delete` would.

### Deferred to Implementation

- *Does `session-gate.sh`'s execution context have `/home/node/.claude/skills/` mounted?* —
  Determines whether the gate is a valid second hook point (U2). Resolve by inspecting the gate's
  runtime, not by assumption.
- *`rsync` vs per-skill `cp -R` loop?* — Pick at build time based on what's available in the
  container (`command -v rsync`); the loop is the portable fallback.

---

## Implementation Units

### U1. `sync-skills.sh` helper (refresh + drift-check)

**Goal:** A single workspace script that refreshes the vendored skills in the mount from the game
repo, and can also report drift without writing.

**Requirements:** R1, R3, R4

**Dependencies:** None

**Files:**
- Create: `autonomy/sync-skills.sh`
- (Reference, not modified) source `/workspace/extra/emberpath/.claude/skills/`, target
  `/home/node/.claude/skills/`

**Approach:**
- Two modes: default (refresh) and `--check` (report-only, non-zero/flagged on drift).
- Iterate the skill names that exist as **real dirs in the game repo** (the canonical set). For
  each, refresh the matching mount dir (`rsync -a --delete` *scoped to that one skill dir*, or
  `rm -rf <mount>/<name> && cp -R <src>/<name> <mount>/<name>`). Per-skill replacement is safe and
  keeps mount-only skills (`feedback`, `emberpath-feedback`) untouched — the loop never names them.
- Never copy mount → repo. Never delete a mount entry that isn't being refreshed.
- `--check`: for each canonical skill, `diff -rq` source vs mount; print drift, and specifically
  flag any case where the mount copy is **newer** than the source (likely an in-mount edit at risk
  of loss). Exit non-zero when drift is found.
- Idempotent and fast (11 small dirs); safe to call every session.

**Patterns to follow:** existing `autonomy/*.sh` helpers (`premerge.sh`) — bash, clear echo
output, exit codes that callers can branch on.

**Test scenarios:**
- Happy path: edit a sentinel marker in a game-repo skill, run the helper, confirm the marker now
  appears in the mount copy and `diff -rq` is clean.
- Edge case: run with the mount already in sync → no-op, exits clean.
- Edge case: `feedback` and `emberpath-feedback` exist in the mount but not the game repo → still
  present and unchanged after a refresh run (never deleted).
- Error path: a canonical skill dir missing from the mount → helper creates it (treats absent as
  drift-to-fix), exits clean.
- `--check`: introduce drift (touch a file in the mount copy only) → `--check` reports it and exits
  non-zero; refresh run then clears it.

**Verification:** After a refresh run, `bash autonomy/sync-skills.sh --check` reports zero drift
across all 11 canonical skills, and the two mount-only skills are still present.

---

### U2. Wire the refresh into the session lifecycle

**Goal:** The refresh runs automatically every session with no manual invocation, satisfying R1/R2.

**Requirements:** R1, R2

**Dependencies:** U1

**Files:**
- Modify: `autonomy/methodology.md` — add "run `sync-skills.sh` as the first ORIENT action" to the
  documented cycle (the guaranteed hook).
- Modify (conditional): `autonomy/session-gate.sh` — only if U2's context check confirms the gate
  shell has `/home/node/.claude/skills/`; call the helper right before it writes `wakeAgent: true`.
- Modify: `CLAUDE.local.md` (workspace) — record sync-at-ORIENT as part of the operating model.

**Approach:**
- **Primary (always):** make `sync-skills.sh` the first step of ORIENT, before any skill is
  loaded for cycle work. This alone closes the drift each session.
- **Secondary (verify-then-wire):** inspect the gate's runtime to confirm whether
  `/home/node/.claude/skills/` is present in its execution context. If yes, invoke the helper from
  the gate so the refresh happens even ahead of the agent's first action; if no, leave the gate
  untouched and rely on ORIENT. Do not assume — verify first (this is the one deferred unknown).
- Keep it cheap and non-fatal: a sync failure logs a warning and does not abort the session/gate.

**Execution note:** Verify the gate execution context empirically before editing `session-gate.sh`
— do not wire a hook into an environment that lacks the mount.

**Test scenarios:**
- Integration: simulate a stale mount (revert one mount skill to an old copy), then run the ORIENT
  step → the skill is refreshed to match the game repo before cycle work begins.
- Integration (conditional): if the gate is wired, a gate wake leaves the mount in sync without any
  agent action.
- Error path: make the source temporarily unreadable → ORIENT logs a warning and continues; the
  session is not aborted.

**Verification:** Starting a fresh session with a deliberately stale mount results in an in-sync
mount by the time cycle work begins, with no manual copy performed.

---

### U3. Retire the manual mitigation and re-scope #158

**Goal:** Remove the now-obsolete "remember to manually copy" guidance and narrow the open issue to
the residual host-side gap.

**Requirements:** R5

**Dependencies:** U1, U2

**Files:**
- Modify: `CLAUDE.local.md` (workspace) — replace the #158 manual-copy caveat with "sync is
  automatic at ORIENT via `autonomy/sync-skills.sh`; edit skills in the game repo, never in the
  mount."
- Modify (if a residual note exists): `compound-engineering.local.md` (game repo) — drop/replace
  any manual-copy interim note.
- Comment on GitHub issue #158 — report the persona-side auto-sync as shipped, re-scope the
  remaining open item to the host-side spawn-time hook (owner: Jaco), and let Jaco decide whether
  to keep #158 open for that or close it as satisfied-in-practice.

**Approach:**
- Use the REST helper (`autonomy/gh.cjs`) to post the issue comment; write the body to a `.md` file
  and read it via `fs.readFileSync` (quoting-trap discipline from CLAUDE.local.md).
- Do **not** unilaterally close #158 — the host-side "Done when" is a real, Jaco-owned residual;
  surface the decision to him.

**Test scenarios:**
- Test expectation: none — documentation + issue-comment update, no behavioral code change. Verify
  by reading back the updated caveat and the posted issue comment.

**Verification:** The CLAUDE.local.md caveat no longer instructs a manual copy; #158 carries a
comment distinguishing the shipped persona-side sync from the residual host-side hook.

---

## System-Wide Impact

- **Interaction graph:** touches the session ORIENT step and (conditionally) the cron gate. No
  game runtime / build impact — purely the persona's operating tooling.
- **Error propagation:** sync failures are warn-and-continue; they must never abort a session or
  block the gate from waking the agent.
- **State lifecycle risks:** the only real hazard is deleting mount-only skills — prevented by the
  refresh-only / per-canonical-skill design (U1). An in-mount edit being lost on respawn is
  surfaced by `--check` (R4), not silently swallowed.
- **API surface parity:** none — single-persona internal tooling.
- **Unchanged invariants:** the game repo `.claude/skills/*` stays canonical; built-in symlinked
  skills are never touched; skill *content* is unchanged.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Sync deletes mount-only skills (`feedback`, `emberpath-feedback`) | Refresh-only, iterate the canonical game-repo set; never `--delete` at mount root |
| Wrong-direction sync overwrites a committed skill | Hard one-directional rule (repo → mount only); `--check` flags mount-newer drift |
| Gate execution context lacks the mount → broken hook | U2 verifies empirically before editing `session-gate.sh`; ORIENT hook is the guaranteed path regardless |
| Persona forgets and edits the mount copy directly | `--check` at ORIENT catches divergence; docs steer all edits to the game repo |
| Treating #158 as fully closed when the host hook isn't built | U3 re-scopes rather than closes; Jaco decides on the residual |

---

## Documentation / Operational Notes

- The operating-model change (sync-at-ORIENT, edit-in-repo-only) is recorded in CLAUDE.local.md so
  future sessions inherit it.
- This is the persona-reachable resolution of #158; the host-side spawn hook remains a Jaco-owned
  follow-up tracked on the same issue.

---

## Sources & References

- Related issue: #158 (Jaxsbr/emberpath) — "Auto-sync vendored skills into the persona's container
  mount"
- Related code: `autonomy/session-gate.sh`, `autonomy/session-lock.sh`, `autonomy/methodology.md`,
  `autonomy/gh.cjs`
- Source of truth: `.claude/skills/` (game repo) → mount `/home/node/.claude/skills/`

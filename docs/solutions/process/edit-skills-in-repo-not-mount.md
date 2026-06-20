---
title: Edit vendored skills in the game repo, never the loaded mount copy
applies_when: Editing/adding/fixing any vendored skill (CE skills, feedback, emberpath-*) or wondering why a committed skill edit "didn't take"
status: binding
failure_ids: [#158 skill-mount drift]
canon: docs/workflow/ways-of-working.md
---

# Skills live in the repo; the mount is a refreshed copy

## The rule
The single source of truth for every vendored skill is the **game repo's `.claude/skills/*`**.
Always edit a skill THERE. **Never** edit the copy the persona actually loads at
`/home/node/.claude/skills/*` — that mount is a downstream, refresh-only mirror, and any edit
made directly in it is at risk of being silently overwritten (or lost on container respawn).
The sync is one-directional: **repo → mount**, never the reverse.

## How the sync works
`autonomy/sync-skills.sh` runs as the **first action of every session ORIENT**, before any skill
is loaded. It refreshes the mount from the repo's committed copy — so a skill edited last session,
by `/ce-compound`, or by Jaco goes live with **zero manual copy**. It is one-directional and
refresh-only: it updates/creates the canonical skills and never deletes anything else in the mount
(mount-only skills like `feedback` and the symlinked built-ins are safe). When already in sync it
is a clean no-op.

- `autonomy/sync-skills.sh` — refresh the mount from the repo (the ORIENT default).
- `autonomy/sync-skills.sh --check` — report drift only, write nothing. It loudly flags a mount
  copy that is **newer** than source — the tell-tale of an in-mount edit at risk of being lost.

## Why this lesson exists
Issue **#158**: the skills were brought online by a **one-time copy** of `.claude/skills/*` into the
mount. The mount never refreshed, so any later edit to a skill in the repo left the mount **stale** —
the persona kept running the OLD skill while git said otherwise, with no error to signal the drift.
This caused conflicting-guidance failures (an edited lesson that never went live). The fix closes the
gap from inside the container at ORIENT; the editing rule above is what keeps it closed.

## The test
- About to change skill behavior? Open the file under the **game repo** `.claude/skills/`, not the
  `/home/node/.claude/skills/` mount.
- Suspect a skill is stale or you edited the wrong copy? Run `autonomy/sync-skills.sh --check`.
- A committed skill edit "isn't taking effect"? It will, on the next ORIENT — the sync runs first.

## Residual (host-side, Jaco-owned)
Spawn-time seeding of the mount on a fresh container rebuild lives in the host (`nanoclaw`), outside
this container. The ORIENT sync already refreshes within ~one session, so this is belt-and-suspenders,
tracked on #158.

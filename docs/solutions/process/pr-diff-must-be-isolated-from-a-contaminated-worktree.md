---
title: A PR built from the shared working tree can leak another branch's code into a shared entry file — green locally, red on CI; isolate the diff against clean main, not just the file list
applies_when: Opening or merging any PR when the local working tree holds uncommitted work from MORE THAN ONE unmerged feature (the usual state of the emberpath bind-mount), especially when the PR touches a shared entry file like src/main.ts
status: binding
failure_ids: ["#208 — main.ts had picked up the F5-audio wiring (import './audio') that belongs to the unmerged #206 branch; it built fine locally (src/audio/ exists in the working tree) but CI's 'Typecheck + build' failed against clean main, where that module doesn't exist yet"]
canon: src/main.ts (the recurring shared entry file) · .github/workflows/ci.yml (the clean-main check that catches it)
---

# Isolate a PR's diff from the contaminated working tree

The emberpath repo is a **bind-mount that accumulates every parked feature at once** —
audio, campfire, reveal-art edits all sit uncommitted in the same tree. That makes the
local build a **liar**: code that imports a sibling feature's module compiles locally
(the module is present on disk) but **fails CI against clean main** (the module isn't
merged yet).

## What bit us
PR #208 (reveal-scene art) only needed to touch `sceneAssets.ts` + 8 jpgs + a tiny
sandbox handle in `main.ts`. But the working-tree `main.ts` also held the **F5-audio**
wiring (`import { initAudio } from './audio'`, `onFlagChange(...)→getAudio()`) — that
belongs to the unmerged #206 branch. The branch was built from that tree, so the audio
block rode along. `npm run build` was green locally; CI's typecheck failed in 14s on
`Cannot find module './audio'`.

## The rule
1. **Listing only the feature's files is NOT enough.** A single shared file (`main.ts`,
   a barrel `index.ts`, a registry) can itself carry cross-feature contamination. You
   must inspect the *content* of each shared file in the PR, not just which files changed.
2. **Read the PR diff of every shared entry file against clean main** (`pulls/N/files` →
   the `patch`). Any `import` of a module that lives in *another unmerged branch* is the
   smell. If you see it, rebuild that file = clean-main version + only this feature's hunk.
3. **Trust CI red over local green.** When the local build passes but CI's typecheck
   fails fast (seconds, at the build step after a successful `npm ci`), suspect a
   missing-module import from contamination before suspecting a real type error.

## The fix (no git push in this container — use the Git Data API)
Rebuild the branch off **current main HEAD**, overlaying only the legit blobs:
reuse the branch's existing blob SHAs for the clean files (assets, data), and create a
**new blob** for the contaminated entry file = main's version + just this feature's hunk.
`POST /git/trees` (base_tree = main's tree) → `POST /git/commits` (parent = main HEAD) →
`PATCH /git/refs/heads/<branch>` with `force:true`. This fixes both the contamination
**and** a "behind main" state in one commit; re-run CI, then squash-merge.

Pitfall hit while doing this: in a bash heredoc, **export** the shas or read them from a
file inside `node` — an unexported `$VAR` referenced via `process.env` is `undefined`,
which silently drops `base_tree`/a blob sha and gets a 422 "must supply tree.sha or
tree.content".

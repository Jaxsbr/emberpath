# Compound Engineering — emberpath config

Project-local config for the vendored Compound-Engineering (CE) skills in
`.claude/skills/ce-*`. These are **our copy** (pulled from
`EveryInc/compound-engineering-plugin` @ `v3.8.3`) so we can tailor them to
emberpath — we do NOT install the plugin. Edit the skills in place; capture why
in `docs/solutions/process/`.

## Where things live

| Artifact | Home |
|----------|------|
| Brainstorms (WHAT, exploratory) | `docs/brainstorms/<slug>.md` |
| Plans (HOW, technical) | `docs/plans/<issue>-<slug>.md` |
| Learnings (compounded) | `docs/solutions/` (see its `README.md` — the Lessons Index) |
| Issues (the work surface) | GitHub `Jaxsbr/emberpath` |

## Scope labels (use these, not Rails/web/api)

`art` · `engine` · `content` · `area` · `tooling` · `docs`

## The loop (see docs/workflow/ways-of-working.md for the full gated flow)

`/ce-brainstorm` → (Jaco promotes to an issue) → `/ce-plan` (writes the technical
plan + a plain-language Director's Brief; can create the GitHub issue) → **Jaco
approves direction (GATE 1)** → `/ce-work` → headless testbench verify → `/ce-demo-reel`
(GIF) → **Jaco approves visuals (GATE 2)** → squash-merge → `/ce-compound` (learning
→ docs/solutions) → close issue.

## Review

We do **not** use CE's `ce-code-review` agent fleet (it's Rails/Python-tuned). The
review gate stays on the existing stack-tuned skills:
- `emberpath-pr-review` — code quality, North-Star clarity, reading level, biblical
  guidance, design-feel.
- `emberpath-art-review` — 3/4-oblique perspective, shadow canon, clustering, mood;
  **must FAIL any deviation from a lesson in `docs/solutions/`** (see
  `docs/workflow/preflight.md`).

## Intentionally absent (graceful degradation)

These CE skills/agents are referenced by the vendored skills but NOT pulled in.
If a skill offers to hand off to one of these, skip that option:
- Skills: `ce-code-review`, `ce-proof` (web app), `ce-debug`, `ce-sessions`,
  `ce-issues`, `ce-commit-push-pr`, `ce-worktree`, `ce-setup`, `ce-figma-design-sync`,
  `ce-slack-research`.
- The CE reviewer/researcher **agent fleet** (`agents/ce-*.agent.md`) — deepening
  passes and auto-review that dispatch to these degrade to "skip"; that's expected.

Pull one in later (same `cp` from the plugin cache) only if we actually need it.

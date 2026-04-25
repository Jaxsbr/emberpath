# npc-portraits phase — manual verification checklist

Each checkbox is a done-when criterion from `docs/product/phases/npc-portraits.md` that requires running the game in a browser. Tick off as verified. Add notes in the "Observer notes" section when a criterion has nuance (e.g., "old-man portrait reads as painterly even at 96 px — no nearest-neighbor mush").

**How to run**: `npm run dev` from the repo root, then open the URL in a browser. F3 toggles the debug overlay (not strictly needed for portrait verification, but useful for orienting yourself).

## Asset serving

- [ ] DevTools network panel shows `/npc/old-man/portrait.png` returns 200 on first dialogue with the Old Man (verifies vite `publicDir: 'assets'` covers the new portraits) [US-56]
- [ ] DevTools network panel shows `/npc/marsh-hermit/portrait.png` returns 200 on first dialogue with the Marsh Hermit [US-56]
- [ ] DevTools console shows no Phaser warnings about texture filter mismatch or missing keys during preload [US-57]

## Old Man (Ashen Isle)

- [ ] Walk up to the Old Man, press Space (desktop) or tap (mobile). Dialogue opens with the Old Man portrait at the box's top-left, bottom edge flush with the box top [US-57]
- [ ] Speaker label "Old Man" is to the right of the portrait, not overlapping [US-57]
- [ ] Portrait stays in place across every node of the script (greeting → choice branches → continue → close) — no flicker on node transitions [US-57]
- [ ] Old Man portrait downscales smoothly — painterly brushwork visible, no nearest-neighbor mush (visual confirmation that `setFilter(LINEAR)` was applied) [US-56]
- [ ] Closing the dialogue removes the portrait from the screen — nothing left behind at depth 200 [US-57]
- [ ] Walk away → walk back → Space again. Portrait renders again — no first-time-only bug [US-57]

## Marsh Hermit (Fog Marsh)

- [ ] Walk up to the Marsh Hermit, start dialogue. Portrait appears at the box's top-left in the same anchored position [US-57]
- [ ] Speaker label "Marsh Hermit" is right of the portrait [US-57]
- [ ] Marsh Hermit portrait is pixel-art-faithful — no soft bilinear smoothing on the source pixels (verifies `nearest` filter inheritance from the global pixelArt:true) [US-56]
- [ ] Portrait stays anchored across all nodes; no flicker [US-57]
- [ ] Closing removes the portrait; reopening renders it again [US-57]

## Whispering Stones (no-portrait regression)

- [ ] Trigger the Whispering Stones dialogue on Fog Marsh. Dialogue renders with NO portrait [US-57]
- [ ] Speaker label "Whispering Stones" sits at the original top-left position (`x = s(BOX_PADDING)`); dialogue text uses the full pre-phase width [US-57]
- [ ] No console error from the missing-portrait branch [US-57]

## Mobile responsiveness

Use DevTools device emulation. Reset zoom (Cmd-0 / Ctrl-0) before measuring.

- [ ] On a 375×667 viewport (iPhone-class portrait), the Old Man portrait renders ≤ 82.5 css px wide AND its right edge does NOT cross the dialogue box's horizontal midpoint [US-57]
- [ ] On the same 375×667 viewport, the speaker name label is fully visible to the right of the portrait, not clipped by the canvas edge [US-57]
- [ ] On a 1280×720 viewport (desktop), the portrait renders at exactly 96 css px wide [US-57]
- [ ] Rotating the simulated device from portrait to landscape mid-dialogue causes the portrait to reposition + resize without leaving artefacts [US-57]
- [ ] On a touch-emulated viewport, opening a node with `choices` causes the dialogue box to grow upward AND the portrait moves up with it (bottom edge stays flush with the new `boxY`) [US-57]
- [ ] After the box collapses back to `BOX_HEIGHT` on the next non-choice node, the portrait moves back down with it [US-57]

## Variant baseline (per-NPC, end-to-end)

- [ ] **Marsh Hermit** end-to-end: portrait appears on dialogue start; pixel-art-faithful; stays anchored across all nodes; disappears on close [US-56, US-57]
- [ ] **Old Man** end-to-end: portrait appears on dialogue start; downscales smoothly (linear filter); stays anchored; disappears on close [US-56, US-57]

## Variant baseline (per-surface)

- [ ] **Desktop, no choices** (Old Man's greeting → continue): portrait + speaker label + dialogue text + continue hint all render correctly [US-57]
- [ ] **Desktop, with choices** (Old Man / Marsh Hermit dialogue node with `choices`): portrait + speaker label + choice rows; arrow-key choice navigation still works [US-57]
- [ ] **Mobile, no choices**: portrait + speaker label + dialogue text + tap-to-continue all render and behave [US-57]
- [ ] **Mobile, with choices** (browse-then-confirm): portrait stays anchored to the now-taller box top; choice rows + Confirm button still work; portrait does not overlap any choice row [US-57]
- [ ] **No-portrait fallback** (Whispering Stones): every existing visual element renders unchanged from the pre-phase baseline (side-by-side comparison or visual inspection) [US-57]

## Reads-as observer notes

For each, write a short observer phrase. Pass if the phrase matches the spec target ("the NPC is looking at me / their face is up there with their line"). Fail if it sounds like "there's a small picture in the corner" or "I couldn't tell whose face that is".

- [ ] **Old Man portrait reads-as**: ____________________________________________________ [US-57]
- [ ] **Marsh Hermit portrait reads-as**: ______________________________________________ [US-57]
- [ ] **Anchored, not floating, reads-as** (for at least one NPC): ____________________ [US-57]

## Error path / DEV check

Mistype a `portraitId` in `src/data/areas/ashen-isle.ts` (e.g. `'old-mna'`), reload, open the Old Man dialogue. Then revert the typo.

- [ ] Console logs `Dialogue portrait id not in registry: old-mna` (or similar registry-miss error) [US-57]
- [ ] Dialogue renders without a portrait but otherwise behaves normally — no crash, no white box, full text width [US-57]

## Smoke run (60 seconds)

- [ ] Open Old Man dialogue, walk through every node + a choice branch, close. Open Marsh Hermit dialogue, same. Trigger Whispering Stones, complete it. Transition between Ashen Isle and Fog Marsh. No console errors or warnings during the entire run [phase]

## Deploy verification (post-merge)

- [ ] After squash-merge to main, the GitHub Pages deploy workflow shows a green check on the merge commit (Learning #65) [phase]

---

## Observer notes

(Add free-form notes during verification — anything that surprised you, anything that needs follow-up.)

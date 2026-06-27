# Audio feel: make the most-played SFX sound like *movement*, and source real music

**Context:** F5 audio layer (#200) + the FB-25 rework (#206). Two pieces of audio
were rejected twice by ear before they landed, and the fixes are non-obvious enough
to capture.

## 1. The most-played SFX must sound like a *texture*, not an *event*

The footstep is played constantly, so any "event" character (an onset, a pitch, a
thud) becomes maddening fast. Two rejected attempts and why:

- **v1 — a short tone/blip.** Read as "an arcade shooting blip." Anything with a
  pitch reads as a deliberate signal, not as movement.
- **v2 — brown noise + lowpass ~480Hz.** Read as "someone banging on a door." A
  low-frequency band with a hard fade-in is an *impact* — a boom with an onset.

What worked: stop sounding a "step" at all and sound **movement** — a faint cloth/
grass swish (pillow-fluff / grass-flothing / soft hiss). Recipe (see
`scripts/gen-audio.sh`):

- **pink noise**, not brown — no DC/low-frequency thump to "bang."
- **band-pass 700–3600 Hz** — the "shhh" band of cloth/grass; nothing low enough
  to read as an impact.
- **triangular in/out fades**, no sharp transient → a smooth swell (swish), not a hit.
- a slow **tremolo** for the brushing/"flothing" motion rather than a single tick.
- keep it **very faint**; the per-play app volume (0.16) faints it further.

General rule: for a sound that fires on a tight loop, design the *texture* and kill
the *transient*. Onsets and pitches are for events the player should notice once.

## 2. Don't synthesize ambient music — source real, vibe-matched loops

Synthesized sine "pads" for map beds read as a **"creepy alien hum"** in every map.
Ambient music needs real timbral richness; additive sines don't have it.

- **Sourcing:** CC0 first (no attribution) — but FreePD is shutting down and Pixabay
  is bot-blocked / un-fetchable headless. **Incompetech (Kevin MacLeod) CC-BY 4.0**
  works and is browsable: `https://incompetech.com/music/royalty-free/mp3-royaltyfree/<Title>.mp3`
  (`%20` for spaces). CC-BY needs exactly **one attribution line** — put it on the
  credits/reveal screen (a faint, low-contrast footer), never in-game.
- **One mood per map**, picked by vibe, not by name.

## 3. Seamless looping: tail-over-head crossfade (no audible wrap seam)

A naive cut loops with a click at the wrap. Build the loop so the wrap sample is
guaranteed to match:

- cut a segment a little longer than the loop (e.g. 56s for a 48s loop);
- `body = [0:48]` fades **in**, `tail = [48:56]` (the real continuation) fades
  **out**, both mixed from t=0. The loop's end sample then equals its start sample,
  so the join is inaudible.
- `loudnorm` every track to the same target so no map is louder than another.

## 4. NPC sounds reuse the player's SFX, faded by proximity, capped below the player

NPC footsteps reuse the *same* footstep asset, attenuated by distance to the player
and **hard-capped below the player's own footstep volume** — the player's own
movement must always be the loudest, or the world feels louder than you.

## 5. GATE-2 for audio = capture the *real in-engine mix*, not an asset montage

An asset montage proves the files exist; it doesn't prove what the player hears.
Capture the actual game mix by tapping the WebAudio master gain (Playwright +
`addInitScript` patch over `AudioContext`), mixing the tapped contexts with the
canvas video, → webm → **mp4** (renders inline in Telegram; clearer than gif).
Keep a labeled tour too, but the in-engine slice is the honest artifact.

**Reproducibility:** `scripts/gen-audio.sh` regenerates the entire bed (music fetch
+ seamless loop + every SFX) from ffmpeg; re-run it to change any sound.

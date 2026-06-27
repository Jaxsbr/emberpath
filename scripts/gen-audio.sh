#!/usr/bin/env bash
# gen-audio.sh — regenerates emberpath's entire audio bed with ffmpeg.
#
# F5 (#200) / FB-25 rework.
#
# MUSIC (FB-25, Jaco #1308/#1310): the synthesized sine-pad beds read as a "creepy
# alien hum", so music is now SOURCED from a real library, one vibe-matched track per
# map. Jaco's pick was "a and b, whichever provides options"; CC0 (FreePD) is shutting
# down and Pixabay isn't fetchable headless, so the working library is Incompetech
# (Kevin MacLeod) — CC-BY 4.0. That license requires ONE attribution line, which lives
# on the in-game credits/reveal screen (see CREDITS_MUSIC in src). Each track is fetched,
# a stable segment is cut, and a seamless loop is built (see make_loop) so it tiles under
# the engine's buffer loop=true with no wrap seam. Tracks (CC-BY 4.0, Kevin MacLeod,
# incompetech.com), one mood per map:
#   ashen-isle   — "Wounded"      (soft melancholy, the drained grey start)
#   fog-marsh    — "Long Note Two" (low muted ambient drone, doubt in the marsh)
#   briar-wilds  — "Light Awash"   (shimmering but hopeful, thorns carrying the light)
#   heart-bridge — "Heartwarming"  (warm, full — home / the finale)
#
# SFX stay SYNTHESIZED here (genuinely original, CC0, no attribution) and reproducible.
#
# Requires: ffmpeg with libmp3lame + network (for the music fetch). Usage: bash scripts/gen-audio.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MUS="$ROOT/assets/sounds/music"
SFX="$ROOT/assets/sounds/sfx"
mkdir -p "$MUS" "$SFX"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

enc() { ffmpeg -y -i "$1" -c:a libmp3lame -b:a 96k -ac 1 "$2" 2>/dev/null; }

# --- music beds ---------------------------------------------------------------
# Fetch one CC-BY track, cut a 56s segment from <ss>, and build a SEAMLESS 48s loop.
# Seam trick (tail-over-head): the real continuation tail [48:56] fades OUT while the
# body [0:48] fades IN, mixed from t=0 — so the loop's wrap sample equals the body-end
# sample and the join is inaudible. loudnorm pins every map to a consistent faint level.
IC="https://incompetech.com/music/royalty-free/mp3-royaltyfree"
make_loop() {
  local title="$1" ss="$2" out="$3"
  local url="$IC/$(echo "$title" | sed 's/ /%20/g').mp3"
  curl -s -A "Mozilla/5.0" "$url" -o "$TMP/src.mp3"
  ffmpeg -y -ss "$ss" -t 56 -i "$TMP/src.mp3" -ar 44100 -ac 2 "$TMP/seg.wav" 2>/dev/null
  ffmpeg -y -i "$TMP/seg.wav" -filter_complex "\
[0:a]atrim=0:48,asetpts=N/SR/TB,afade=t=in:d=8:curve=tri[body];\
[0:a]atrim=48:56,asetpts=N/SR/TB,afade=t=out:d=8:curve=tri[tail];\
[body][tail]amix=inputs=2:normalize=0:duration=first[m];\
[m]loudnorm=I=-22:TP=-2.5:LRA=11[o]" -map "[o]" -ar 44100 -ac 2 "$TMP/loop.wav" 2>/dev/null
  ffmpeg -y -i "$TMP/loop.wav" -c:a libmp3lame -b:a 112k -ac 2 "$out" 2>/dev/null
  echo "  music: $(basename "$out") ($(du -h "$out" | cut -f1)) <- CC-BY \"$title\" (K. MacLeod)"
}

echo "Sourcing music beds (Incompetech CC-BY, seamless-looped)..."
make_loop "Wounded"        30  "$MUS/ashen-isle.mp3"
make_loop "Long Note Two"  60  "$MUS/fog-marsh.mp3"
make_loop "Light Awash"    120 "$MUS/briar-wilds.mp3"
make_loop "Heartwarming"   8   "$MUS/heart-bridge.mp3"

# --- SFX ----------------------------------------------------------------------
echo "Generating SFX..."

# footstep — NOT an impact. FB-25 round 1 (a brown-noise thud, lowpass 480) read as
# "someone banging on a door" — a low boom with a hard onset. Jaco's steer: this is the
# most-played SFX, so don't sound a "step" at all — sound MOVEMENT. A very faint texture
# that passes as motion: pillow-fluff / grass-swish / soft hiss. Recipe:
#   • pink noise (natural, no DC boom) instead of brown — kills the low-frequency thump
#   • band-pass 700–3600Hz — the "shhh" band of cloth/grass; nothing low enough to bang
#   • triangular in/out fades (no sharp transient) → a smooth swell, a swish not a hit
#   • a slow tremolo gives it the "flothing"/brushing motion rather than a single tick
#   • kept very faint; the per-play app volume (FOOTSTEP_VOLUME 0.16) faints it further.
ffmpeg -y -f lavfi -i "anoisesrc=d=0.24:c=pink:a=0.5" \
  -af "highpass=f=700,lowpass=f=3600,tremolo=f=12:d=0.4,afade=t=in:st=0:d=0.07:curve=tri,afade=t=out:st=0.10:d=0.14:curve=tri,volume=0.34" -ar 44100 -ac 1 "$TMP/s.wav" 2>/dev/null
enc "$TMP/s.wav" "$SFX/footstep.mp3"

# thought — a soft single bell twinkle (E6 + a faint octave shimmer), gentle attack
# and a long exponential decay. Played (debounced) when Pip has a thought (FB-25).
ffmpeg -y -f lavfi -i "sine=frequency=1318.51:duration=0.9" -f lavfi -i "sine=frequency=2637.02:duration=0.9" \
  -filter_complex "[0:a]volume=0.5[a];[1:a]volume=0.16[b];[a][b]amix=inputs=2:normalize=0[m];[m]afade=t=in:d=0.01,afade=t=out:st=0.12:d=0.78:curve=exp,aecho=0.8:0.85:55:0.22,volume=1.1[o]" \
  -map "[o]" -ar 44100 -ac 1 "$TMP/s.wav" 2>/dev/null
enc "$TMP/s.wav" "$SFX/thought.mp3"

# scribble — faint pen tick for the typewriter
ffmpeg -y -f lavfi -i "anoisesrc=d=0.025:c=white:a=0.3" \
  -af "highpass=f=1500,lowpass=f=4500,afade=t=out:st=0.01:d=0.015,volume=0.3" -ar 44100 -ac 1 "$TMP/s.wav" 2>/dev/null
enc "$TMP/s.wav" "$SFX/scribble.mp3"

# choice — gentle soft sine pluck (D5)
ffmpeg -y -f lavfi -i "sine=frequency=587.33:duration=0.18" \
  -af "afade=t=in:st=0:d=0.005,afade=t=out:st=0.05:d=0.13,volume=0.45" -ar 44100 -ac 1 "$TMP/s.wav" 2>/dev/null
enc "$TMP/s.wav" "$SFX/choice.mp3"

# first-meet — a small warm rising two-note chime (C5 -> G5)
ffmpeg -y -f lavfi -i "sine=frequency=523.25:duration=0.5" -f lavfi -i "sine=frequency=783.99:duration=0.5" \
  -filter_complex "[0:a]afade=t=in:d=0.005,afade=t=out:st=0.12:d=0.18,volume=0.4[a];[1:a]adelay=140|140,afade=t=out:st=0.3:d=0.2,volume=0.4[b];[a][b]amix=inputs=2:normalize=0,aecho=0.8:0.85:50:0.2,volume=1.4[o]" \
  -map "[o]" -ar 44100 -ac 1 "$TMP/s.wav" 2>/dev/null
enc "$TMP/s.wav" "$SFX/first-meet.mp3"

# milestone — soft warm bell (G4 + octave + fifth), exp decay
ffmpeg -y -f lavfi -i "sine=frequency=392:duration=1.1" -f lavfi -i "sine=frequency=784:duration=1.1" -f lavfi -i "sine=frequency=1176:duration=1.1" \
  -filter_complex "[0:a]volume=0.5[a];[1:a]volume=0.28[b];[2:a]volume=0.14[c];[a][b][c]amix=inputs=3:normalize=0[m];[m]afade=t=in:d=0.004,afade=t=out:st=0.15:d=0.92:curve=exp,aecho=0.8:0.85:60:0.25,volume=1.6[o]" \
  -map "[o]" -ar 44100 -ac 1 "$TMP/s.wav" 2>/dev/null
enc "$TMP/s.wav" "$SFX/milestone.mp3"

# complete — a soft warm C-major arpeggio swell (the game-complete moment)
ffmpeg -y \
  -f lavfi -i "sine=frequency=261.63:duration=2.2" \
  -f lavfi -i "sine=frequency=329.63:duration=2.2" \
  -f lavfi -i "sine=frequency=392.00:duration=2.2" \
  -f lavfi -i "sine=frequency=523.25:duration=2.2" \
  -filter_complex "[0:a]adelay=0|0,volume=0.4[a];[1:a]adelay=200|200,volume=0.36[b];[2:a]adelay=400|400,volume=0.32[c];[3:a]adelay=600|600,volume=0.28[d];[a][b][c][d]amix=inputs=4:normalize=0[m];[m]afade=t=out:st=1.2:d=1.0,lowpass=f=2200,aecho=0.8:0.85:90:0.3,volume=2.0[o]" \
  -map "[o]" -ar 44100 -ac 1 "$TMP/s.wav" 2>/dev/null
enc "$TMP/s.wav" "$SFX/complete.mp3"

for f in footstep thought scribble choice first-meet milestone complete; do
  echo "  sfx: $f.mp3 ($(du -h "$SFX/$f.mp3" | cut -f1))"
done
echo "Done. All audio under assets/sounds/."

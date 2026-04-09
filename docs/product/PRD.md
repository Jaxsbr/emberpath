# Emberpath — Product Requirements Document

> Product index. Vision and feature overview live here. Phase-level detail lives in `phases/`. See `docs/master-prd.md` for the full creative vision, story framework, and art pipeline.

## Vision

An allegorical journey game that shares the gospel with kids (and adults) through interactive storytelling. The player controls a character on a top-down world, explores locations, interacts with NPCs, and experiences story scenes that allegorically present the gospel message.

## Target Audience

- Primary: Kids aged 6-12
- Secondary: Adults who enjoy story-driven indie games
- Context: Something a parent, pastor, or children's ministry leader could share

## Core Mechanics

1. **Top-down exploration** — mobile-first touch controls (virtual joystick) + desktop fallback (WASD)
2. **NPC interaction** — walk up and talk, inline dialogue system with typewriter effect
3. **Story scenes** — full-screen illustrated cutscenes triggered by world interaction
4. **Area transitions** — walk to exits, fade between tile maps
5. **Progress system** — flag-based story progression in localStorage

## POC Scope

Beats 1 & 2 only:
- Area 1: Ashen Isle (exploration, NPC dialogue, story scene trigger)
- Area 2: Fog Marsh (dead-end mechanic, rescue story scene)
- Credits: "The Story Behind the Story" with resource links

## Technical Stack

Phaser 3 + TypeScript + Vite, systems-based entity architecture, mobile-first responsive scaling, GitHub Pages deployment, localStorage for progress.

## Implementation Phases

| Phase | Status | Stories | Spec |
|---|---|---|---|
| foundation | Shipped | US-01, US-02, US-03, US-04, US-05 | [phases/foundation.md](phases/foundation.md) |
| interaction | Shipped | US-06, US-07, US-08, US-09, US-10 | [phases/interaction.md](phases/interaction.md) |

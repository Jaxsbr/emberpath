import { describe, it, expect } from 'vitest';
import {
  END_PAGE_MODEL,
  JESUS_FILM_URL,
  DISCIPLESHIP_URL,
  BIBLE_APP_URL,
} from '../src/ui/endPageModel';

// F2 — end-of-game page (#198). The page is the game's "reveal at credits" surface
// (biblical-guidance.md): the in-game story stays allegorical and never names Jesus,
// but this end page carries the explicit gospel. These guard the CONTENT model
// (Phaser-free, node-testable) so the tract text, the Jesus Film link, and the
// no-invented-links rule can't silently regress. Taste per Jaco #1254: structure a
// (one gentle scroll), gospel b (plainest single-card tract, no allegory recap),
// video b (button-only link to the Jesus Film watch page).

describe('end page model', () => {
  it('greets with the agreed header and subtitle', () => {
    expect(END_PAGE_MODEL.header).toBe('Thank you for playing');
    expect(END_PAGE_MODEL.subtitle).toBe('Pip has found his home.');
  });

  it('carries a plainest-tract gospel that names Jesus (the reveal surface)', () => {
    expect(END_PAGE_MODEL.gospel.length).toBeGreaterThanOrEqual(2);
    const full = END_PAGE_MODEL.gospel.join(' ');
    expect(full).toMatch(/\bJesus\b/);
    // Plainest tract: keep it short — a single card, not a sermon.
    expect(END_PAGE_MODEL.gospel.length).toBeLessThanOrEqual(5);
  });

  it('offers the three resource buttons as real, exact links (#1266)', () => {
    // Primary CTA — the discipleship page.
    const follow = END_PAGE_MODEL.links.find((l) => l.id === 'follow-jesus');
    expect(follow).toBeDefined();
    expect(follow!.variant).toBe('primary');
    expect(follow!.href).toBe(DISCIPLESHIP_URL);
    expect(follow!.href).toBe('https://www.jesusfilm.org/watch/discipleship.html/english.html');
    expect(follow!.pending).toBeFalsy();

    // Watch videos — the existing Jesus Film watch page (video b).
    const film = END_PAGE_MODEL.links.find((l) => l.id === 'jesus-film');
    expect(film).toBeDefined();
    expect(film!.href).toBe(JESUS_FILM_URL);
    expect(film!.href).toBe('https://www.jesusfilm.org/watch/jesus.html/english.html');
    expect(film!.pending).toBeFalsy();

    // Download a Bible — the YouVersion app.
    const bible = END_PAGE_MODEL.links.find((l) => l.id === 'download-bible');
    expect(bible).toBeDefined();
    expect(bible!.href).toBe(BIBLE_APP_URL);
    expect(bible!.href).toBe('https://www.bible.com/app');
    expect(bible!.pending).toBeFalsy();
  });

  it('never invents a link — every non-action link has a real URL, no pending placeholders', () => {
    for (const link of END_PAGE_MODEL.links) {
      if (link.pending) expect(link.href).toBeNull();
      if (link.href !== null && !link.action) expect(link.pending).toBeFalsy();
    }
    // Jaco supplied all three resource URLs (#1266) → there is no pending placeholder.
    expect(END_PAGE_MODEL.links.some((l) => l.pending)).toBe(false);
  });

  it('gives the player a way off the closing screen (no dead end)', () => {
    const restart = END_PAGE_MODEL.links.find((l) => l.action === 'restart');
    expect(restart).toBeDefined();
  });
});

import { describe, it, expect } from 'vitest';
import { END_PAGE_MODEL, JESUS_FILM_URL } from '../src/ui/endPageModel';

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

  it('offers the Jesus Film watch page as a real, exact link (video b)', () => {
    const film = END_PAGE_MODEL.links.find((l) => l.id === 'jesus-film');
    expect(film).toBeDefined();
    expect(film!.href).toBe(JESUS_FILM_URL);
    expect(film!.href).toBe('https://www.jesusfilm.org/watch/jesus.html/english.html');
    expect(film!.pending).toBeFalsy();
  });

  it('never invents a link — pending links carry no URL', () => {
    for (const link of END_PAGE_MODEL.links) {
      if (link.pending) expect(link.href).toBeNull();
      if (link.href !== null && !link.action) expect(link.pending).toBeFalsy();
    }
    // "Learn more" ministry URLs are not yet provided by Jaco → must be pending.
    const learn = END_PAGE_MODEL.links.find((l) => l.id === 'learn-more');
    expect(learn).toBeDefined();
    expect(learn!.pending).toBe(true);
    expect(learn!.href).toBeNull();
  });

  it('gives the player a way off the closing screen (no dead end)', () => {
    const restart = END_PAGE_MODEL.links.find((l) => l.action === 'restart');
    expect(restart).toBeDefined();
  });
});

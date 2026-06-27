// F2 — end-of-game page (#198). The CONTENT model, kept Phaser-free and DOM-free so
// it is node-testable (test/end-page.test.ts) and the renderer (endPage.ts) stays a
// thin view over it.
//
// This page is the game's "reveal at credits" surface (biblical-guidance.md): the
// in-game story stays allegorical and never names Jesus, but HERE the gospel is
// explicit. Taste locked by Jaco #1254: structure a (one gentle scroll, warm ember
// palette + soft serif matching the title), gospel b (the plainest single-card
// tract-style gospel — no allegory recap), video b (a button-only link to the Jesus
// Film watch page, no embedded player).
//
// Resource buttons set by Jaco #1266 (mimicking a reference three-button layout):
// (1) Learn how to follow Jesus → the Jesus Film discipleship page, (2) Watch videos
// about Jesus → the existing watch page, (3) Download a Bible → the YouVersion app.
// All are real URLs Jaco supplied, so there is no longer a pending placeholder.

/** The Jesus Film watch page Jaco supplied (#1254) — the "watch videos" surface (video b). */
export const JESUS_FILM_URL = 'https://www.jesusfilm.org/watch/jesus.html/english.html';

/** The Jesus Film discipleship page (#1266) — "learn how to follow Jesus", the primary CTA. */
export const DISCIPLESHIP_URL = 'https://www.jesusfilm.org/watch/discipleship.html/english.html';

/** The YouVersion Bible app (#1266) — "download a Bible". */
export const BIBLE_APP_URL = 'https://www.bible.com/app';

export interface EndPageLink {
  id: string;
  label: string;
  /** Destination URL, or null when it is a placeholder / an internal action. */
  href: string | null;
  /** A ministry/resource URL Jaco has not yet provided — rendered disabled, never invented. */
  pending?: boolean;
  /** An internal action instead of navigation (e.g. 'restart' returns to the title). */
  action?: 'restart';
  /** A right-aligned glyph (per the #1266 reference); purely decorative, mapped to an SVG in the view. */
  icon?: 'discipleship' | 'play' | 'bible';
  variant: 'primary' | 'secondary' | 'ghost';
}

export interface EndPageModel {
  header: string;
  subtitle: string;
  /** The single tract card, one short paragraph per entry. Names Jesus (the reveal). */
  gospel: string[];
  /** A soft closing line, echoing the title screen's tagline as a bookend. */
  closing: string;
  links: EndPageLink[];
}

export const END_PAGE_MODEL: EndPageModel = {
  header: 'Thank you for playing',
  subtitle: 'Pip has found his home.',
  gospel: [
    "Pip's story is a picture of a true one.",
    'God made you, and He loves you. But all of us have done wrong, and our wrong puts us far from Him — like a light gone dark.',
    'So God’s own Son, Jesus, came to us. He lived, He died in our place, and He rose again — to carry us home to God.',
    'Like the King who waited at the bridge, He is waiting for you. Turn to Him and trust Him, and He will welcome you home. For always.',
  ],
  closing: 'Carry the light home.',
  links: [
    {
      // Primary CTA (filled) — the next step after the reveal: how to actually follow Him.
      id: 'follow-jesus',
      label: 'Learn how to follow Jesus',
      href: DISCIPLESHIP_URL,
      icon: 'discipleship',
      variant: 'primary',
    },
    {
      id: 'jesus-film',
      label: 'Watch videos about Jesus',
      href: JESUS_FILM_URL,
      icon: 'play',
      variant: 'secondary',
    },
    {
      id: 'download-bible',
      label: 'Download a Bible',
      href: BIBLE_APP_URL,
      icon: 'bible',
      variant: 'secondary',
    },
    {
      id: 'restart',
      label: 'Return to the start',
      href: null,
      action: 'restart',
      variant: 'ghost',
    },
  ],
};

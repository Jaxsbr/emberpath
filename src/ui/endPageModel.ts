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

/** The Jesus Film watch page Jaco supplied (#1254) — the only video surface (video b). */
export const JESUS_FILM_URL = 'https://www.jesusfilm.org/watch/jesus.html/english.html';

export interface EndPageLink {
  id: string;
  label: string;
  /** Destination URL, or null when it is a placeholder / an internal action. */
  href: string | null;
  /** A ministry/resource URL Jaco has not yet provided — rendered disabled, never invented. */
  pending?: boolean;
  /** An internal action instead of navigation (e.g. 'restart' returns to the title). */
  action?: 'restart';
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
      id: 'jesus-film',
      label: 'Watch the story of Jesus',
      href: JESUS_FILM_URL,
      variant: 'primary',
    },
    {
      // Ministry "Learn more" resources — Jaco has not provided the URL(s) yet, so this
      // stays a disabled placeholder. We never invent a link; the renderer hides or
      // disables a pending link until a real href is set here.
      id: 'learn-more',
      label: 'Learn more',
      href: null,
      pending: true,
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

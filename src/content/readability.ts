// Readability scoring for player-facing text (F3, #199). The North-Star bar is a
// young child reading aloud (Jaco's daughter): short sentences, common concrete
// words, one idea at a time, allegory preserved. This module is the objective
// floor under that goal — it cannot judge meaning or allegory (that stays a human
// read), but it CAN catch the two mechanical failure modes a child reader hits:
// sentences that run too long, and a Flesch–Kincaid grade above early-reader level.
//
// Pure + dependency-free so it runs under the node (no-jsdom) vitest env and can
// be reused by any future content tooling. See
// docs/solutions/content/reading-level-young-child.md.

export interface SentenceScore {
  sentence: string;
  words: number;
}

export interface TextScore {
  text: string;
  /** Flesch–Kincaid grade level for the whole string. */
  grade: number;
  /** Word count of the single longest sentence. */
  maxSentenceWords: number;
  sentences: SentenceScore[];
  syllables: number;
  words: number;
}

// Count vowel groups as a syllable proxy, with the usual silent-e and minimum-one
// corrections. Not perfect (English never is) but stable and good enough to rank
// text by difficulty and drive a grade estimate.
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length === 0) return 0;
  if (w.length <= 3) return 1;
  let trimmed = w.replace(/e$/, '');
  // keep "le" ending as a syllable (e.g. "little" -> li-ttle)
  if (/[^aeiou]le$/.test(w)) trimmed = w;
  const groups = trimmed.match(/[aeiouy]+/g);
  let n = groups ? groups.length : 0;
  if (n === 0) n = 1;
  return n;
}

// Split on sentence-ending punctuation AND on newlines (authors use "\n" to break
// a multi-line thought/beat into separate lines — each line reads as its own
// sentence to a child, so each must stand on its own).
export function splitSentences(text: string): string[] {
  return text
    .split(/\n+|(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function countWords(text: string): string[] {
  const m = text.match(/[A-Za-z][A-Za-z'’-]*/g);
  return m ?? [];
}

export function scoreText(text: string): TextScore {
  const sentences = splitSentences(text);
  let totalWords = 0;
  let totalSyll = 0;
  let maxSentenceWords = 0;
  const sentenceScores: SentenceScore[] = [];
  for (const s of sentences) {
    const words = countWords(s);
    totalWords += words.length;
    for (const w of words) totalSyll += countSyllables(w);
    if (words.length > maxSentenceWords) maxSentenceWords = words.length;
    sentenceScores.push({ sentence: s, words: words.length });
  }
  const numSentences = Math.max(sentences.length, 1);
  const safeWords = Math.max(totalWords, 1);
  // Flesch–Kincaid grade level.
  const grade =
    0.39 * (safeWords / numSentences) + 11.8 * (totalSyll / safeWords) - 15.59;
  return {
    text,
    grade: Math.round(grade * 100) / 100,
    maxSentenceWords,
    sentences: sentenceScores,
    syllables: totalSyll,
    words: totalWords,
  };
}

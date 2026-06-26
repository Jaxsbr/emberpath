import { describe, it, expect } from 'vitest';
import { getAllAreaIds, getArea } from '../src/data/areas/registry';
import { extractAreaPlayerText } from '../src/content/extractPlayerText';
import { scoreText, countSyllables, splitSentences } from '../src/content/readability';

// F3 (#199): a permanent regression guard that locks the young-child reading level
// across all area text. A prior North-Star pass (id=68 #3) already brought the game
// down to early-reader level; this test keeps it there — any future line that runs
// long or climbs above early-reader grade fails CI before it can ship.
//
// Thresholds reflect the measured reality (whole game today: longest real sentence
// 14 words, hardest real prose grade ~5.2). The caps sit just above that so the
// current text passes but a genuine regression (a long, multi-clause, or abstract
// sentence) trips the guard. Short UI labels / proper-noun signposts are excluded
// from the GRADE check (Flesch–Kincaid is unreliable on 2–3 word fragments) but
// still bound by the sentence-length cap.

const MAX_SENTENCE_WORDS = 16;
const MAX_GRADE = 6.0;
const MIN_WORDS_FOR_GRADE = 5; // FK is noise below this; labels live here

function isLabel(path: string): boolean {
  return path.endsWith('.label') || path.includes('.signposts[');
}

describe('readability module', () => {
  it('counts syllables sanely', () => {
    expect(countSyllables('light')).toBe(1);
    expect(countSyllables('ember')).toBe(2);
    expect(countSyllables('remember')).toBe(3);
    expect(countSyllables('little')).toBe(2);
    expect(countSyllables('a')).toBe(1);
  });

  it('splits on newlines and sentence punctuation', () => {
    expect(splitSentences('One thing.\nAnother thing. And more!')).toEqual([
      'One thing.',
      'Another thing.',
      'And more!',
    ]);
  });

  it('grades a simple kid sentence low and a complex one high', () => {
    expect(scoreText('The light is warm.').grade).toBeLessThan(MAX_GRADE);
    expect(
      scoreText(
        'Notwithstanding the considerable adversity, the protagonist persevered indefatigably.',
      ).grade,
    ).toBeGreaterThan(MAX_GRADE);
  });
});

describe('all player-facing area text reads at a young-child level', () => {
  const strings = getAllAreaIds().flatMap((id) =>
    extractAreaPlayerText(getArea(id)!),
  );

  it('extracts a non-trivial amount of text (guard is actually running)', () => {
    expect(strings.length).toBeGreaterThan(100);
  });

  it('keeps every sentence short', () => {
    const tooLong = strings
      .map((s) => ({ ...s, score: scoreText(s.text) }))
      .filter((s) => s.score.maxSentenceWords > MAX_SENTENCE_WORDS)
      .map((s) => `[${s.score.maxSentenceWords}w] ${s.path}: "${s.text}"`);
    expect(tooLong, `sentences over ${MAX_SENTENCE_WORDS} words:\n${tooLong.join('\n')}`).toEqual([]);
  });

  it('keeps every prose line at early-reader grade', () => {
    const tooHard = strings
      .filter((s) => !isLabel(s.path))
      .map((s) => ({ ...s, score: scoreText(s.text) }))
      .filter((s) => s.score.words >= MIN_WORDS_FOR_GRADE && s.score.grade > MAX_GRADE)
      .map((s) => `[g${s.score.grade}] ${s.path}: "${s.text}"`);
    expect(tooHard, `lines above grade ${MAX_GRADE}:\n${tooHard.join('\n')}`).toEqual([]);
  });
});

describe('inscribed-stone remembered lines hold one steady voice (F3 #199 coherence)', () => {
  // The defect this guards: a stone slipping BETWEEN first-person and third-person
  // self-reference. The Briar stone used to read "Pip remembers… / I am not alone…
  // / Her little ember…" — 3rd→1st→3rd, which reads as two narrators arguing over
  // one voice. A stone may speak in the first person (Pip remembering: "I/my") OR
  // be narrated/address her ("Pip…", "You were known…"), but must not mix the
  // first-person and third-person SELF references together.
  const stones = getAllAreaIds().flatMap((id) =>
    (getArea(id)!.inscribedStones ?? []).map((s) => ({ areaId: id, stone: s })),
  );

  it('has stones to check', () => {
    expect(stones.length).toBeGreaterThan(0);
  });

  for (const { areaId, stone } of stones) {
    it(`${areaId}/${stone.id} does not flip between first- and third-person self-reference`, () => {
      const joined = stone.rememberedLines.join(' ');
      const firstPerson = /\b(I|I'm|I've|my|me|mine|myself)\b/.test(joined);
      const thirdPersonSelf = /\b(Pip|she|her|hers|herself)\b/i.test(joined);
      expect(
        firstPerson && thirdPersonSelf,
        `remembered lines mix first- and third-person voice:\n${stone.rememberedLines.join('\n')}`,
      ).toBe(false);
    });
  }
});

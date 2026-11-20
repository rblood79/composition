/**
 * ADR-315 Phase 3 (사용자 결정 2 — 「표마다 선택」) — a Table search's fuzzy match: how well a cell's
 * text matches the search, as a grade (TanStack `match-sorter-utils` `rankings` — the grades its
 * `fuzzy` filter stores to sort by).
 *
 * | grade | the cell …                                                        |
 * | ----- | ----------------------------------------------------------------- |
 * | 0     | is the search                                                     |
 * | 1     | begins with it                                                    |
 * | 2     | has a word beginning with it                                      |
 * | 3     | contains it                                                       |
 * | 4     | has it in its words' first letters (`nyc` — New York City)        |
 * | 5     | has its letters in order, apart (`plgnd` — playground)            |
 *
 * Grades 0 ~ 3 are the comparison table's (`viewCompare` — the search collator: `각가` is `가까`),
 * and they are all a `contains`: a cell that does not contain the search is not graded 0 ~ 2.
 * Grades 4 · 5 read the texts as units — a letter each: plain text by the collator's own fold, a
 * Hangul syllable as its letters (`강` = `ㄱ` `ㅏ` `ㅇ`), a compatibility jamo as that letter — so a
 * syllable being typed (`간` on the way to `가나`) and initial consonants (`ㄱㄴ`) find `가나`.
 * Where the cell and the search are plain text the collator folds as the units do, a cell of any
 * grade has the search's units in order (a `contains` there is a folded `includes`) — the one case
 * `viewFuzzyMisses` is a certain answer in (`rowFilter.ts` asks it nowhere else).
 */
import { viewCompare, viewPlainFold } from "./comparison";
import type { ViewCondition } from "../../catalog/document/types";

/** The grade of no match. */
export const VIEW_FUZZY_NO_MATCH = -1;
/** The grades, best first (`VIEW_FUZZY_GRADES[grade]`). */
export const VIEW_FUZZY_GRADES = [
  "equal",
  "startsWith",
  "wordStartsWith",
  "contains",
  "acronym",
  "scattered",
] as const;

const HANGUL_FIRST = 0xac00;
const HANGUL_LAST = 0xd7a3;
/** A syllable's leading consonant · final consonant as its compatibility jamo (the unit's id). */
const LEADS = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const TAILS = " ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ";
/** The first vowel's compatibility jamo (`ㅏ` — the 21 vowels follow in the syllables' order). */
const VOWEL_FIRST = 0x314f;

/** A search as the grades read it (made once a search — `viewFuzzySearch`). */
export interface ViewFuzzySearch {
  readonly text: string;
  readonly units: Int32Array;
  readonly locale: string | undefined;
  readonly sensitivity: ViewCondition["sensitivity"];
  /** Plain text folds case-less (the collator's — else as written). */
  readonly lower: boolean;
}

/** `text`'s units written into `out` from `at`; the place after the last. */
function writeUnits(
  out: Int32Array,
  at: number,
  text: string,
  lower: boolean,
): number {
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code < 0x80) {
      out[at++] = lower && code >= 0x41 && code <= 0x5a ? code + 0x20 : code;
    } else if (code >= HANGUL_FIRST && code <= HANGUL_LAST) {
      const place = code - HANGUL_FIRST;
      out[at++] = LEADS.charCodeAt((place / 588) | 0);
      out[at++] = VOWEL_FIRST + (((place % 588) / 28) | 0);
      const tail = place % 28;
      if (tail) out[at++] = TAILS.charCodeAt(tail);
    } else out[at++] = code;
  }
  return at;
}

/** A text's units (a syllable is three at most). */
function unitsOf(text: string, lower: boolean): Int32Array {
  const out = new Int32Array(text.length * 3);
  return out.subarray(0, writeUnits(out, 0, text, lower));
}

/** The scratch a cell's units are written to (one cell at a time). */
let scratch = new Int32Array(256);
function cellUnits(text: string, lower: boolean): number {
  if (scratch.length < text.length * 3)
    scratch = new Int32Array(text.length * 3 + 64);
  return writeUnits(scratch, 0, text, lower);
}

/**
 * The spread of `search` among the first `count` units of the scratch — the units from its first
 * to its last, taken greedily in order; −1 = they are not all there in order.
 */
function spreadOf(search: Int32Array, count: number): number {
  let first = -1;
  let at = 0;
  for (let index = 0; index < search.length; index += 1) {
    const wanted = search[index]!;
    while (at < count && scratch[at] !== wanted) at += 1;
    if (at === count) return -1;
    if (first < 0) first = at;
    at += 1;
  }
  return first < 0 ? 0 : at - first;
}

const WORD_BREAK = /[\s\-_./,;:()[\]{}'"|]+/;

export function viewFuzzySearch(
  text: string,
  locale?: string,
  sensitivity?: ViewCondition["sensitivity"],
): ViewFuzzySearch {
  const lower = viewPlainFold(locale, sensitivity) !== "same";
  return { text, units: unitsOf(text, lower), locale, sensitivity, lower };
}

/**
 * Whether a cell's units do not hold the search's in order. For plain text under a collator that
 * folds it as the units do (the caller's check) that is no match of any grade.
 */
export function viewFuzzyMisses(
  cell: string,
  search: ViewFuzzySearch,
): boolean {
  return spreadOf(search.units, cellUnits(cell, search.lower)) < 0;
}

/**
 * A cell's grade and, within it, how far apart the match is: `grade * 4096 + spread` (a smaller
 * number is a better match); `VIEW_FUZZY_NO_MATCH` = none. An empty search matches every cell.
 */
export function viewFuzzyRank(cell: string, search: ViewFuzzySearch): number {
  if (!search.text.length) return 3 * 4096;
  const options = {
    kind: "text" as const,
    ...(search.sensitivity ? { sensitivity: search.sensitivity } : {}),
    ...(search.locale ? { locale: search.locale } : {}),
  };
  if (viewCompare("contains", cell, search.text, options)) {
    if (viewCompare("equals", cell, search.text, options)) return 0;
    if (viewCompare("startsWith", cell, search.text, options)) return 4096;
    // (A word after the first beginning with the search.)
    const words = cell.split(WORD_BREAK);
    for (let index = 1; index < words.length; index += 1)
      if (
        words[index] &&
        viewCompare("startsWith", words[index], search.text, options)
      )
        return 2 * 4096;
    return 3 * 4096;
  }
  // (The words' first letters, as units: the search is among them, together.)
  const words = cell.split(WORD_BREAK).filter(Boolean);
  if (words.length > 1) {
    const initials = unitsOf(
      words.map((word) => String.fromCodePoint(word.codePointAt(0)!)).join(""),
      search.lower,
    );
    const { units } = search;
    scan: for (let at = 0; at + units.length <= initials.length; at += 1) {
      for (let index = 0; index < units.length; index += 1)
        if (initials[at + index] !== units[index]) continue scan;
      return 4 * 4096;
    }
  }
  const spread = spreadOf(search.units, cellUnits(cell, search.lower));
  return spread < 0 ? VIEW_FUZZY_NO_MATCH : 5 * 4096 + Math.min(spread, 4095);
}

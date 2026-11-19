import { afterEach, describe, expect, it, vi } from "vitest";
import { viewCompare } from "../comparison";

/**
 * 「포함」 (`contains`) does not scan every cell unit by unit: printable ASCII is one `includes` of
 * the folded cell, confirmed by the collator where it hits; other text (Hangul) is compared only
 * where a unit begins with the search's first letter. The answer is the collator's own scan's
 * (`useFilter`'s `contains`): the reference below is that scan, written out.
 *
 * Before (2026-11-20): every cell was scanned unit by unit with a `slice` and a collator compare
 * at each — 10,000 rows × 3 fields took 12 ~ 19 ms a filter run (100,000 rows: 127 ~ 204 ms).
 * (Hangul is not folded: the search collator reads a syllable as its letters — `각가` is `가까`,
 *  `간ㅏ` is `가나` — a folded `includes` missed those, 7 of 2,000,000 random cases.)
 */
afterEach(() => {
  vi.restoreAllMocks();
});

/** `useFilter`'s `contains` — the scan `comparison.ts` `textMatch` keeps for every other text. */
function reference(
  locale: string | undefined,
  sensitivity: "base" | "accent" | "case" | "variant",
  cell: string,
  search: string,
): boolean {
  const collator = new Intl.Collator(locale, { usage: "search", sensitivity });
  if (search.length === 0) return true;
  const string = cell.normalize("NFC");
  const substring = search.normalize("NFC");
  for (let scan = 0; scan + substring.length <= string.length; scan++)
    if (
      collator.compare(
        substring,
        string.slice(scan, scan + substring.length),
      ) === 0
    )
      return true;
  return false;
}

/** A seeded generator (the same strings every run). */
function random(seed: number) {
  let state = seed >>> 0;
  return () =>
    (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32;
}

// (Letters the locales below tailor as digraphs · equal letters — `ch` · `cs` · `dz` · `ll` ·
//  `lj` · `aa` · `i` ≡ `y` · `I` ≠ `i` — and text the plain path does not take: accents, kana,
//  full-width forms, an ignorable soft hyphen, a control character.)
const PLAIN = "acdhijlnsyzACDHIJLNSYZ 09-_.";
// (Syllables sharing letters — the search collator's re-spellings: `각가` = `가까`, `간ㅏ` = `가나`,
//  `값` = `갑ㅅ`; compound jamo are not their letters, `ㄲ` ≠ `ㄱㄱ`.)
const HANGUL = "가각까깍나간낙아악ㄱㄲㄴㅇㅏㄳ값갑사싸ㅅ";
const OTHER = "éÉäßıİあアＡ­\u0001ǆ";
const LOCALES = [
  undefined,
  "en",
  "ko",
  "tr",
  "lt",
  "hu",
  "cs",
  "sk",
  "da",
  "cy",
  "hr",
  "es-u-co-trad",
  "de-u-co-phonebk",
];

describe("contains — the plain text path answers as the collator's scan", () => {
  for (const sensitivity of ["base", "accent", "case", "variant"] as const)
    it(`random text, every locale (${sensitivity})`, () => {
      const next = random(20261120);
      const text = (alphabet: string, length: number) =>
        Array.from(
          { length },
          () => alphabet[Math.floor(next() * alphabet.length)],
        ).join("");
      for (const locale of LOCALES)
        for (let round = 0; round < 400; round += 1) {
          const alphabet = [PLAIN, HANGUL, PLAIN + HANGUL, PLAIN + OTHER][
            round % 4
          ]!;
          const cell = text(alphabet, 1 + Math.floor(next() * 12));
          // (Half the searches are cut from the cell — a hit, in another case half of those.)
          const from = Math.floor(next() * cell.length);
          const cut = cell.slice(from, from + 1 + Math.floor(next() * 3));
          const search =
            next() < 0.5
              ? text(alphabet, 1 + Math.floor(next() * 3))
              : next() < 0.5
                ? cut
                : next() < 0.5
                  ? cut.toUpperCase()
                  : cut.toLowerCase();
          const got = viewCompare("contains", cell, search, {
            kind: "text",
            sensitivity,
            ...(locale ? { locale } : {}),
          });
          const want = reference(locale, sensitivity, cell, search);
          if (got !== want)
            throw new Error(
              `${String(locale)} ${sensitivity}: ${JSON.stringify(cell)} contains ${JSON.stringify(search)} — ${String(got)}, the scan says ${String(want)}`,
            );
        }
    });

  it("ASCII text is not scanned: a compare a hit", () => {
    const rows = Array.from(
      { length: 1000 },
      (_, index) => `Person ${index} Seoul user${index}@Example.com`,
    );
    const run = (search: string) =>
      rows.filter((cell) =>
        viewCompare("contains", cell, search, { kind: "text", locale: "ko" }),
      ).length;
    // (The collator's own letters are read once a collator — not this run's.)
    run("x");
    const compares = vi.spyOn(Intl.Collator.prototype, "compare", "get");
    expect(run("person 12")).toBe(11);
    expect(run("SEOUL")).toBe(1000);
    expect(run("zzz")).toBe(0);
    // (The scan: one compare a unit of every cell — ~30,000 a run.)
    expect(compares.mock.calls.length).toBe(1011);
  });

  it("Hangul text is compared where a unit begins with the search's first letter", () => {
    const rows = Array.from(
      { length: 1000 },
      (_, index) =>
        `담당자 ${index} 서울특별시 강남구 user${index}@Example.com`,
    );
    const run = (search: string) =>
      rows.filter((cell) =>
        viewCompare("contains", cell, search, { kind: "text", locale: "ko" }),
      ).length;
    run("x");
    const compares = vi.spyOn(Intl.Collator.prototype, "compare", "get");
    expect(run("서울")).toBe(1000);
    expect(run("강남")).toBe(1000);
    // (`각가` is `가까` to the search collator: a syllable's letters, not the syllable.)
    expect(run("부산")).toBe(0);
    expect(run("담당자 12")).toBe(11);
    // (서 — one unit begins with ㅅ before the hit; 강 — 강 itself; 부 — no ㅂ at all; 담 — 담 · 당.
    //  The scan compared at every unit before the hit: ~18,000 a run for 「부산」 alone.)
    expect(compares.mock.calls.length).toBeLessThan(6000);
  });
});

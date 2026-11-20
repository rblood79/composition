import { describe, expect, it } from "vitest";
import { viewRowsPassing, type ViewRowTest } from "../rowFilter";
import { viewCompare } from "../comparison";
import { viewFuzzyRank, viewFuzzySearch } from "../fuzzy";

/**
 * ADR-315 Phase 3 — the rows a Table's search · column filters keep, as row numbers. Expected rows
 * are written by hand; the typed-on search (「이어 치기」) is checked against the same search run
 * afresh — over plain text, Hangul and other locales' collators (G3 — 0 mismatches).
 */
const rows = [
  { name: "Ada Lovelace", team: "Core", score: 9, note: "first" },
  { name: "alan turing", team: "core", score: 7, note: "" },
  { name: "Grace Hopper", team: "Tools", score: 9, note: null },
  { name: "Linus", team: "Kernel", score: 3, note: "ada fan" },
  { name: "김민수", team: "코어", score: 5, note: "가나다" },
];
const field = (key: keyof (typeof rows)[number], type?: string) => ({
  valueAt: (index: number) => rows[index]![key],
  name: key,
  ...(type ? { type } : {}),
});
const kept = (tests: readonly ViewRowTest[], options = {}) => {
  const { pass } = viewRowsPassing(rows.length, tests, options);
  return pass
    ? [...pass].flatMap((flag, index) => (flag ? [index] : []))
    : "all";
};
const search = (text: string, mode: "contains" | "fuzzy" = "contains") =>
  ({
    fields: [field("name"), field("team"), field("note")],
    op: "contains",
    value: text,
    search: mode,
  }) satisfies ViewRowTest;

describe("viewRowsPassing — a Table's search", () => {
  it("keeps a row any searched field of which contains the text (case folded)", () => {
    // 「ada」: Ada Lovelace (name) · Linus (note 「ada fan」)
    expect(kept([search("ada")])).toEqual([0, 3]);
    // 「core」: team Core · core
    expect(kept([search("CORE")])).toEqual([0, 1]);
  });

  it("is every row for an empty text, and none for a text nothing holds", () => {
    expect(kept([search("")])).toBe("all");
    expect(kept([search("zzz")])).toEqual([]);
  });

  it("reads Hangul as the search collator does (a syllable as its letters)", () => {
    expect(kept([search("민수")])).toEqual([4]);
    expect(kept([search("가나")])).toEqual([4]);
    // (`간ㅏ` is `가나` to the collator: the comparison's answer, not a folded `includes`.)
    expect(viewCompare("contains", "가나다", "간ㅏ", { kind: "text" })).toBe(
      true,
    );
    expect(kept([search("간ㅏ")])).toEqual([4]);
  });
});

describe("viewRowsPassing — column filters", () => {
  it("compares a field by its type (a number by value, text by the collator)", () => {
    expect(
      kept([{ fields: [field("score", "number")], op: "gte", value: 7 }]),
    ).toEqual([0, 1, 2]);
    expect(
      kept([{ fields: [field("team")], op: "equals", value: "core" }]),
    ).toEqual([0, 1]);
    expect(
      kept([
        {
          fields: [field("team")],
          op: "equals",
          value: "core",
          sensitivity: "case",
        },
      ]),
    ).toEqual([1]);
  });

  it("joins the tests by 「and」, the search among them", () => {
    // score ≥ 7 and 「ada」: Ada Lovelace only (Linus has 3).
    expect(
      kept([
        { fields: [field("score", "number")], op: "gte", value: 7 },
        search("ada"),
      ]),
    ).toEqual([0]);
  });

  it("skips a test whose value is empty, and keeps 「exists」 · 「notExists」", () => {
    expect(kept([{ fields: [field("team")], op: "equals", value: "" }])).toBe(
      "all",
    );
    expect(kept([{ fields: [field("team")], op: "oneOf", value: [] }])).toBe(
      "all",
    );
    // note: "first" · "" · null · "ada fan" · "가나다"
    expect(kept([{ fields: [field("note")], op: "notExists" }])).toEqual([
      1, 2,
    ]);
    expect(kept([{ fields: [field("note")], op: "exists" }])).toEqual([
      0, 3, 4,
    ]);
  });
});

describe("viewRowsPassing — a fuzzy search", () => {
  it("keeps the rows of any grade and ranks them, the better match the smaller", () => {
    const { pass, rank } = viewRowsPassing(rows.length, [
      search("ada", "fuzzy"),
    ]);
    // Ada Lovelace — begins with it; Linus — 「ada fan」 begins with it (the note);
    // alan turing — a · (l) · … no `d`: none. Grace Hopper: none. 김민수: none.
    expect([...pass!]).toEqual([1, 0, 0, 1, 0]);
    expect(rank![0]).toBe(4096);
    expect(rank![3]).toBe(4096);
    // 「al」: `Ada Lovelace` has a · l apart and its words' first letters `al`; `alan turing`
    // begins with it — the better one.
    const al = viewRowsPassing(rows.length, [search("al", "fuzzy")]);
    expect([...al.pass!]).toEqual([1, 1, 0, 0, 0]);
    expect(al.rank![1]).toBeLessThan(al.rank![0]!);
  });

  it("finds a syllable being typed and initial consonants (Hangul by its letters)", () => {
    // 「김ㅁ」 (the next syllable begun) · 「ㄱㅁㅅ」 (initial consonants) → 김민수
    expect(kept([search("김ㅁ", "fuzzy")])).toEqual([4]);
    expect(kept([search("ㄱㅁㅅ", "fuzzy")])).toEqual([4]);
    // (「포함」 finds neither.)
    expect(kept([search("ㄱㅁㅅ")])).toEqual([]);
  });
});

describe("viewRowsPassing — a search typed on (이어 치기)", () => {
  /** A seeded generator (mulberry32) — the same texts every run. */
  const random = (seed: number) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const ALPHABETS = {
    plain: "abcABC iIsS-12",
    hangul: "가나각간까다ㄱㄴㅏ a",
    mixed: "abI가각ㄱㅏ é­ß",
    // (A plain search whose letters a cell holds with an accent: `e` is in `é` to the collator,
    //  not to a folded `includes` — such a cell is never a certain miss.)
    accent: "aeE éèÉ",
  };
  const textOf = (next: () => number, alphabet: string, most: number) =>
    Array.from(
      { length: Math.floor(next() * most) },
      () => [...alphabet][Math.floor(next() * [...alphabet].length)],
    ).join("");

  it.each([
    ["en", "plain"],
    ["ko", "hangul"],
    ["ko", "mixed"],
    ["tr", "plain"],
    ["de", "mixed"],
    ["th", "plain"],
    ["sk", "plain"],
    ["en", "accent"],
    ["fr", "accent"],
  ] as const)(
    "is the comparison a cell at a time — %s · %s texts, both matches",
    (locale, alphabet) => {
      const next = random(315);
      const cells = Array.from({ length: 400 }, () => ({
        a: textOf(next, ALPHABETS[alphabet], 9),
        b: textOf(next, ALPHABETS[alphabet], 6),
      }));
      const fields = (["a", "b"] as const).map((key) => ({
        valueAt: (index: number) => cells[index]![key],
        name: key,
      }));
      let mismatches = 0;
      let narrowed = 0;
      for (const mode of ["contains", "fuzzy"] as const)
        for (let run = 0; run < 60; run += 1) {
          // (One typing: each search holds the one before — the rows object is the same, so the
          //  kept misses of the shorter search are read.)
          const typed = textOf(next, ALPHABETS[alphabet], 4) || "a";
          const held = { rows: cells, locale };
          for (let length = 1; length <= typed.length; length += 1) {
            const value = typed.slice(0, length);
            const test = {
              fields,
              op: "contains",
              value,
              search: mode,
            } as const;
            const on = viewRowsPassing(cells.length, [test], held);
            // (The oracle is the comparison itself, a cell at a time — none of the row filter's
            //  shortcuts: `viewCompare` for 「포함」, `viewFuzzyRank` for the grades.)
            const fuzzy = viewFuzzySearch(value, locale);
            const expected = cells.map((cell) => {
              const texts = [cell.a, cell.b];
              if (mode === "contains")
                return texts.some((text) =>
                  viewCompare("contains", text, value, {
                    kind: "text",
                    locale,
                  }),
                )
                  ? 0
                  : -1;
              const ranks = texts
                .map((text) => viewFuzzyRank(text, fuzzy))
                .filter((rank) => rank >= 0);
              return ranks.length ? Math.min(...ranks) : -1;
            });
            narrowed += 1;
            const got = [...on.pass!].map((flag, index) =>
              flag ? (on.rank ? on.rank[index]! : 0) : -1,
            );
            if (String(got) !== String(expected)) mismatches += 1;
          }
        }
      expect(narrowed).toBeGreaterThan(100);
      expect(mismatches).toBe(0);
    },
  );

  it("does not compare a row whose plain cells missed the shorter search", () => {
    let reads = 0;
    const cells = ["alpha", "beta", "gamma", "alphabet"];
    const fields = [
      {
        valueAt: (index: number) => {
          reads += 1;
          return cells[index];
        },
        name: "cell",
      },
    ];
    const run = (value: string) =>
      viewRowsPassing(
        cells.length,
        [{ fields, op: "contains", value, search: "contains" }],
        { rows: cells },
      );
    expect([...run("al").pass!]).toEqual([1, 0, 0, 1]);
    expect(reads).toBe(4);
    // (`beta` · `gamma` missed 「al」: 「alp」 reads the two rows left.)
    expect([...run("alp").pass!]).toEqual([1, 0, 0, 1]);
    expect(reads).toBe(6);
    // (A search that is not the last one typed on reads every row again.)
    expect([...run("be").pass!]).toEqual([0, 1, 0, 1]);
    expect(reads).toBe(10);
  });
});

import { describe, expect, it } from "vitest";
import { viewSortOrder, type ViewSortKey } from "../sortOrder";

/**
 * ADR-315 Phase 2 — the one sort of rows (a view's sort · a Table's header sort): row numbers in
 * order, by every sort entry in turn. Expected orders are written by hand.
 */
const key = (
  values: readonly unknown[],
  rest: Omit<ViewSortKey, "valueAt"> = { direction: "ascending" },
): ViewSortKey => ({ valueAt: (index) => values[index], ...rest });
const order = (count: number, keys: readonly ViewSortKey[]) => [
  ...viewSortOrder(count, keys),
];

describe("viewSortOrder — one column", () => {
  it("orders numbers by value, not by their text", () => {
    const values = [10, 9, 100, 1];
    expect(order(4, [key(values, { direction: "ascending", type: "number" })]))
      // 1 · 9 · 10 · 100
      .toEqual([3, 1, 0, 2]);
    expect(
      order(4, [key(values, { direction: "descending", type: "number" })]),
    ).toEqual([2, 0, 1, 3]);
  });

  it("orders decimals and negatives by value (their texts order otherwise)", () => {
    // −2 · 1.25 · 1.5 · 10 (as texts, digits by value: 1.5 before 1.25, −2 after them)
    expect(
      order(4, [
        key([1.5, 1.25, -2, 10], { direction: "ascending", type: "number" }),
      ]),
    ).toEqual([2, 1, 0, 3]);
    // (A number field's numeric text is its number.)
    expect(
      order(3, [
        key(["1.5", "1.25", "-2"], { direction: "ascending", type: "number" }),
      ]),
    ).toEqual([2, 1, 0]);
  });

  it("orders dates by time (an ISO day · a date-time · a timestamp · a Date)", () => {
    const values = [
      "2026-03-01",
      "2025-12-31T23:59:00Z",
      Date.UTC(2026, 0, 15),
      new Date("2024-06-01"),
    ];
    // 2024-06-01 · 2025-12-31 · 2026-01-15 · 2026-03-01
    expect(
      order(4, [key(values, { direction: "ascending", type: "date" })]),
    ).toEqual([3, 1, 2, 0]);
  });

  it("orders booleans false before true", () => {
    const values = [true, false, true, false];
    expect(
      order(4, [key(values, { direction: "ascending", type: "boolean" })]),
    ).toEqual([1, 3, 0, 2]);
    expect(
      order(4, [key(values, { direction: "descending", type: "boolean" })]),
    ).toEqual([0, 2, 1, 3]);
  });

  it("orders text by the collator (case · width folded, digits by value)", () => {
    const values = ["item 10", "Item 9", "apple", "Banana", "item 9"];
    // apple · Banana · Item 9 = item 9 (their own order) · item 10
    expect(
      order(5, [key(values, { direction: "ascending", type: "string" })]),
    ).toEqual([2, 3, 1, 4, 0]);
    // (Descending: equal values still keep their own order — a stable sort.)
    expect(
      order(5, [key(values, { direction: "descending", type: "string" })]),
    ).toEqual([0, 1, 4, 3, 2]);
  });

  it("puts empty values last in both directions unless the entry says first", () => {
    const values = [3, null, 1, undefined, "", 2];
    const ascending = key(values, { direction: "ascending", type: "number" });
    const descending = key(values, { direction: "descending", type: "number" });
    // (The empty rows keep their own order: 1 · 3 · 4.)
    expect(order(6, [ascending])).toEqual([2, 5, 0, 1, 3, 4]);
    expect(order(6, [descending])).toEqual([0, 5, 2, 1, 3, 4]);
    expect(order(6, [{ ...ascending, empty: "first" }])).toEqual([
      1, 3, 4, 2, 5, 0,
    ]);
    expect(order(6, [{ ...descending, empty: "first" }])).toEqual([
      1, 3, 4, 0, 5, 2,
    ]);
  });

  it("reads a field without a type by its values: all numbers by value, else as text", () => {
    expect(order(3, [key([10, 9, 100])])).toEqual([1, 0, 2]);
    // (Mixed: text with digits by value — 9 · "10" · "b".)
    expect(order(3, [key(["b", "10", 9])])).toEqual([2, 1, 0]);
  });

  it("holds a value a typed field cannot read as empty", () => {
    expect(
      order(3, [key(["x", 2, 1], { direction: "ascending", type: "number" })]),
    ).toEqual([2, 1, 0]);
    expect(
      order(3, [
        key(["not a day", "2026-01-02", "2026-01-01"], {
          direction: "ascending",
          type: "date",
        }),
      ]),
    ).toEqual([2, 1, 0]);
  });
});

describe("viewSortOrder — several columns", () => {
  // team · score · name
  const rows = [
    { team: "B", score: 5, name: "s0" },
    { team: "A", score: 7, name: "s1" },
    { team: "A", score: 9, name: "s2" },
    { team: "B", score: 9, name: "s3" },
    { team: "A", score: 7, name: "s4" },
  ];
  const by = (
    field: "team" | "score",
    direction: "ascending" | "descending",
  ): ViewSortKey => ({
    valueAt: (index) => rows[index]![field],
    direction,
    type: field === "score" ? "number" : "string",
  });

  it("orders by the first entry, then the next among its equal rows", () => {
    // team ↑ then score ↓: A9 (s2) · A7 (s1) · A7 (s4) · B9 (s3) · B5 (s0)
    expect(
      order(5, [by("team", "ascending"), by("score", "descending")]),
    ).toEqual([2, 1, 4, 3, 0]);
    // score ↓ then team ↑: 9A (s2) · 9B (s3) · 7A (s1) · 7A (s4) · 5B (s0)
    expect(
      order(5, [by("score", "descending"), by("team", "ascending")]),
    ).toEqual([2, 3, 1, 4, 0]);
  });

  it("is the rows' own order with no entry", () => {
    expect(order(3, [])).toEqual([0, 1, 2]);
  });
});

describe("viewSortOrder — a column's ranks kept", () => {
  it("reads a cached column's values once across directions and added entries", () => {
    const rows = [{ n: "b" }, { n: "a" }, { n: "c" }];
    let reads = 0;
    const name = (direction: "ascending" | "descending"): ViewSortKey => ({
      valueAt: (index) => {
        reads += 1;
        return rows[index]!.n;
      },
      direction,
      type: "string",
      cache: { rows, name: "n" },
    });
    expect(order(3, [name("ascending")])).toEqual([1, 0, 2]);
    const first = reads;
    expect(first).toBe(3);
    expect(order(3, [name("descending")])).toEqual([2, 0, 1]);
    expect(order(3, [name("ascending"), key([1, 1, 1])])).toEqual([1, 0, 2]);
    expect(reads).toBe(first);
  });
});

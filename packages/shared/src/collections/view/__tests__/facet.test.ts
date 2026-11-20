import { describe, expect, it } from "vitest";
import type { ViewQuery } from "../../../catalog/document/types";
import { runViewQueries, type ViewRunField } from "../evaluate";
import { viewEqualityKeys } from "../comparison";

/**
 * ADR-315 Phase 3 (G3) — a filter's candidate values (`ViewQuery.facet`, TanStack faceting): each
 * value of a field with the rows it would give — 「그 열의 필터만 뺀 결과」 — the values the comparisons
 * hold equal as one candidate. Every count is written by hand, and checked against the rows the
 * candidate gives once chosen.
 *
 * Fixture:
 *   r1 A  open  3      r2 a  open  5      r3 B  done  5
 *   r4 —  open  1      r5 "" done  —      r6 B  open  "5"
 */
const SCHEMA: ViewRunField[] = [
  { id: "f-id", key: "id", type: "string" },
  { id: "f-team", key: "team", type: "string" },
  { id: "f-state", key: "state", type: "string" },
  { id: "f-score", key: "score", type: "number" },
  { id: "f-tags", key: "tags", type: "array" },
];
const ROWS = [
  { id: "r1", team: "A", state: "open", score: 3, tags: ["x", "y"] },
  { id: "r2", team: "a", state: "open", score: 5, tags: ["X"] },
  { id: "r3", team: "B", state: "done", score: 5, tags: [] },
  { id: "r4", team: null, state: "open", score: 1, tags: ["y", "y"] },
  { id: "r5", team: "", state: "done", score: null },
  { id: "r6", team: "B", state: "open", score: "5", tags: ["z"] },
];
const TEAM = ["data:field:f-team"] as const;
const STATE = ["data:field:f-state"] as const;
const SCORE = ["data:field:f-score"] as const;
const facetOf = (field: readonly string[]): ViewQuery => ({
  where: { id: "facet", op: "and", items: [] },
  groupBy: [field as never],
  aggregates: [{ fn: "count", as: "count" }],
  facet: true,
});
const list = (items: ViewQuery["where"]["items"]): ViewQuery => ({
  where: { id: "where", op: "and", items },
});
const run = (queries: readonly ViewQuery[]) =>
  runViewQueries(ROWS, {
    queries,
    schema: SCHEMA,
    resolve: (value) => ({ value }),
  }).rows as Record<string, unknown>[];
const ids = (queries: readonly ViewQuery[]) =>
  run(queries).map((row) => row.id);

describe("a filter's candidate values (facet)", () => {
  it("folds the values `equals` holds the same, and every empty value into one", () => {
    // team: A · a (one candidate — 2 rows) · B (2) · empty (r4 `null` · r5 `""` — 2)
    expect(run([list([]), facetOf(TEAM)])).toEqual([
      { team: "A", count: 2 },
      { team: "B", count: 2 },
      { team: null, count: 2 },
    ]);
    // score (a number field): 3 · 5 (r2 · r3 · r6's text `"5"`) · 1 · empty (r5)
    expect(run([list([]), facetOf(SCORE)])).toEqual([
      { score: 3, count: 1 },
      { score: 5, count: 3 },
      { score: 1, count: 1 },
      { score: null, count: 1 },
    ]);
  });

  it("each candidate's count is the rows choosing it gives", () => {
    const choose = (value: unknown) =>
      ids([
        list([
          value === null
            ? { id: "c", fields: [TEAM as never], op: "notExists" }
            : {
                id: "c",
                fields: [TEAM as never],
                op: "equals",
                value: value as string,
              },
        ]),
      ]);
    for (const candidate of run([list([]), facetOf(TEAM)]))
      expect(choose(candidate.team).length).toBe(candidate.count);
    // (By hand: 「A」 gives r1 · r2 — the default sensitivity folds the case.)
    expect(choose("A")).toEqual(["r1", "r2"]);
    expect(choose(null)).toEqual(["r4", "r5"]);
  });

  it("skips the field's own condition, and keeps every other", () => {
    const filtered = list([
      { id: "own", fields: [TEAM as never], op: "equals", value: "B" },
      { id: "other", fields: [STATE as never], op: "equals", value: "open" },
    ]);
    // (The list itself: team B and open — r6.)
    expect(ids([filtered])).toEqual(["r6"]);
    // team's candidates among the open rows (r1 · r2 · r4 · r6) — its own 「B」 is not applied:
    // A (r1 · r2) · empty (r4) · B (r6).
    expect(run([filtered, facetOf(TEAM)])).toEqual([
      { team: "A", count: 2 },
      { team: null, count: 1 },
      { team: "B", count: 1 },
    ]);
    // state's candidates among team B (r3 · r6) — its own 「open」 is not applied.
    expect(run([filtered, facetOf(STATE)])).toEqual([
      { state: "done", count: 1 },
      { state: "open", count: 1 },
    ]);
  });

  it("keeps a condition over several fields, an `or` group, and the Table's search", () => {
    const search = {
      id: "table-search",
      fields: [TEAM as never],
      op: "contains" as const,
      value: "b",
    };
    // (The search is over `team` alone here — still not the column's own filter.)
    expect(run([list([search]), facetOf(TEAM)])).toEqual([
      { team: "B", count: 2 },
    ]);
    const either: ViewQuery = {
      where: {
        id: "where",
        op: "and",
        items: [
          {
            id: "or",
            op: "or",
            items: [
              { id: "t", fields: [TEAM as never], op: "equals", value: "B" },
              {
                id: "s",
                fields: [STATE as never],
                op: "equals",
                value: "done",
              },
            ],
          },
        ],
      },
    };
    // team B or done: r3 · r5 · r6 → B (2) · empty (r5).
    expect(run([either, facetOf(TEAM)])).toEqual([
      { team: "B", count: 2 },
      { team: null, count: 1 },
    ]);
  });

  it("a list field's candidates are its elements — a row once in each", () => {
    // tags: x (r1 · r2 `X`) · y (r1 · r4 — twice in r4, once counted) · empty (r3 `[]` · r5) · z
    expect(run([list([]), facetOf(["data:field:f-tags"])])).toEqual([
      { tags: "x", count: 2 },
      { tags: "y", count: 2 },
      { tags: null, count: 2 },
      { tags: "z", count: 1 },
    ]);
  });

  it("a grouping without `facet` keeps its values as they are (no fold, its conditions applied)", () => {
    const grouped: ViewQuery = { ...facetOf(TEAM) };
    delete (grouped as { facet?: true }).facet;
    expect(run([list([]), grouped])).toEqual([
      { team: "A", count: 1 },
      { team: "a", count: 1 },
      { team: "B", count: 2 },
      { team: null, count: 1 },
      { team: "", count: 1 },
    ]);
  });
});

describe("viewEqualityKeys", () => {
  it("gives equal texts one key by the search collator (Hangul by its letters)", () => {
    const keys = viewEqualityKeys(
      ["Ab", "aB", "ab ", "가까", "각가", "", null],
      {
        kind: "text",
      },
    );
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[0]);
    expect(keys[3]).toBe(keys[4]);
    expect(keys[5]).toBe(keys[6]);
    // (A stricter sensitivity keeps the case apart.)
    const strict = viewEqualityKeys(["Ab", "aB"], {
      kind: "text",
      sensitivity: "case",
    });
    expect(strict[0]).not.toBe(strict[1]);
  });

  it("keys a number by value, a date by its day", () => {
    const numbers = viewEqualityKeys([5, "5", 5.0, "5.5"], { kind: "number" });
    expect(new Set(numbers.slice(0, 3)).size).toBe(1);
    expect(numbers[3]).not.toBe(numbers[0]);
    const days = viewEqualityKeys(["2026-11-20", "2026-11-20T09:00:00Z"], {
      kind: "date",
    });
    expect(days[0]).toBe(days[1]);
  });
});

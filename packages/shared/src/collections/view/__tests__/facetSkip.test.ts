import { describe, expect, it } from "vitest";
import type {
  ViewCondition,
  ViewConditionGroup,
  ViewQuery,
} from "../../../catalog/document/types";
import { runViewQueries, type ViewRunField } from "../evaluate";

/**
 * ADR-320 G3 · Decision 9 — a session's candidate values of the condition being edited
 * (`ViewQuery.facetSkip`): that condition alone leaves, wherever it is (under an `or`, in a nested
 * group); another condition on the same field and the author's stay. Every answer is written by
 * hand from the fixture.
 *
 * Fixture (score · team):  r1 5 A   r2 10 A   r3 20 B   r4 10 B   r5 20 A
 */
const SCHEMA: ViewRunField[] = [
  { id: "f-id", key: "id", type: "string" },
  { id: "f-score", key: "score", type: "number" },
  { id: "f-team", key: "team", type: "string" },
];
const ROWS = [
  { id: "r1", score: 5, team: "A" },
  { id: "r2", score: 10, team: "A" },
  { id: "r3", score: 20, team: "B" },
  { id: "r4", score: 10, team: "B" },
  { id: "r5", score: 20, team: "A" },
];
const SCORE = ["data:field:f-score"] as never;
const TEAM = ["data:field:f-team"] as never;
const cond = (
  id: string,
  field: never,
  op: ViewCondition["op"],
  value: ViewCondition["value"],
): ViewCondition => ({ id, fields: [field], op, value });
const where = (
  items: (ViewCondition | ViewConditionGroup)[],
  id = "w",
): ViewQuery => ({ where: { id, op: "and", items } });
const facet = (skip?: string): ViewQuery => ({
  where: { id: "facet", op: "and", items: [] },
  groupBy: [SCORE],
  aggregates: [{ fn: "count", as: "count" }],
  facet: true,
  ...(skip !== undefined ? { facetSkip: skip } : {}),
});
const candidates = (queries: readonly ViewQuery[]) =>
  (
    runViewQueries(ROWS, {
      queries,
      schema: SCHEMA,
      resolve: (value) => ({ value }),
    }).rows as { score: number; count: number }[]
  )
    .map((row) => `${row.score}:${row.count}`)
    .sort();

describe("ADR-320 — candidate values leave out the condition being edited only", () => {
  const atLeast10 = cond("c1", SCORE, "gte", 10);
  const is20 = cond("c2", SCORE, "equals", 20);

  it("score ≥ 10 and score = 20 — the second's candidates are 10 · 20 (the first stays)", () => {
    expect(candidates([where([atLeast10, is20]), facet("c2")])).toEqual([
      "10:2",
      "20:2",
    ]);
    // (Before Decision 9 — every condition on the field left: 5 · 10 · 20.)
    expect(candidates([where([atLeast10, is20]), facet()])).toEqual([
      "10:2",
      "20:2",
      "5:1",
    ]);
  });

  it("the author's condition on the same field stays", () => {
    const authored = where([cond("a1", SCORE, "lt", 20)], "authored");
    // (author: score < 20 · scope: score = 20 being edited → 5 · 10)
    expect(
      candidates([
        {
          where: { ...authored.where, items: [...authored.where.items, is20] },
        },
        facet("c2"),
      ]),
    ).toEqual(["10:2", "5:1"]);
  });

  it("a condition under an `or` leaves the `or` (the other operand stays)", () => {
    const or: ViewConditionGroup = {
      id: "g1",
      op: "or",
      items: [cond("c3", TEAM, "equals", "B"), is20],
    };
    // (team = B or score = 20, editing score = 20 → team = B: r3 20 · r4 10)
    expect(candidates([where([or]), facet("c2")])).toEqual(["10:1", "20:1"]);
  });

  it("a condition in a nested group leaves it; a group it empties leaves with it", () => {
    const nested: ViewConditionGroup = {
      id: "g1",
      op: "or",
      items: [
        cond("c3", TEAM, "equals", "B"),
        { id: "g2", op: "and", items: [is20] },
      ],
    };
    // (team = B or (score = 20), editing score = 20 → team = B)
    expect(candidates([where([nested]), facet("c2")])).toEqual([
      "10:1",
      "20:1",
    ]);
    // (score ≥ 10 and (score = 20) — the group empties: score ≥ 10 → 10 · 20)
    expect(
      candidates([
        where([atLeast10, { id: "g3", op: "or", items: [is20] }]),
        facet("c2"),
      ]),
    ).toEqual(["10:2", "20:2"]);
  });
});

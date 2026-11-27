import { describe, expect, it } from "vitest";
import type {
  ViewCondition,
  ViewConditionGroup,
} from "../../../catalog/document/types";
import { runViewQueries, type ViewRunField } from "../evaluate";
import {
  viewRowsPassing,
  viewRowsPassingGroup,
  type ViewRowTest,
  type ViewRowTestGroup,
} from "../rowFilter";
import { viewRowTestGroupOf } from "../rowTests";

/**
 * ADR-320 Decision 3 (G1) — a condition tree with 「또는」 · nested groups as row numbers. Expected
 * rows are written by hand (row ids); the random trees are checked against the one evaluator
 * (`runViewQueries`) — the flat path (`viewRowsPassing`), the group path (`viewRowsPassingGroup`)
 * and the evaluator keep the same rows.
 */
const SCHEMA: ViewRunField[] = [
  { id: "f-id", key: "id", type: "string" },
  { id: "f-dept", key: "dept", type: "string" },
  { id: "f-region", key: "region", type: "string" },
  { id: "f-score", key: "score", type: "number" },
  { id: "f-note", key: "note", type: "string" },
];
const ROWS = [
  { id: "r1", dept: "sales", region: "seoul", score: 5, note: "" },
  { id: "r2", dept: "sales", region: "busan", score: 10, note: "vip" },
  { id: "r3", dept: "dev", region: "seoul", score: 20, note: "" },
  { id: "r4", dept: "dev", region: "daegu", score: 20, note: "vip" },
  { id: "r5", dept: "ops", region: "seoul", score: 30, note: null },
  { id: "r6", dept: "ops", region: "busan", score: 10, note: "new" },
];
const resolve = (value: unknown) => ({ value });
let seq = 0;
const cond = (
  field: string,
  op: ViewCondition["op"],
  value?: ViewCondition["value"],
  more: Partial<ViewCondition> = {},
): ViewCondition => ({
  id: `c${(seq += 1)}`,
  fields: [[`data:field:${field}`]],
  op,
  ...(value !== undefined ? { value } : {}),
  ...more,
});
const group = (
  op: "and" | "or",
  ...items: (ViewCondition | ViewConditionGroup)[]
): ViewConditionGroup => ({ id: `g${(seq += 1)}`, op, items });

const input = { schema: SCHEMA, resolve };
const idsOf = (pass: Uint8Array | undefined, rows = ROWS) =>
  pass
    ? rows.flatMap((row, index) => (pass[index] ? [row.id] : []))
    : rows.map((row) => row.id);
const groupPath = (tree: ViewConditionGroup, rows = ROWS) =>
  idsOf(
    viewRowsPassingGroup(rows.length, viewRowTestGroupOf(tree, input, rows)),
    rows,
  );
const evaluator = (tree: ViewConditionGroup, rows = ROWS) =>
  (
    runViewQueries(rows, { queries: [{ where: tree }], ...input })
      .rows as typeof ROWS
  ).map((row) => row.id);

describe("viewRowsPassingGroup — hand-written answers", () => {
  it("joins an `or` group's conditions by union", () => {
    // 부서 = sales 또는 지역 = seoul
    const tree = group(
      "and",
      group(
        "or",
        cond("f-dept", "equals", "sales"),
        cond("f-region", "equals", "seoul"),
      ),
    );
    expect(groupPath(tree)).toEqual(["r1", "r2", "r3", "r5"]);
  });

  it("leaves a skipped condition out of an `or` (never a pass-all operand)", () => {
    // 점수 = 20 또는 (꺼짐) → 20 인 행만. 꺼진 조건을 통과 집합으로 합치면 모든 행이다.
    const off = group(
      "or",
      cond("f-score", "equals", 20),
      cond("f-dept", "equals", "sales", { enabled: false }),
    );
    expect(groupPath(group("and", off))).toEqual(["r3", "r4"]);
    // 값이 빈 조건도 건너뛴다
    const empty = group(
      "or",
      cond("f-score", "equals", 20),
      cond("f-note", "contains", ""),
    );
    expect(groupPath(group("and", empty))).toEqual(["r3", "r4"]);
  });

  it("skips a group whose items all skip — in an `and` it drops no row", () => {
    const tree = group(
      "and",
      cond("f-dept", "equals", "dev"),
      group(
        "or",
        cond("f-note", "contains", ""),
        cond("f-region", "oneOf", []),
      ),
    );
    expect(groupPath(tree)).toEqual(["r3", "r4"]);
  });

  it("leaves a skipped group out of an `or` too", () => {
    // 점수 = 20 또는 (꺼진 조건만 든 묶음) → 20 인 행만
    const tree = group(
      "and",
      group(
        "or",
        cond("f-score", "equals", 20),
        group(
          "and",
          cond("f-dept", "equals", "sales", { enabled: false }),
          cond("f-note", "contains", ""),
        ),
      ),
    );
    expect(groupPath(tree)).toEqual(["r3", "r4"]);
  });

  it("skips a test whose value is empty, given as a test (not through the tree)", () => {
    const at = (key: "score" | "note") => ({
      valueAt: (index: number) => ROWS[index]![key],
      name: key,
      ...(key === "score" ? { type: "number" } : {}),
    });
    const tests: ViewRowTestGroup = {
      op: "or",
      items: [
        { fields: [at("score")], op: "equals", value: 20 },
        { fields: [at("note")], op: "contains", value: "" },
      ],
    };
    expect(idsOf(viewRowsPassingGroup(ROWS.length, tests))).toEqual([
      "r3",
      "r4",
    ]);
  });

  it("is every row when the root skips", () => {
    const tree = group("and", cond("f-note", "contains", ""));
    expect(
      viewRowsPassingGroup(ROWS.length, viewRowTestGroupOf(tree, input, ROWS)),
    ).toBeUndefined();
    expect(groupPath(tree)).toEqual(["r1", "r2", "r3", "r4", "r5", "r6"]);
  });

  it("reads a two-level nesting", () => {
    // 점수 ≥ 10 그리고 (부서 = sales 또는 (지역 = seoul 그리고 점수 < 30))
    const tree = group(
      "and",
      cond("f-score", "gte", 10),
      group(
        "or",
        cond("f-dept", "equals", "sales"),
        group(
          "and",
          cond("f-region", "equals", "seoul"),
          cond("f-score", "lt", 30),
        ),
      ),
    );
    expect(groupPath(tree)).toEqual(["r2", "r3"]);
  });

  it("leaves out a condition whose field the schema does not have", () => {
    // (지워진 필드 = x 또는 부서 = ops) — 그 조건만 빠진다 (묶음을 통째로 빼는 것은 대입 판정의 몫)
    const tree = group(
      "and",
      group(
        "or",
        cond("f-gone", "equals", "x"),
        cond("f-dept", "equals", "ops"),
      ),
    );
    expect(groupPath(tree)).toEqual(["r5", "r6"]);
  });
});

describe("viewRowsPassingGroup — the flat path, the group path and the evaluator agree", () => {
  // 결정적 난수 (규모 · 모양 전용)
  let seed = 20261127;
  const next = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff);
  const pick = <T>(list: readonly T[]): T => list[next() % list.length]!;
  const DEPTS = ["sales", "dev", "ops", "hr"];
  const REGIONS = ["seoul", "busan", "daegu"];
  const NOTES = ["", "vip", "new", null, "vip new"];
  const rows = Array.from({ length: 400 }, (_, index) => ({
    id: `x${index}`,
    dept: pick(DEPTS),
    region: pick(REGIONS),
    score: next() % 41,
    note: pick(NOTES),
  })) as typeof ROWS;
  const leaf = (): ViewCondition => {
    const more = next() % 7 === 0 ? { enabled: false } : {};
    switch (next() % 8) {
      case 0:
        return cond("f-dept", "equals", pick(DEPTS), more);
      case 1:
        return cond("f-dept", "notEquals", pick(DEPTS), more);
      case 2:
        return cond("f-region", "oneOf", [pick(REGIONS), pick(REGIONS)], more);
      case 3:
        return cond("f-score", "gte", next() % 41, more);
      case 4:
        return cond(
          "f-score",
          "between",
          [next() % 20, 20 + (next() % 21)],
          more,
        );
      case 5:
        return cond("f-note", "contains", pick(["vip", "new", ""]), more);
      case 6:
        return cond(
          "f-note",
          next() % 2 ? "exists" : "notExists",
          undefined,
          more,
        );
      default:
        return cond("f-score", "lt", next() % 41, more);
    }
  };
  const tree = (depth: number): ViewConditionGroup =>
    group(
      depth === 0 ? "and" : pick(["and", "or"] as const),
      ...Array.from({ length: 1 + (next() % 4) }, () =>
        depth < 2 && next() % 3 === 0 ? tree(depth + 1) : leaf(),
      ),
    );

  it("300 random trees (nested · `or` · skipped conditions)", () => {
    let nested = 0;
    for (let run = 0; run < 300; run += 1) {
      const where = tree(0);
      if (where.items.some((item) => "items" in item)) nested += 1;
      expect(groupPath(where, rows), JSON.stringify(where)).toEqual(
        evaluator(where, rows),
      );
    }
    // (the trees do exercise the group path)
    expect(nested).toBeGreaterThan(100);
  });

  it("300 random flat `and` trees — the flat path too", () => {
    for (let run = 0; run < 300; run += 1) {
      const where = group(
        "and",
        ...Array.from({ length: 1 + (next() % 5) }, leaf),
      );
      const tests = viewRowTestGroupOf(where, input, rows);
      const flat = viewRowsPassing(
        rows.length,
        tests.items as readonly ViewRowTest[],
      ).pass;
      const answer = evaluator(where, rows);
      expect(idsOf(flat, rows), JSON.stringify(where)).toEqual(answer);
      expect(groupPath(where, rows)).toEqual(answer);
    }
  });

  it("does not change its input tests", () => {
    const tests: ViewRowTestGroup = viewRowTestGroupOf(
      group(
        "and",
        cond("f-score", "gte", 10),
        group("or", cond("f-dept", "equals", "sales")),
      ),
      input,
      ROWS,
    );
    const before = JSON.stringify(tests, (_key, value) =>
      typeof value === "function" ? "fn" : value,
    );
    viewRowsPassingGroup(ROWS.length, tests);
    viewRowsPassingGroup(ROWS.length, tests);
    expect(
      JSON.stringify(tests, (_key, value) =>
        typeof value === "function" ? "fn" : value,
      ),
    ).toBe(before);
  });
});

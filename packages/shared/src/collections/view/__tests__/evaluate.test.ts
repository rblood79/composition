import { describe, expect, it } from "vitest";
import type {
  ViewCondition,
  ViewConditionGroup,
  ViewQuery,
} from "../../../catalog/document/types";
import { catalogBoundRows } from "../../../catalog/runtime/dataBinding";
import { viewCompare } from "../comparison";
import { explainViewRow, runViewQueries, type ViewRunField } from "../evaluate";

/**
 * ADR-284 Phase 1 — the local view evaluator (one pure function for the Canvas, the Preview and
 * Publish). Expected rows are written by hand as row ids (never regenerated from the evaluator).
 */
const SCHEMA: ViewRunField[] = [
  { id: "f-id", key: "id", type: "string" },
  { id: "f-name", key: "name", type: "string" },
  { id: "f-gender", key: "gender", type: "string" },
  { id: "f-age", key: "age", type: "number" },
  { id: "f-joined", key: "joined", type: "date" },
  { id: "f-tags", key: "tags", type: "array" },
  { id: "f-active", key: "active", type: "boolean" },
];
const ROWS = [
  {
    id: "u1",
    name: "Kim",
    gender: "male",
    age: 31,
    joined: "2026-10-20",
    tags: ["a", "b"],
    active: true,
  },
  {
    id: "u2",
    name: "Park",
    gender: "female",
    age: 24,
    joined: "2026-09-01",
    tags: ["b"],
    active: false,
  },
  {
    id: "u3",
    name: "Lee",
    gender: "male",
    age: 45,
    joined: "2026-10-25T09:00:00Z",
    tags: [],
    active: true,
  },
  {
    id: "u4",
    name: "Élodie",
    gender: "female",
    age: 31,
    joined: "",
    tags: ["c"],
    active: true,
  },
];
const ids = (rows: readonly unknown[]) =>
  rows.map((row) => (row as { id: string }).id);

const condition = (
  op: ViewCondition["op"],
  field: string,
  patch: Partial<ViewCondition> = {},
): ViewCondition => ({
  id: `c-${field}-${op}`,
  fields: [[`data:field:${field}`]],
  op,
  ...patch,
});
const where = (
  items: ViewConditionGroup["items"],
  op: "and" | "or" = "and",
): ViewConditionGroup => ({ id: "where", op, items });

function run(
  query: ViewQuery | ViewQuery[],
  values: Record<string, unknown> = {},
  rows: readonly unknown[] = ROWS,
) {
  return runViewQueries(rows, {
    queries: Array.isArray(query) ? query : [query],
    schema: SCHEMA,
    resolve: (value) =>
      typeof value === "string" && value.startsWith("!")
        ? value in values
          ? { value: values[value] }
          : undefined
        : { value },
    today: "2026-10-26",
  });
}

describe("ADR-284 view evaluator — comparisons", () => {
  const filter = (c: ViewCondition, values?: Record<string, unknown>) =>
    ids(run({ where: where([c]) }, values).rows);

  it("text follows useFilter (`Intl.Collator` base): case · accents fold, empty search matches", () => {
    expect(filter(condition("contains", "f-name", { value: "e" }))).toEqual([
      "u3",
      "u4",
    ]);
    expect(filter(condition("startsWith", "f-name", { value: "elo" }))).toEqual(
      ["u4"],
    );
    expect(filter(condition("endsWith", "f-name", { value: "RK" }))).toEqual([
      "u2",
    ]);
    expect(filter(condition("equals", "f-gender", { value: "MALE" }))).toEqual([
      "u1",
      "u3",
    ]);
    expect(
      filter(condition("notEquals", "f-gender", { value: "male" })),
    ).toEqual(["u2", "u4"]);
    // (Accent-sensitive when asked.)
    expect(
      filter(
        condition("startsWith", "f-name", {
          value: "elo",
          sensitivity: "accent",
        }),
      ),
    ).toEqual([]);
  });

  it("not contains · not starts with · not ends with = the `!` of useFilter's (emoji's `!label.startsWith`); a list cell = no element", () => {
    expect(
      filter(condition("notStartsWith", "f-name", { value: "elo" })),
    ).toEqual(["u1", "u2", "u3"]);
    expect(filter(condition("notContains", "f-name", { value: "e" }))).toEqual(
      ["u1", "u2"],
    );
    expect(filter(condition("notEndsWith", "f-name", { value: "RK" }))).toEqual(
      ["u1", "u3", "u4"],
    );
    // (A list cell: no tag contains "b" — u1 · u2 hold one.)
    expect(filter(condition("notContains", "f-tags", { value: "b" }))).toEqual([
      "u3",
      "u4",
    ]);
  });

  it("numbers compare by value; `between` includes both ends, an empty end is open", () => {
    expect(filter(condition("gte", "f-age", { value: 31 }))).toEqual([
      "u1",
      "u3",
      "u4",
    ]);
    expect(filter(condition("gt", "f-age", { value: "31" }))).toEqual(["u3"]);
    expect(filter(condition("lt", "f-age", { value: 31 }))).toEqual(["u2"]);
    expect(filter(condition("lte", "f-age", { value: 24 }))).toEqual(["u2"]);
    expect(filter(condition("between", "f-age", { value: [24, 31] }))).toEqual([
      "u1",
      "u2",
      "u4",
    ]);
    expect(filter(condition("between", "f-age", { value: ["", 30] }))).toEqual([
      "u2",
    ]);
  });

  it("dates compare by day; withinLast counts back from today", () => {
    expect(
      filter(condition("after", "f-joined", { value: "2026-10-20" })),
    ).toEqual(["u3"]);
    expect(
      filter(condition("before", "f-joined", { value: "2026-10-20" })),
    ).toEqual(["u2"]);
    expect(
      filter(condition("equals", "f-joined", { value: "2026-10-25" })),
    ).toEqual(["u3"]);
    expect(
      filter(condition("withinLast", "f-joined", { value: 7, unit: "day" })),
    ).toEqual(["u1", "u3"]);
    // (A RAC CalendarDate-like value from a DatePicker variable.)
    expect(
      filter(condition("after", "f-joined", { value: "!var.d" }), {
        "!var.d": { year: 2026, month: 10, day: 24 },
      }),
    ).toEqual(["u3"]);
  });

  it('lists: oneOf · containsAny · containsAll; a Selection `Set` · `"all"`', () => {
    expect(
      filter(condition("oneOf", "f-name", { value: "!var.s" }), {
        "!var.s": new Set(["Kim", "Lee"]),
      }),
    ).toEqual(["u1", "u3"]);
    expect(
      filter(condition("containsAny", "f-tags", { value: ["b", "c"] })),
    ).toEqual(["u1", "u2", "u4"]);
    expect(
      filter(condition("containsAll", "f-tags", { value: ["a", "b"] })),
    ).toEqual(["u1"]);
    expect(
      filter(condition("oneOf", "f-name", { value: "!var.s" }), {
        "!var.s": "all",
      }),
    ).toEqual(["u1", "u2", "u3", "u4"]);
  });

  it("exists · notExists; booleans", () => {
    expect(filter(condition("exists", "f-joined"))).toEqual(["u1", "u2", "u3"]);
    expect(filter(condition("notExists", "f-tags"))).toEqual(["u3"]);
    expect(filter(condition("equals", "f-active", { value: false }))).toEqual([
      "u2",
    ]);
  });

  it("comparison table: the same function as the cell judge", () => {
    expect(viewCompare("contains", "Kim", "", { kind: "text" })).toBe(true);
    expect(viewCompare("equals", undefined, "", { kind: "text" })).toBe(false);
  });
});

describe("ADR-284 view evaluator — condition tree · skip · applied", () => {
  it("an empty value skips (「전체」), a skip literal skips, `enabled` false skips", () => {
    const gender = condition("equals", "f-gender", {
      value: "!var.g",
      skip: "all",
    });
    expect(
      ids(run({ where: where([gender]) }, { "!var.g": "all" }).rows),
    ).toHaveLength(4);
    expect(
      ids(run({ where: where([gender]) }, { "!var.g": "female" }).rows),
    ).toEqual(["u2", "u4"]);
    const search = condition("contains", "f-name", { value: "!var.q" });
    const result = run({ where: where([search]) }, { "!var.q": "" });
    expect(result.rows).toHaveLength(4);
    expect(result.applied).toBe(0);
    const active = condition("equals", "f-active", {
      value: true,
      enabled: "!var.onlyActive",
    });
    expect(
      ids(run({ where: where([active]) }, { "!var.onlyActive": false }).rows),
    ).toHaveLength(4);
    expect(
      ids(run({ where: where([active]) }, { "!var.onlyActive": true }).rows),
    ).toEqual(["u1", "u3", "u4"]);
  });

  it("and · or groups; a group whose items all skip is skipped", () => {
    const q = where([
      condition("equals", "f-gender", { value: "male" }),
      {
        id: "either",
        op: "or",
        items: [
          condition("lt", "f-age", { value: 40 }),
          condition("contains", "f-name", { value: "!var.q" }),
        ],
      },
    ]);
    expect(ids(run({ where: q }, { "!var.q": "" }).rows)).toEqual(["u1"]);
    expect(ids(run({ where: q }, { "!var.q": "lee" }).rows)).toEqual([
      "u1",
      "u3",
    ]);
    // (A nested group whose items all skip is skipped — it does not drop every row.)
    const nested = where([
      condition("equals", "f-gender", { value: "male" }),
      {
        id: "search",
        op: "or",
        items: [
          condition("contains", "f-name", { value: "!var.q" }),
          condition("startsWith", "f-name", { value: "!var.q" }),
        ],
      },
    ]);
    expect(ids(run({ where: nested }, { "!var.q": "" }).rows)).toEqual(["u1", "u3"]);
    // (Several fields: any matching — plants' name OR scientific.)
    const both: ViewCondition = {
      id: "both",
      fields: [["data:field:f-name"], ["data:field:f-gender"]],
      op: "contains",
      value: "fem",
    };
    expect(ids(run({ where: where([both]) }).rows)).toEqual(["u2", "u4"]);
  });

  it("a missing field or an unresolved reference is skipped and reported broken (never a silent miss)", () => {
    const result = run(
      {
        where: where([
          condition("equals", "f-gone", { value: "x" }),
          condition("equals", "f-gender", { value: "!var.missing" }),
        ]),
      },
      {},
    );
    expect(result.rows).toHaveLength(4);
    expect(result.broken).toEqual(["c-f-gone-equals", "c-f-gender-equals"]);
  });

  it("the run explanation reads the same verdicts as the run", () => {
    const query: ViewQuery = {
      where: where([
        condition("equals", "f-gender", { value: "male" }),
        condition("contains", "f-name", { value: "" }),
      ]),
    };
    const verdicts = explainViewRow(ROWS[1], {
      queries: [query],
      schema: SCHEMA,
      resolve: (value) => ({ value }),
    });
    expect(Object.fromEntries(verdicts)).toEqual({
      where: "miss",
      "c-f-gender-equals": "miss",
      "c-f-name-contains": "skip",
    });
  });
});

describe("ADR-284 view evaluator — sort · chain", () => {
  it("a literal sort · a sort variable ({column, direction} by field key or id), stable", () => {
    expect(
      ids(
        run({
          where: where([]),
          sort: { field: ["data:field:f-age"], direction: "descending" },
        }).rows,
      ),
    ).toEqual(["u3", "u1", "u4", "u2"]);
    expect(
      ids(
        run(
          { where: where([]), sort: { variableId: "data:variable:sort" } },
          {
            "!var.data:variable:sort": {
              column: "name",
              direction: "ascending",
            },
          },
        ).rows,
      ),
    ).toEqual(["u4", "u1", "u3", "u2"]);
  });

  it("a derived view runs on its source view's result", () => {
    const result = run([
      { where: where([condition("equals", "f-gender", { value: "male" })]) },
      { where: where([condition("gt", "f-age", { value: 40 })]) },
    ]);
    expect(ids(result.rows)).toEqual(["u3"]);
  });
});

describe("ADR-284 Decision 3 — the view runs before the display window", () => {
  // 200 rows; ids r1..r200. `even` = r101..r200 hold "late"; the display window is 100.
  const rows = Array.from({ length: 200 }, (_unused, index) => ({
    id: `r${index + 1}`,
    name: `Row ${index + 1}`,
    phase: index >= 100 ? "late" : "early",
  }));
  const collection = {
    id: "big",
    name: "Big",
    schema: [
      { id: "f-id", key: "id", type: "string" },
      { id: "f-name", key: "name", type: "string" },
      { id: "f-phase", key: "phase", type: "string" },
    ],
    mockData: rows,
    useMockData: true,
  };
  const binding = (value: string) => ({
    collectionId: "data:collection:big" as const,
    fieldMap: {},
    query: {
      queries: [
        {
          where: where([
            {
              id: "phase",
              fields: [["data:field:f-phase" as const]],
              op: "equals" as const,
              value,
            },
          ]),
        },
      ],
      values: {},
      names: [],
    },
  });

  it("rows past the 100th match: the result is r101..r200 (100 rows), all shown", () => {
    const bound = catalogBoundRows(binding("late"), [collection])!;
    expect(bound.map((row) => row.key)).toEqual(
      Array.from({ length: 100 }, (_unused, index) => `r${index + 101}`),
    );
    expect(bound.view).toEqual({
      matched: 100,
      loaded: 200,
      complete: true,
      broken: [],
      applied: 1,
    });
  });

  it("every row matching: 200 matched, the window shows 100 with the total", () => {
    const bound = catalogBoundRows(
      {
        ...binding(""),
        query: { ...binding("").query, queries: [{ where: where([]) }] },
      },
      [collection],
    )!;
    expect(bound).toHaveLength(100);
    expect(bound.total).toBe(200);
    expect(bound.view?.matched).toBe(200);
  });
});

describe("ADR-292 review 2026-10-29 M4 — a time-only date compares by its time", () => {
  it("equals · before · after between times; a time never matches a day", () => {
    const date = { kind: "date" } as const;
    expect(viewCompare("equals", "10:30", "10:30", date)).toBe(true);
    expect(viewCompare("equals", "10:30", "10:30:00", date)).toBe(true);
    expect(viewCompare("before", "09:15", "10:30", date)).toBe(true);
    expect(viewCompare("after", "10:30:01", "10:30", date)).toBe(true);
    expect(
      viewCompare("equals", "10:30", { hour: 10, minute: 30 }, date),
    ).toBe(true);
    expect(viewCompare("equals", "10:30", "2026-10-29", date)).toBe(false);
    expect(viewCompare("equals", "2026-10-29T10:30", "2026-10-29", date)).toBe(
      true,
    );
  });
  it("runs in a view query", () => {
    const rows = [
      { id: "one", at: "10:30" },
      { id: "two", at: "11:00" },
    ];
    const result = runViewQueries(rows, {
      queries: [
        {
          where: {
            id: "w",
            op: "and",
            items: [
              {
                id: "c",
                fields: [["data:field:at"]],
                op: "equals",
                value: "10:30",
              },
            ],
          },
        },
      ],
      schema: [{ id: "at", key: "at", type: "date" }],
      resolve: (value: unknown) => ({ value }),
    } as never);
    expect(result.rows).toEqual([rows[0]]);
  });
});

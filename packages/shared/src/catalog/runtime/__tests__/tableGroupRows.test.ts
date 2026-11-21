import { describe, expect, it } from "vitest";
import type { CatalogBoundRow } from "../../resolution/resolver";
import {
  catalogColumnMenuItems,
  catalogColumnMenuPatch,
} from "../tableColumnMenu";
import { catalogGroupBoundRows } from "../tableGroupRows";
import {
  catalogTableGroupKey,
  catalogTableGrouping,
  catalogTableStateRowSlices,
} from "../tableRowSlices";
import { catalogTableStateWith, type CatalogTableShape } from "../tableState";

/**
 * ADR-315 Phase 5 — a bound Table's group rows (local): the rows grouped by the grouping's fields
 * (exact equality), each group row's value · count · aggregates over all its rows, a collapsed
 * group holding one placeholder child. Expected values are written by hand.
 */
const row = (
  key: string,
  values: Record<string, unknown>,
): CatalogBoundRow => ({
  key,
  values,
});
const ROWS = [
  row("r1", { team: "A", city: "Seoul", score: 10 }),
  row("r2", { team: "a", city: "Seoul", score: 4 }),
  row("r3", { team: "A", city: "Busan", score: 30 }),
  row("r4", { team: null, city: "Seoul", score: 1 }),
  row("r5", { team: "", city: "Busan", score: 2 }),
  row("r6", { team: "A", city: "Seoul", score: 20 }),
];
const shape = (rows: readonly CatalogBoundRow[]): unknown[] =>
  rows.map((item) => ({
    key: item.key,
    values: item.values,
    ...(item.group ? { group: item.group } : {}),
    ...(item.placeholder ? { placeholder: true } : {}),
    ...(item.children ? { children: shape(item.children) } : {}),
  }));

describe("ADR-315 Phase 5 — group rows", () => {
  it("one group per exact value in first-seen order — 「A」 · 「a」 and null · 「」 are four groups; collapsed groups hold one placeholder", () => {
    const groups = catalogGroupBoundRows(ROWS, {
      keys: ["team"],
      aggregates: [
        { key: "score", fn: "sum" },
        { key: "city", fn: "uniqueCount" },
      ],
      expanded: [],
    });
    expect(
      groups.map((group) => [group.key, group.values, group.group]),
    ).toEqual([
      [
        catalogTableGroupKey(["A"]),
        { team: "A", score: 60, city: 2 },
        { column: "team", count: 3, depth: 0, expanded: false },
      ],
      [
        catalogTableGroupKey(["a"]),
        { team: "a", score: 4, city: 1 },
        { column: "team", count: 1, depth: 0, expanded: false },
      ],
      [
        catalogTableGroupKey([null]),
        { team: null, score: 1, city: 1 },
        { column: "team", count: 1, depth: 0, expanded: false },
      ],
      [
        catalogTableGroupKey([""]),
        { team: "", score: 2, city: 1 },
        { column: "team", count: 1, depth: 0, expanded: false },
      ],
    ]);
    expect(groups[0]!.children).toEqual([
      {
        key: `${catalogTableGroupKey(["A"])}/collapsed`,
        values: {},
        placeholder: true,
      },
    ]);
  });

  it("an expanded group holds its rows in their order; two levels nest — the inner keys carry the outer value", () => {
    const outer = catalogTableGroupKey(["A"]);
    const groups = catalogGroupBoundRows(ROWS.slice(0, 3).concat(ROWS[5]!), {
      keys: ["team", "city"],
      aggregates: [{ key: "score", fn: "max" }],
      expanded: [outer, catalogTableGroupKey(["A", "Seoul"])],
    });
    expect(shape(groups.slice(0, 1))).toEqual([
      {
        key: outer,
        values: { team: "A", score: 30 },
        group: { column: "team", count: 3, depth: 0, expanded: true },
        children: [
          {
            key: catalogTableGroupKey(["A", "Seoul"]),
            values: { city: "Seoul", score: 20 },
            group: { column: "city", count: 2, depth: 1, expanded: true },
            children: [
              { key: "r1", values: ROWS[0]!.values },
              { key: "r6", values: ROWS[5]!.values },
            ],
          },
          {
            key: catalogTableGroupKey(["A", "Busan"]),
            values: { city: "Busan", score: 30 },
            group: { column: "city", count: 1, depth: 1, expanded: false },
            children: [
              {
                key: `${catalogTableGroupKey(["A", "Busan"])}/collapsed`,
                values: {},
                placeholder: true,
              },
            ],
          },
        ],
      },
    ]);
  });

  it("a group's count aggregate is its row count", () => {
    const groups = catalogGroupBoundRows(ROWS, {
      keys: ["city"],
      aggregates: [{ key: "score", fn: "count" }],
      expanded: [],
    });
    expect(groups.map((group) => group.values.score)).toEqual([4, 2]);
  });

  it("the Builder's Canvas asks for no child of a closed group (`closedChild: false`) — an open one keeps its rows", () => {
    const groups = catalogGroupBoundRows(ROWS, {
      keys: ["city"],
      aggregates: [],
      expanded: [catalogTableGroupKey(["Busan"])],
      closedChild: false,
    });
    expect(groups[0]).not.toHaveProperty("children");
    expect(groups[1]!.children!.map((item) => item.key)).toEqual(["r3", "r5"]);
  });

  it("「all」 expands every group", () => {
    const groups = catalogGroupBoundRows(ROWS, {
      keys: ["city"],
      aggregates: [],
      expanded: "all",
    });
    expect(
      groups.map((group) => group.children!.map((item) => item.key)),
    ).toEqual([
      ["r1", "r2", "r4", "r6"],
      ["r3", "r5"],
    ]);
  });
});

describe("ADR-315 Phase 5 — the grouping slice", () => {
  const columns = [
    { key: "team", defaultGrouped: true, aggregate: "count" },
    { key: "city" },
    { key: "score", aggregate: "median" },
  ];
  it("no state: the author's grouping and each Column's aggregate; a grouped Column's sort stands first", () => {
    expect(catalogTableGrouping(undefined, columns)).toEqual(["team"]);
    expect(
      catalogTableStateRowSlices(
        {
          sort: [
            { column: "score", direction: "descending" },
            { column: "team", direction: "ascending" },
          ],
        },
        columns,
      ),
    ).toEqual({
      sorts: [
        { key: "team", direction: "ascending" },
        { key: "score", direction: "descending" },
      ],
      groups: {
        keys: ["team"],
        aggregates: [
          { key: "team", fn: "count" },
          { key: "score", fn: "median" },
        ],
        expanded: [],
      },
    });
  });

  it("a state's grouping replaces the author's — an empty list is 「not grouped」", () => {
    expect(catalogTableGrouping({ grouping: ["city"] }, columns)).toEqual([
      "city",
    ]);
    expect(catalogTableGrouping({ grouping: [] }, columns)).toEqual([]);
    expect(
      catalogTableStateRowSlices({ grouping: [] }, columns),
    ).toBeUndefined();
  });

  it("the state holds a grouping only when it differs from the author's", () => {
    const table: CatalogTableShape = {
      columns: [{ key: "team", grouped: true }, { key: "city" }],
    };
    expect(catalogTableStateWith({}, { grouping: ["team"] }, table)).toEqual(
      {},
    );
    expect(catalogTableStateWith({}, { grouping: [] }, table)).toEqual({
      grouping: [],
    });
    expect(catalogTableStateWith({}, { grouping: ["city"] }, table)).toEqual({
      grouping: ["city"],
    });
    // (No authored grouping: an empty list is no slice.)
    expect(
      catalogTableStateWith(
        {},
        { grouping: [] },
        { columns: [{ key: "city" }] },
      ),
    ).toEqual({});
  });
});

describe("ADR-315 Phase 5 — the column menu's grouping items", () => {
  const column = (key: string, groupable = true) => ({
    key,
    allowsSorting: false,
    allowsHiding: false,
    allowsPinning: false,
    allowsResizing: false,
    sortFirstDirection: "ascending" as const,
    allowsGrouping: true,
    groupable,
  });
  const table = (state = {}) => ({
    shape: {
      columns: [{ key: "team", grouped: true }, { key: "city" }],
    } as CatalogTableShape,
    state,
    allowsColumnReordering: false,
  });
  it("「Group by column」 adds the Column to the grouping (the author's first); 「Ungroup」 takes it out", () => {
    expect(catalogColumnMenuItems(column("city"), table())).toEqual([
      { id: "group" },
    ]);
    expect(catalogColumnMenuPatch("group", column("city"), table())).toEqual({
      grouping: ["team", "city"],
    });
    expect(catalogColumnMenuItems(column("team"), table())).toEqual([
      { id: "ungroup" },
    ]);
    expect(catalogColumnMenuPatch("ungroup", column("team"), table())).toEqual({
      grouping: [],
    });
    // (A state's grouping is the one now.)
    expect(
      catalogColumnMenuItems(column("team"), table({ grouping: [] })),
    ).toEqual([{ id: "group" }]);
  });
  it("a Column without a data field offers it off", () => {
    expect(catalogColumnMenuItems(column("city", false), table())).toEqual([
      { id: "group", disabled: true },
    ]);
    expect(
      catalogColumnMenuPatch("group", column("city", false), table()),
    ).toBeUndefined();
  });
});

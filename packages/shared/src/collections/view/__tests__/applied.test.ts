import { describe, expect, it } from "vitest";
import type { ViewQuery } from "../../../catalog/document/types";
import { catalogBoundRows } from "../../../catalog/runtime/dataBinding";
import { catalogCountlessViews } from "../../../catalog/runtime/viewQuery";
import { runViewQueries, type ViewRunField } from "../evaluate";

/**
 * ADR-284 결정 3 — 「적용 조건 수」: the `applied` aggregate of a derived view is the number of
 * conditions its source views apply (a skipped one — an empty search, an unchecked 「적용」 — is
 * not counted). Expected values are written by hand.
 */
const SCHEMA: ViewRunField[] = [
  { id: "f-name", key: "name", type: "string" },
  { id: "f-fav", key: "isFavorite", type: "boolean" },
  { id: "f-cycle", key: "cycle", type: "string" },
];
const ROWS = [
  { name: "Aloe", isFavorite: true, cycle: "Perennial" },
  { name: "Basil", isFavorite: true, cycle: "Annual" },
  { name: "Cactus", isFavorite: false, cycle: "Perennial" },
];
const VALUES: Record<string, unknown> = {
  "!var.search": "",
  "!var.favorite": true,
  "!var.cycles": ["Perennial"],
};
const SOURCE: ViewQuery = {
  where: {
    id: "where",
    op: "and",
    items: [
      {
        id: "search",
        fields: [["data:field:f-name"]],
        op: "contains",
        value: "!var.search",
      },
      {
        id: "favorite",
        fields: [["data:field:f-fav"]],
        op: "equals",
        value: true,
        enabled: "!var.favorite",
      },
      {
        id: "cycles",
        fields: [["data:field:f-cycle"]],
        op: "oneOf",
        value: "!var.cycles",
      },
    ],
  },
};
const COUNTS: ViewQuery = {
  where: { id: "where", op: "and", items: [] },
  aggregates: [
    { fn: "count", as: "count" },
    { fn: "applied", as: "applied" },
  ],
};
const run = (values: Record<string, unknown>) =>
  runViewQueries(ROWS, {
    queries: [SOURCE, COUNTS],
    schema: SCHEMA,
    resolve: (value) =>
      typeof value === "string" && value.startsWith("!var.")
        ? { value: values[value] }
        : { value },
  });

describe("ADR-284 결정 3 — 적용 조건 수 (applied)", () => {
  it("counts the source view's applied conditions — the empty search is skipped", () => {
    expect(run(VALUES).rows).toEqual([{ count: 1, applied: 2 }]);
  });

  it("a nested group (「또는 조건」 — a search over two names) is one condition", () => {
    const or: ViewQuery = {
      where: {
        id: "where",
        op: "and",
        items: [
          {
            id: "search",
            op: "or",
            items: [
              {
                id: "a",
                fields: [["data:field:f-name"]],
                op: "contains",
                value: "!var.search",
              },
              {
                id: "b",
                fields: [["data:field:f-cycle"]],
                op: "contains",
                value: "!var.search",
              },
            ],
          },
        ],
      },
    };
    const result = runViewQueries(ROWS, {
      queries: [or, COUNTS],
      schema: SCHEMA,
      resolve: (value) =>
        value === "!var.search" ? { value: "per" } : { value },
    });
    expect(result.rows).toEqual([{ count: 2, applied: 1 }]);
  });

  it("0 when every condition skips (no filter)", () => {
    expect(
      run({ "!var.search": "", "!var.favorite": false, "!var.cycles": [] })
        .rows,
    ).toEqual([{ count: 3, applied: 0 }]);
  });

  it("over a view the server answered: the view's applied conditions — not the server's total", () => {
    const api = {
      id: "plants",
      name: "Plants",
      schema: SCHEMA,
      mockData: [],
      useMockData: false,
      runtimeData: ROWS.slice(0, 1),
    };
    const bound = (total?: number) =>
      catalogBoundRows(
        {
          collectionId: "data:collection:plants",
          fieldMap: { value: "data:field:applied" },
          query: {
            queries: [
              {
                ...SOURCE,
                where: {
                  ...SOURCE.where,
                  items: SOURCE.where.items.map((item) =>
                    "items" in item
                      ? item
                      : {
                          ...item,
                          ...(item.value === "!var.search"
                            ? { value: "" }
                            : item.value === "!var.cycles"
                              ? { value: ["Perennial"] }
                              : {}),
                          ...(item.enabled ? { enabled: "true" } : {}),
                        },
                  ),
                },
              },
              COUNTS,
            ],
            values: {},
            names: [],
            served: {
              complete: total !== undefined,
              depth: 1,
              ...(total !== undefined ? { total } : {}),
            },
          },
        } as never,
        [api] as never,
      )!;
    expect(bound(40)[0]!.values).toMatchObject({ count: 40, applied: 2 });
    expect(bound()[0]!.values).toMatchObject({ count: "1+", applied: 2 });
  });

  it("over part of the data (an API page): the count says 「at least」, the applied conditions are whole", () => {
    const api = {
      id: "plants",
      name: "Plants",
      schema: SCHEMA,
      mockData: [],
      useMockData: false,
      runtimeData: ROWS,
    };
    const rows = catalogBoundRows(
      {
        collectionId: "data:collection:plants",
        fieldMap: { value: "data:field:applied" },
        query: {
          queries: [SOURCE, COUNTS],
          values: VALUES,
          names: [],
          loaded: { complete: false },
        },
      } as never,
      [api] as never,
    )!;
    expect(rows[0]!.values).toMatchObject({ count: "1+", applied: 2 });
  });

  it("a request carries the views before an applied-only view (like a count-only one)", () => {
    expect(catalogCountlessViews([SOURCE, COUNTS])).toEqual([SOURCE]);
  });
});

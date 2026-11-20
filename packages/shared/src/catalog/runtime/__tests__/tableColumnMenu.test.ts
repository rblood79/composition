import { describe, expect, it } from "vitest";
import {
  catalogColumnMenuItems,
  catalogColumnFilterPatch,
  catalogColumnMenuPatch,
  type CatalogColumnMenuColumn,
  type CatalogColumnMenuTable,
} from "../tableColumnMenu";
import type { CatalogTableState } from "../tableState";

/** ADR-315 Phase 4 — a Column's menu: its items and the slice each writes (`tableColumnMenu.ts`). */
const COLUMNS = ["a", "b", "c", "d"].map((key) => ({
  key,
  ...(key === "a" ? { rowHeader: true } : {}),
}));
const column = (
  key: string,
  allows: Partial<CatalogColumnMenuColumn> = {},
): CatalogColumnMenuColumn => ({
  key,
  allowsSorting: false,
  allowsHiding: false,
  allowsPinning: false,
  allowsResizing: false,
  sortFirstDirection: "ascending",
  ...allows,
});
const table = (
  state: CatalogTableState = {},
  more: Partial<CatalogColumnMenuTable["shape"]> = {},
  reorder = true,
): CatalogColumnMenuTable => ({
  shape: { columns: COLUMNS, ...more },
  state,
  allowsColumnReordering: reorder,
});
const ids = (items: ReturnType<typeof catalogColumnMenuItems>) =>
  items.map((item) => (item.disabled ? `${item.id}:off` : item.id));

describe("catalogColumnMenuItems", () => {
  it("offers only what the author allowed (no reorder → no move items)", () => {
    expect(
      ids(catalogColumnMenuItems(column("b"), table({}, {}, false))),
    ).toEqual([]);
    expect(
      ids(
        catalogColumnMenuItems(
          column("b", { allowsSorting: true, allowsResizing: true }),
          table({}, {}, false),
        ),
      ),
    ).toEqual(["sort-asc", "sort-desc", "resize"]);
  });

  it("「Add to sort」 only on a multi-sort Table holding a sort without this column, under its most", () => {
    const sortable = column("b", { allowsSorting: true });
    const sorted: CatalogTableState = {
      sort: [{ column: "a", direction: "ascending" }],
    };
    expect(ids(catalogColumnMenuItems(sortable, table(sorted)))).not.toContain(
      "sort-add",
    );
    expect(
      ids(catalogColumnMenuItems(sortable, table(sorted, { multiSort: true }))),
    ).toContain("sort-add");
    expect(
      ids(
        catalogColumnMenuItems(
          sortable,
          table(sorted, { multiSort: true, maxSortColumns: 1 }),
        ),
      ),
    ).not.toContain("sort-add");
    expect(
      ids(
        catalogColumnMenuItems(
          column("a", { allowsSorting: true }),
          table(sorted, { multiSort: true }),
        ),
      ),
    ).not.toContain("sort-add");
    expect(
      catalogColumnMenuPatch(
        "sort-add",
        column("b", { allowsSorting: true, sortFirstDirection: "descending" }),
        table(sorted, { multiSort: true }),
      ),
    ).toEqual({
      sort: [
        { column: "a", direction: "ascending" },
        { column: "b", direction: "descending" },
      ],
    });
  });

  it("a move passes the next shown column — a hidden one keeps its place", () => {
    const state: CatalogTableState = { hiddenColumns: ["c"] };
    expect(
      catalogColumnMenuPatch("move-after", column("b"), table(state)),
    ).toEqual({ columnOrder: ["a", "c", "d", "b"] });
    expect(ids(catalogColumnMenuItems(column("d"), table(state)))).toEqual([
      "move-before",
      "move-after:off",
    ]);
    // (an item the menu does not offer now writes nothing)
    expect(
      catalogColumnMenuPatch("move-after", column("d"), table(state)),
    ).toBeUndefined();
  });

  it("a pinned column moves within its side; pinning joins the side next to the unpinned ones", () => {
    const state: CatalogTableState = {
      pinnedColumns: { start: [], end: ["c", "d"] },
    };
    expect(
      catalogColumnMenuPatch("move-before", column("d"), table(state)),
    ).toEqual({ pinnedColumns: { start: [], end: ["d", "c"] } });
    expect(ids(catalogColumnMenuItems(column("c"), table(state)))).toEqual([
      "move-before:off",
      "move-after",
    ]);
    const pinnable = column("b", { allowsPinning: true });
    expect(catalogColumnMenuPatch("pin-end", pinnable, table(state))).toEqual({
      pinnedColumns: { start: [], end: ["b", "c", "d"] },
    });
    expect(catalogColumnMenuPatch("pin-start", pinnable, table(state))).toEqual(
      { pinnedColumns: { start: ["b"], end: ["c", "d"] } },
    );
    expect(
      catalogColumnMenuPatch(
        "unpin",
        column("c", { allowsPinning: true }),
        table(state),
      ),
    ).toEqual({ pinnedColumns: { start: [], end: ["d"] } });
  });

  it("the authored defaults are the lists a state without that slice shows", () => {
    const authored = table(
      {},
      {
        columns: [
          { key: "a", rowHeader: true },
          { key: "b", hidden: true },
          { key: "c", pinned: "start" },
          { key: "d" },
        ],
      },
    );
    expect(
      catalogColumnMenuPatch(
        "hide",
        column("d", { allowsHiding: true }),
        authored,
      ),
    ).toEqual({ hiddenColumns: ["b", "d"] });
    expect(
      ids(
        catalogColumnMenuItems(column("c", { allowsPinning: true }), authored),
      ),
    ).toEqual(["pin-end", "unpin", "move-before:off", "move-after:off"]);
    // (the last shown row header cannot hide)
    expect(
      ids(
        catalogColumnMenuItems(column("a", { allowsHiding: true }), authored),
      ),
    ).toContain("hide:off");
  });
});

/** ADR-315 Phase 4 증분 4c — the filter items and the filter a Column's dialog writes. */
describe("column filter (4c)", () => {
  const filterable = (more: Partial<CatalogColumnMenuColumn> = {}) =>
    column("b", {
      allowsSorting: true,
      allowsFiltering: true,
      filterOps: ["equals", "contains", "oneOf", "exists"],
      ...more,
    });

  it("「Filter…」 after the sort items; off when the column has no comparison now; 「Clear filter」 only while filtered", () => {
    expect(
      ids(catalogColumnMenuItems(filterable(), table({}, {}, false))),
    ).toEqual(["sort-asc", "sort-desc", "filter"]);
    // (no field — an unbound Table · a role column — or none the request carries)
    expect(
      ids(
        catalogColumnMenuItems(
          filterable({ filterOps: [] }),
          table({}, {}, false),
        ),
      ),
    ).toEqual(["sort-asc", "sort-desc", "filter:off"]);
    const filtered: CatalogTableState = {
      columnFilters: [
        { column: "c", condition: { op: "equals", value: "x" } },
        { column: "b", condition: { op: "contains", value: "y" } },
      ],
    };
    expect(
      ids(catalogColumnMenuItems(filterable(), table(filtered, {}, false))),
    ).toEqual(["sort-asc", "sort-desc", "filter", "clear-filter"]);
    expect(
      ids(
        catalogColumnMenuItems(
          column("b", { allowsSorting: true }),
          table(filtered, {}, false),
        ),
      ),
    ).toEqual(["sort-asc", "sort-desc"]);
  });

  it("「Clear filter」 drops this column's filter only; 「Filter…」 writes nothing (the dialog does)", () => {
    const filtered: CatalogTableState = {
      columnFilters: [
        { column: "c", condition: { op: "equals", value: "x" } },
        { column: "b", condition: { op: "contains", value: "y" } },
      ],
    };
    expect(
      catalogColumnMenuPatch("clear-filter", filterable(), table(filtered)),
    ).toEqual({
      columnFilters: [{ column: "c", condition: { op: "equals", value: "x" } }],
    });
    expect(
      catalogColumnMenuPatch("filter", filterable(), table(filtered)),
    ).toBeUndefined();
  });

  it("the dialog's write replaces this column's filter in place, drops it when empty, refuses an op not offered", () => {
    const filtered: CatalogTableState = {
      columnFilters: [
        { column: "b", condition: { op: "contains", value: "y" } },
        { column: "c", condition: { op: "equals", value: "x" } },
      ],
    };
    expect(
      catalogColumnFilterPatch(filterable(), table(filtered), {
        op: "oneOf",
        value: ["p", "q"],
      }),
    ).toEqual({
      columnFilters: [
        { column: "b", condition: { op: "oneOf", value: ["p", "q"] } },
        { column: "c", condition: { op: "equals", value: "x" } },
      ],
    });
    // (an empty value is no filter — `viewConditionSkips`; `exists` takes none)
    expect(
      catalogColumnFilterPatch(filterable(), table(filtered), {
        op: "contains",
        value: "",
      }),
    ).toEqual({
      columnFilters: [{ column: "c", condition: { op: "equals", value: "x" } }],
    });
    expect(
      catalogColumnFilterPatch(filterable(), table({}), { op: "exists" }),
    ).toEqual({
      columnFilters: [{ column: "b", condition: { op: "exists" } }],
    });
    expect(
      catalogColumnFilterPatch(filterable(), table(filtered), undefined),
    ).toEqual({
      columnFilters: [{ column: "c", condition: { op: "equals", value: "x" } }],
    });
    expect(
      catalogColumnFilterPatch(filterable(), table({}), {
        op: "between",
        value: [1, 2],
      }),
    ).toBeUndefined();
    expect(
      catalogColumnFilterPatch(
        column("b", { filterOps: ["equals"] }),
        table({}),
        { op: "equals", value: "x" },
      ),
    ).toBeUndefined();
  });
});

/**
 * ADR-315 Phase 4 — a Column's menu (S2 `ColumnWithMenu` — breakdown §5.3 「열 메뉴」): its items
 * as the Table's state is now, and the state slice each item writes. One place for both — the
 * Preview session asks it (`tableColumnMenu` · `runTableColumnMenu`), the DOM only draws the items
 * and names the one pressed. An operation the author did not allow has no item (the Column's
 * `allowsSorting` · `allowsHiding` · `allowsPinning` · `allowsResizing`, the Table's
 * `allowsColumnReordering` · multi-column sort, the Column's `allowsFiltering`); an item that can
 * do nothing now (the edge column's move, the last row header's hide, a filter on a column with no
 * comparison) is there and disabled.
 *
 * Every write goes through `session.setTableState` (the rules between slices). The resize item is
 * RAC's (`startResize` — the DOM's) and 「Filter…」 opens the Column's filter dialog (the DOM's — its
 * write is `catalogColumnFilterPatch`); the others write a slice here.
 */
import type { ViewComparison } from "../document/types";
import {
  viewConditionSkips,
  type ViewFieldKind,
} from "../../collections/view/comparison";
import type {
  CatalogTableColumnFilter,
  CatalogTableShape,
  CatalogTableSortItem,
  CatalogTableState,
} from "./tableState";

export type CatalogColumnMenuItemId =
  | "sort-asc"
  | "sort-desc"
  | "sort-add"
  | "filter"
  | "clear-filter"
  | "hide"
  | "pin-start"
  | "pin-end"
  | "unpin"
  | "move-before"
  | "move-after"
  | "resize";

export interface CatalogColumnMenuItem {
  readonly id: CatalogColumnMenuItemId;
  readonly disabled?: true;
}

/** What the menu reads of the Column whose menu it is. */
export interface CatalogColumnMenuColumn {
  readonly key: string;
  readonly allowsSorting: boolean;
  readonly allowsHiding: boolean;
  readonly allowsPinning: boolean;
  readonly allowsResizing: boolean;
  readonly sortFirstDirection: "ascending" | "descending";
  /** ADR-315 Phase 4 증분 4c — the end user may filter this Column (TanStack `enableColumnFilter`). */
  readonly allowsFiltering?: boolean;
  /**
   * The comparisons a filter of this Column may use now: its field kind's
   * (`VIEW_COMPARISONS_BY_KIND`) that the Table's rows' request carries (`shape.filters`). Empty =
   * none (no field of the data — an unbound Table, a role's column): 「Filter…」 is off.
   */
  readonly filterOps?: readonly ViewComparison[];
}

/**
 * A Table Column's candidate values (TanStack faceting — `session.tableFacet`): each value of its
 * field among the rows the Table's other slices keep, with the rows it would give; the least ·
 * most (a number · a date field); `partial` = the candidates of the `loaded` rows only (an
 * endpoint's pages · a server's answer — 「불러온 N 행 기준」).
 */
export interface CatalogTableFacet {
  readonly values: readonly {
    readonly value: unknown;
    readonly count: number;
  }[];
  readonly min?: unknown;
  readonly max?: unknown;
  readonly partial: boolean;
  readonly loaded: number;
}

/** ADR-315 Phase 4 증분 4c — what a Column's filter dialog shows (`session.tableColumnFilter`). */
export interface CatalogColumnFilterView {
  /** The Column's field kind (the value input's). */
  readonly kind: ViewFieldKind;
  /** The comparisons it may use now (`CatalogColumnMenuColumn.filterOps`), the kind's order. */
  readonly ops: readonly ViewComparison[];
  /** Its filter now. */
  readonly condition?: CatalogTableColumnFilter["condition"];
  readonly facet?: CatalogTableFacet;
}

/** What the menu reads of its Table. */
export interface CatalogColumnMenuTable {
  readonly shape: CatalogTableShape;
  readonly state: CatalogTableState;
  readonly allowsColumnReordering: boolean;
}

/** The hidden columns and the pinned sides now: the state's, else the authored defaults. */
function columnsNow(table: CatalogColumnMenuTable) {
  const { shape, state } = table;
  return {
    hidden: new Set(
      state.hiddenColumns ??
        shape.columns
          .filter((column) => column.hidden)
          .map((column) => column.key),
    ),
    pinned: state.pinnedColumns ?? {
      start: shape.columns
        .filter((column) => column.pinned === "start")
        .map((column) => column.key),
      end: shape.columns
        .filter((column) => column.pinned === "end")
        .map((column) => column.key),
    },
  };
}

/**
 * The list a Column moves in and its place there: its pinned side's list, else the unpinned
 * columns in the projection's order (`columnOrder` first, then the authored order —
 * `catalogProjectTableColumns`). Hidden columns are in the list (their place is kept) but are no
 * neighbour to move past.
 */
function moveList(
  key: string,
  table: CatalogColumnMenuTable,
): {
  readonly side?: "start" | "end";
  readonly list: readonly string[];
  readonly shown: (key: string) => boolean;
} {
  const { hidden, pinned } = columnsNow(table);
  const shown = (other: string) => !hidden.has(other);
  if (pinned.start.includes(key))
    return { side: "start", list: pinned.start, shown };
  if (pinned.end.includes(key)) return { side: "end", list: pinned.end, shown };
  const order = table.state.columnOrder ?? [];
  const at = (other: string) => {
    const index = order.indexOf(other);
    return index < 0 ? Infinity : index;
  };
  const list = table.shape.columns
    .map((column, place) => ({ key: column.key, place }))
    .filter(
      (column) =>
        !pinned.start.includes(column.key) && !pinned.end.includes(column.key),
    )
    .sort((a, b) => at(a.key) - at(b.key) || a.place - b.place)
    .map((column) => column.key);
  return { list, shown };
}

/** The shown column next to `key` in its list (`step` −1 before, +1 after), if any. */
function neighbour(
  key: string,
  step: -1 | 1,
  move: ReturnType<typeof moveList>,
): string | undefined {
  const from = move.list.indexOf(key);
  for (
    let index = from + step;
    index >= 0 && index < move.list.length;
    index += step
  )
    if (move.shown(move.list[index]!)) return move.list[index];
  return undefined;
}

/** Whether hiding the Column would leave no row header column (RAC throws without one). */
function lastRowHeader(key: string, table: CatalogColumnMenuTable): boolean {
  const { hidden } = columnsNow(table);
  const headers = table.shape.columns.filter((column) => column.rowHeader);
  return (
    headers.some((column) => column.key === key) &&
    headers.every((column) => column.key === key || hidden.has(column.key))
  );
}

/** Whether the Table takes one more column into its sort (several sorts, under its most). */
function addsToSort(
  column: CatalogColumnMenuColumn,
  table: CatalogColumnMenuTable,
): boolean {
  const sort = table.state.sort ?? [];
  return (
    table.shape.multiSort === true &&
    sort.length > 0 &&
    !sort.some((item) => item.column === column.key) &&
    (table.shape.maxSortColumns === undefined ||
      sort.length < table.shape.maxSortColumns)
  );
}

/** The Column's filter in the Table's state, if any. */
function filterOf(
  key: string,
  table: CatalogColumnMenuTable,
): CatalogTableColumnFilter | undefined {
  return table.state.columnFilters?.find((filter) => filter.column === key);
}

/** The Table's column filters with this Column's replaced in place (or dropped — `undefined`). */
function withFilter(
  key: string,
  table: CatalogColumnMenuTable,
  condition: CatalogTableColumnFilter["condition"] | undefined,
): Partial<CatalogTableState> {
  const held = table.state.columnFilters ?? [];
  const at = held.findIndex((filter) => filter.column === key);
  const entry = condition ? { column: key, condition } : undefined;
  const next =
    at < 0
      ? entry
        ? [...held, entry]
        : held
      : entry
        ? held.map((filter, index) => (index === at ? entry : filter))
        : held.filter((_, index) => index !== at);
  return { columnFilters: next };
}

/**
 * ADR-315 Phase 4 증분 4c — the slice a Column's filter dialog writes: its condition as this
 * Column's filter (in place of the one it had), none when the condition is empty (a value that
 * skips it — `viewConditionSkips`) or cleared (`undefined`). Undefined = no write: the Column takes
 * no filter, or not of that comparison.
 */
export function catalogColumnFilterPatch(
  column: CatalogColumnMenuColumn,
  table: CatalogColumnMenuTable,
  condition: CatalogTableColumnFilter["condition"] | undefined,
): Partial<CatalogTableState> | undefined {
  if (!column.allowsFiltering) return undefined;
  if (!condition) return withFilter(column.key, table, undefined);
  if (!column.filterOps?.includes(condition.op)) return undefined;
  const valueless = condition.op === "exists" || condition.op === "notExists";
  return withFilter(
    column.key,
    table,
    valueless
      ? { op: condition.op }
      : viewConditionSkips(condition.op, condition.value)
        ? undefined
        : condition,
  );
}

/** The items of a Column's menu, in the menu's order. */
export function catalogColumnMenuItems(
  column: CatalogColumnMenuColumn,
  table: CatalogColumnMenuTable,
): readonly CatalogColumnMenuItem[] {
  const items: CatalogColumnMenuItem[] = [];
  const item = (id: CatalogColumnMenuItemId, disabled = false) =>
    items.push(disabled ? { id, disabled: true } : { id });
  if (column.allowsSorting) {
    item("sort-asc");
    item("sort-desc");
    if (addsToSort(column, table)) item("sort-add");
  }
  if (column.allowsFiltering) {
    item("filter", !column.filterOps?.length);
    if (filterOf(column.key, table)) item("clear-filter");
  }
  if (column.allowsHiding) item("hide", lastRowHeader(column.key, table));
  if (column.allowsPinning) {
    const { pinned } = columnsNow(table);
    const side = pinned.start.includes(column.key)
      ? "start"
      : pinned.end.includes(column.key)
        ? "end"
        : undefined;
    if (side !== "start") item("pin-start");
    if (side !== "end") item("pin-end");
    if (side) item("unpin");
  }
  if (table.allowsColumnReordering) {
    const move = moveList(column.key, table);
    item("move-before", !neighbour(column.key, -1, move));
    item("move-after", !neighbour(column.key, 1, move));
  }
  if (column.allowsResizing) item("resize");
  return items;
}

/**
 * The state patch a menu item writes (for `setTableState`); undefined = none (the resize item —
 * RAC's — or an item the menu does not offer now).
 */
export function catalogColumnMenuPatch(
  id: CatalogColumnMenuItemId,
  column: CatalogColumnMenuColumn,
  table: CatalogColumnMenuTable,
): Partial<CatalogTableState> | undefined {
  const offered = catalogColumnMenuItems(column, table).find(
    (item) => item.id === id,
  );
  if (!offered || offered.disabled) return undefined;
  const key = column.key;
  switch (id) {
    case "sort-asc":
    case "sort-desc":
      return {
        sort: [
          {
            column: key,
            direction: id === "sort-asc" ? "ascending" : "descending",
          },
        ],
      };
    case "sort-add": {
      const entry: CatalogTableSortItem = {
        column: key,
        direction: column.sortFirstDirection,
      };
      return { sort: [...(table.state.sort ?? []), entry] };
    }
    case "clear-filter":
      return withFilter(key, table, undefined);
    case "hide": {
      const { hidden } = columnsNow(table);
      return { hiddenColumns: [...hidden, key] };
    }
    case "pin-start":
    case "pin-end":
    case "unpin": {
      const { pinned } = columnsNow(table);
      const start = pinned.start.filter((other) => other !== key);
      const end = pinned.end.filter((other) => other !== key);
      // (A column pinned joins its side next to the unpinned ones — the start side's end, the
      //  end side's start.)
      return {
        pinnedColumns: {
          start: id === "pin-start" ? [...start, key] : start,
          end: id === "pin-end" ? [key, ...end] : end,
        },
      };
    }
    case "move-before":
    case "move-after": {
      const move = moveList(key, table);
      const next = neighbour(key, id === "move-before" ? -1 : 1, move)!;
      const list = move.list.filter((other) => other !== key);
      const at = list.indexOf(next) + (id === "move-before" ? 0 : 1);
      list.splice(at, 0, key);
      if (!move.side) return { columnOrder: list };
      const { pinned } = columnsNow(table);
      return {
        pinnedColumns:
          move.side === "start"
            ? { start: list, end: pinned.end }
            : { start: pinned.start, end: list },
      };
    }
    case "filter":
    case "resize":
      return undefined;
  }
}

/**
 * ADR-315 Phase 4 증분 5 — a header drag (사용자 결정 3): the Column `from` dropped on the Column
 * `to` takes `to`'s place in their list (`moveList` — the pinned side's, else the unpinned order),
 * the columns between shifting one over: dropped on a column after it, it stands after that one;
 * before it, before. Undefined = no drop: the Table does not reorder, the two are one column, or
 * they are in different lists (a pinned column moves among its side's — pinning is the menu's).
 */
export function catalogColumnDropPatch(
  from: string,
  to: string,
  table: CatalogColumnMenuTable,
): Partial<CatalogTableState> | undefined {
  if (!table.allowsColumnReordering || from === to) return undefined;
  const move = moveList(from, table);
  // (A column of another list — the other pinned side, or across it — is not in this one.)
  const at = move.list.indexOf(to);
  if (at < 0 || !move.list.includes(from)) return undefined;
  const list = move.list.filter((other) => other !== from);
  list.splice(at, 0, from);
  if (!move.side) return { columnOrder: list };
  const { pinned } = columnsNow(table);
  return {
    pinnedColumns:
      move.side === "start"
        ? { start: list, end: pinned.end }
        : { start: pinned.start, end: list },
  };
}

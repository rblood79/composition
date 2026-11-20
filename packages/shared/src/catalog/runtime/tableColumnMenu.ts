/**
 * ADR-315 Phase 4 — a Column's menu (S2 `ColumnWithMenu` — breakdown §5.3 「열 메뉴」): its items
 * as the Table's state is now, and the state slice each item writes. One place for both — the
 * Preview session asks it (`tableColumnMenu` · `runTableColumnMenu`), the DOM only draws the items
 * and names the one pressed. An operation the author did not allow has no item (the Column's
 * `allowsSorting` · `allowsHiding` · `allowsPinning` · `allowsResizing`, the Table's
 * `allowsColumnReordering` · multi-column sort); an item that can do nothing now (the edge column's
 * move, the last row header's hide) is there and disabled.
 *
 * Every write goes through `session.setTableState` (the rules between slices). The resize item is
 * RAC's (`startResize` — the DOM's); the others write a slice here.
 */
import type {
  CatalogTableShape,
  CatalogTableSortItem,
  CatalogTableState,
} from "./tableState";

export type CatalogColumnMenuItemId =
  | "sort-asc"
  | "sort-desc"
  | "sort-add"
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
    case "resize":
      return undefined;
  }
}

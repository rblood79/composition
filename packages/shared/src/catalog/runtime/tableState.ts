/**
 * ADR-315 — a Table instance's grid state: one closed shape for every slice (sort · search ·
 * column filters · grouping / hidden · ordered · pinned columns · widths / expanded · pinned ·
 * selected rows · page / cell ranges), and the rules between the slices in one place (breakdown
 * §4.4). Columns are named by their Column key (`resolveTableColumnKey`), rows by their item key.
 *
 * A slice that is absent is the authored default: the document says what a Table starts with, the
 * session holds what its user changed (never saved — ADR-257 · 287), and a Table whose author turned
 * 「Remember state」 on keeps `catalogTableStateRemembered` in the browser (사용자 결정 1, 2026-11-20).
 */
import type { ViewCondition } from "../document/types";
import type { CatalogSortDirection } from "./tableSort";

/** One entry of the sort list — RAC's `SortDescriptor` shape, its column a Column key. */
export interface CatalogTableSortItem {
  readonly column: string;
  readonly direction: CatalogSortDirection;
}
/** A cell: its row's item key and its column's Column key. */
export interface CatalogTableCell {
  readonly row: string;
  readonly column: string;
}
export interface CatalogTableState {
  // data slices — translated into the view query (breakdown §4.3)
  readonly sort?: readonly CatalogTableSortItem[];
  readonly search?: string;
  readonly columnFilters?: readonly {
    readonly column: string;
    readonly condition: ViewCondition;
  }[];
  readonly grouping?: readonly string[];
  // column slices — applied at the resolver's column projection (breakdown §4.5)
  readonly hiddenColumns?: readonly string[];
  readonly columnOrder?: readonly string[];
  readonly pinnedColumns?: {
    readonly start: readonly string[];
    readonly end: readonly string[];
  };
  readonly columnWidths?: Readonly<Record<string, number>>;
  // row slices
  readonly expandedKeys?: "all" | readonly string[];
  readonly pinnedRows?: {
    readonly top: readonly string[];
    readonly bottom: readonly string[];
  };
  readonly selectedKeys?: "all" | readonly string[];
  readonly page?: number;
  // cell slice
  readonly cellRanges?: readonly {
    readonly anchor: CatalogTableCell;
    readonly focus: CatalogTableCell;
  }[];
}
export type CatalogTableStateSlice = keyof CatalogTableState;
/**
 * A Table record's state as its session holds it (absent = the authored defaults). The one reader
 * the resolver · the DOM take of the Preview's Table state (it was `tableSort` — ADR-257 Phase 4).
 */
export type CatalogTableStateSource = (
  tableId: string,
) => CatalogTableState | undefined;

/** The slices the view query is made of: one of them changing reads the rows again. */
export const CATALOG_TABLE_DATA_SLICES = [
  "sort",
  "search",
  "columnFilters",
  "grouping",
] as const satisfies readonly CatalogTableStateSlice[];
/** The slices the column projection reads — never an input of the view query (ADR-315 HC4). */
export const CATALOG_TABLE_COLUMN_SLICES = [
  "hiddenColumns",
  "columnOrder",
  "pinnedColumns",
  "columnWidths",
] as const satisfies readonly CatalogTableStateSlice[];
/** What a browser keeps of a Table with 「Remember state」: its columns and its sort. */
const REMEMBERED_SLICES = [
  "sort",
  ...CATALOG_TABLE_COLUMN_SLICES,
] as const satisfies readonly CatalogTableStateSlice[];

/** What the rules read of a Table: its authored columns and the switches its author set. */
export interface CatalogTableShape {
  /** The authored Columns in document order, by Column key. */
  readonly columns: readonly {
    readonly key: string;
    /** RAC `isRowHeader` — a Table keeps one in view (RAC throws without). */
    readonly rowHeader?: boolean;
  }[];
  /** Whether the Table sorts by more than one column (absent = one). */
  readonly multiSort?: boolean;
  /** The most columns a multi-column sort holds (absent = no limit). */
  readonly maxSortColumns?: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const strings = (value: unknown): string[] | undefined =>
  Array.isArray(value) && value.every((item) => typeof item === "string")
    ? [...new Set(value as string[])]
    : undefined;
const same = (a: unknown, b: unknown) =>
  a === b || JSON.stringify(a) === JSON.stringify(b);

/** A sort list as the Table takes it: its own columns, one entry a column, within its limit. */
function sortOf(
  value: unknown,
  has: (key: string) => boolean,
  shape: CatalogTableShape,
): CatalogTableSortItem[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: CatalogTableSortItem[] = [];
  for (const item of value) {
    if (!isRecord(item)) return undefined;
    const { column, direction } = item;
    if (typeof column !== "string") return undefined;
    if (direction !== "ascending" && direction !== "descending")
      return undefined;
    if (!has(column)) continue;
    const at = out.findIndex((entry) => entry.column === column);
    // (A column named again: its later entry, at its first place.)
    if (at >= 0) out[at] = { column, direction };
    else out.push({ column, direction });
  }
  // (One column: the last one written — a click on another header replaces the sort.)
  if (!shape.multiSort) return out.slice(-1);
  return shape.maxSortColumns && shape.maxSortColumns > 0
    ? out.slice(0, shape.maxSortColumns)
    : out;
}
const keysOf = (value: unknown): "all" | string[] | undefined =>
  value === "all" ? "all" : strings(value);
function cellOf(value: unknown): CatalogTableCell | undefined {
  if (!isRecord(value)) return undefined;
  const { row, column } = value;
  return typeof row === "string" && typeof column === "string"
    ? { row, column }
    : undefined;
}

/**
 * One slice's value as the Table holds it — `undefined` = not a value of that slice (nothing is
 * written), `null` = the slice is empty (it is removed: absent is the authored default).
 */
function sliceOf(
  slice: CatalogTableStateSlice,
  value: unknown,
  shape: CatalogTableShape,
): unknown {
  const has = (key: string) =>
    shape.columns.some((column) => column.key === key);
  const columns = (list: unknown) => strings(list)?.filter(has);
  switch (slice) {
    case "sort": {
      const sort = sortOf(value, has, shape);
      return sort && (sort.length ? sort : null);
    }
    case "search":
      return typeof value === "string" ? value || null : undefined;
    case "columnFilters": {
      if (!Array.isArray(value)) return undefined;
      const out = value.filter(
        (item): item is { column: string; condition: ViewCondition } =>
          isRecord(item) &&
          typeof item.column === "string" &&
          has(item.column) &&
          isRecord(item.condition),
      );
      return out.length ? out : null;
    }
    case "grouping":
    case "columnOrder": {
      const list = columns(value);
      return list && (list.length ? list : null);
    }
    case "hiddenColumns": {
      const list = columns(value);
      if (!list) return undefined;
      // (RAC throws on a Table without a row header column: the last one stays in view.)
      const headers = shape.columns.filter((column) => column.rowHeader);
      const hidden = new Set(list);
      if (headers.length && headers.every((column) => hidden.has(column.key)))
        hidden.delete(headers.at(-1)!.key);
      const out = list.filter((key) => hidden.has(key));
      return out.length ? out : null;
    }
    case "pinnedColumns": {
      if (!isRecord(value)) return undefined;
      const start = columns(value.start) ?? [];
      // (A column is pinned at one side: the start side's.)
      const end = (columns(value.end) ?? []).filter(
        (key) => !start.includes(key),
      );
      return start.length || end.length ? { start, end } : null;
    }
    case "columnWidths": {
      if (!isRecord(value)) return undefined;
      const out: Record<string, number> = {};
      for (const [key, width] of Object.entries(value))
        if (
          has(key) &&
          typeof width === "number" &&
          Number.isFinite(width) &&
          width > 0
        )
          out[key] = width;
      return Object.keys(out).length ? out : null;
    }
    case "expandedKeys":
    case "selectedKeys": {
      const keys = keysOf(value);
      return keys === undefined ? undefined : keys.length ? keys : null;
    }
    case "pinnedRows": {
      if (!isRecord(value)) return undefined;
      const top = strings(value.top) ?? [];
      const bottom = (strings(value.bottom) ?? []).filter(
        (key) => !top.includes(key),
      );
      return top.length || bottom.length ? { top, bottom } : null;
    }
    case "page":
      return typeof value === "number" && Number.isInteger(value) && value >= 1
        ? value === 1
          ? null
          : value
        : undefined;
    case "cellRanges": {
      if (!Array.isArray(value)) return undefined;
      const out = [];
      for (const item of value) {
        if (!isRecord(item)) return undefined;
        const anchor = cellOf(item.anchor);
        const focus = cellOf(item.focus);
        if (!anchor || !focus || !has(anchor.column) || !has(focus.column))
          continue;
        out.push({ anchor, focus });
      }
      return out.length ? out : null;
    }
  }
}

const SLICES = [
  ...CATALOG_TABLE_DATA_SLICES,
  ...CATALOG_TABLE_COLUMN_SLICES,
  "expandedKeys",
  "pinnedRows",
  "selectedKeys",
  "page",
  "cellRanges",
] as const satisfies readonly CatalogTableStateSlice[];

/**
 * The state after `patch` is written over it — the rules between slices (breakdown §4.4):
 * a column the Table does not have is dropped, an emptied slice is removed, and a data slice
 * changing goes back to the first page (unless the patch writes a page itself). The same state
 * comes back when nothing changes.
 */
export function catalogTableStateWith(
  state: CatalogTableState,
  patch: Readonly<Record<string, unknown>>,
  shape: CatalogTableShape,
): CatalogTableState {
  const next: Record<string, unknown> = { ...state };
  let changed = false;
  let data = false;
  for (const slice of SLICES) {
    if (!Object.prototype.hasOwnProperty.call(patch, slice)) continue;
    const value = sliceOf(slice, patch[slice], shape);
    if (value === undefined) continue;
    const before = (state as Record<string, unknown>)[slice];
    if (value === null ? before === undefined : same(before, value)) continue;
    if (value === null) delete next[slice];
    else next[slice] = value;
    changed = true;
    if ((CATALOG_TABLE_DATA_SLICES as readonly string[]).includes(slice))
      data = true;
  }
  if (
    data &&
    next.page !== undefined &&
    !Object.prototype.hasOwnProperty.call(patch, "page")
  )
    delete next.page;
  return changed ? (next as CatalogTableState) : state;
}

/** A value from outside the session (the browser's memory · a rule's value) as a state. */
export function catalogTableStateRead(
  value: unknown,
  shape: CatalogTableShape,
): CatalogTableState {
  return isRecord(value) ? catalogTableStateWith({}, value, shape) : {};
}

/** What a browser keeps of the state: the column slices and the sort (breakdown §4.2). */
export function catalogTableStateRemembered(
  state: CatalogTableState,
): CatalogTableState {
  const out: Record<string, unknown> = {};
  for (const slice of REMEMBERED_SLICES)
    if (state[slice] !== undefined) out[slice] = state[slice];
  return out as CatalogTableState;
}

/** The browser key of a project's remembered Table states (`{ [table record id]: state }`). */
export const CATALOG_TABLE_STATE_STORAGE_PREFIX = "composition:table-state:v1:";
/** A browser storage as the remembered states read it (`localStorage`'s shape). */
export interface CatalogTableStateStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * A project's remembered Table states as stored — `{}` for no storage, no entry, or a value that
 * is not an object (each Table's value is read through `catalogTableStateRead` by its reader).
 */
export function catalogStoredTableStates(
  storage: CatalogTableStateStorage | null | undefined,
  projectId: string,
): Record<string, unknown> {
  if (!storage) return {};
  try {
    const raw = storage.getItem(
      `${CATALOG_TABLE_STATE_STORAGE_PREFIX}${projectId}`,
    );
    const value: unknown = raw ? JSON.parse(raw) : undefined;
    return isRecord(value) ? value : {};
  } catch {
    return {};
  }
}
/** Stores a project's remembered Table states (none left = the key is removed). */
export function catalogStoreTableStates(
  storage: CatalogTableStateStorage,
  projectId: string,
  states: Readonly<Record<string, unknown>>,
): void {
  const key = `${CATALOG_TABLE_STATE_STORAGE_PREFIX}${projectId}`;
  try {
    if (Object.keys(states).length)
      storage.setItem(key, JSON.stringify(states));
    else storage.removeItem(key);
  } catch {
    // (A full · blocked storage: the state stays the session's.)
  }
}

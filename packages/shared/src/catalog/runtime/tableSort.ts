/**
 * ADR-257 Phase 4 — a Table's Preview operations (S2 Column `allowsSorting` · `allowsResizing`).
 *
 * The sort is the Preview's runtime state (사용자 결정 4 — never the document; the Canvas keeps
 * the document's order): RAC's `onSortChange` gives `{ column, direction }`, `column` being the
 * Column's RAC key (`catalogTableColumnKey`). A bound Table's rows are sorted by
 * their field values before the rows its height shows are taken (`resolver.ts` `projectTableRows`);
 * an authored Table's Rows by the text of their cell in that column (`catalogTableSortedRows`).
 */

export type CatalogSortDirection = "ascending" | "descending";

/** RAC's `SortDescriptor`, its column the Column's RAC key (`catalogTableColumnKey`). */
export interface CatalogTableSort {
  readonly column: string;
  readonly direction: CatalogSortDirection;
}

/** The Preview's sort of a Table record (absent = the document's order). */
export type CatalogTableSortSource = (
  tableId: string,
) => CatalogTableSort | undefined;

/**
 * A Column's RAC key — the name RAC's sort gives it: the author's HTML id when it has one (the DOM
 * passes that as the item's `id` — `withHtmlId`), else the record's id.
 */
export function catalogTableColumnKey(column: {
  readonly id: string;
  readonly htmlId?: string;
}): string {
  return column.htmlId ?? column.id;
}

/** A RAC `SortDescriptor` (`onSortChange`) as the record's sort, else undefined. */
export function catalogTableSortOf(
  value: unknown,
): CatalogTableSort | undefined {
  if (!value || typeof value !== "object") return undefined;
  const { column, direction } = value as Record<string, unknown>;
  if (typeof column !== "string" && typeof column !== "number")
    return undefined;
  if (direction !== "ascending" && direction !== "descending") return undefined;
  return { column: String(column), direction };
}

const COLLATOR = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

/** Ascending order of two cell values: numbers by value, the rest by their text (numeric-aware). */
export function catalogTableSortCompare(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number")
    return Number.isNaN(a) || Number.isNaN(b) ? 0 : a - b;
  const text = (value: unknown) =>
    value === undefined || value === null ? "" : String(value);
  return COLLATOR.compare(text(a), text(b));
}

/** `items` in `sort` order by `valueOf` (stable — equal values keep their order). */
export function catalogTableSorted<T>(
  items: readonly T[],
  direction: CatalogSortDirection,
  valueOf: (item: T) => unknown,
): T[] {
  const sign = direction === "descending" ? -1 : 1;
  return items
    .map((item, index) => ({ item, index, value: valueOf(item) }))
    .sort(
      (a, b) =>
        sign * catalogTableSortCompare(a.value, b.value) || a.index - b.index,
    )
    .map(({ item }) => item);
}

interface SortRecord {
  readonly id: string;
  readonly htmlId?: string;
  readonly parentId: string;
  readonly children: readonly string[];
  readonly props: Readonly<Record<string, unknown>>;
}
type SortLookup<T extends SortRecord> = (id: string) => T | undefined;
type SortTypeOf<T extends SortRecord> = (node: T) => string;

function recordChildren<T extends SortRecord>(
  node: T,
  get: SortLookup<T>,
): T[] {
  return node.children.flatMap((id) => {
    const child = get(id);
    return child ? [child] : [];
  });
}

/** A record's text: its own `children` text, else its descendants' (a Cell's Text). */
function recordText<T extends SortRecord>(node: T, get: SortLookup<T>): string {
  const own = node.props.children;
  if (typeof own === "string" || typeof own === "number") return String(own);
  return recordChildren(node, get)
    .map((child) => recordText(child, get))
    .filter(Boolean)
    .join(" ");
}

/** The Table's Columns in header order (selection columns included — each Row has their cells). */
function tableColumns<T extends SortRecord>(
  table: T,
  get: SortLookup<T>,
  typeOf: SortTypeOf<T>,
): T[] {
  return recordChildren(table, get)
    .filter((child) => typeOf(child) === "TableHeader")
    .flatMap((header) =>
      recordChildren(header, get).filter((child) => typeOf(child) === "Column"),
    );
}

/** A Row's cell over column `index` (cells take `colSpan` columns — Phase 2). */
function cellAt<T extends SortRecord>(
  row: T,
  index: number,
  get: SortLookup<T>,
  typeOf: SortTypeOf<T>,
): T | undefined {
  let start = 0;
  for (const cell of recordChildren(row, get)) {
    if (typeOf(cell) !== "Cell") continue;
    const span = cell.props.colSpan;
    const width =
      typeof span === "number" && Number.isInteger(span) && span >= 1
        ? span
        : 1;
    if (index < start + width) return cell;
    start += width;
  }
  return undefined;
}

/**
 * An authored TableBody's child ids in the Table's Preview sort: its Rows by the text of their
 * cell in the sorted column (other children keep their places). Undefined = no sort applies (no
 * sort, an unknown column, or a body of data rows — the resolver sorts those by value).
 */
export function catalogTableSortedRows<T extends SortRecord>(
  body: T,
  sort: CatalogTableSort | undefined,
  get: SortLookup<T>,
  typeOf: SortTypeOf<T>,
): readonly string[] | undefined {
  if (!sort || typeOf(body) !== "TableBody") return undefined;
  const table = get(body.parentId);
  if (!table) return undefined;
  const index = tableColumns(table, get, typeOf).findIndex(
    (column) => catalogTableColumnKey(column) === sort.column,
  );
  if (index < 0) return undefined;
  const rows = recordChildren(body, get).filter((row) => typeOf(row) === "Row");
  if (rows.length < 2) return undefined;
  const sorted = catalogTableSorted(rows, sort.direction, (row) => {
    const cell = cellAt(row, index, get, typeOf);
    return cell ? recordText(cell, get) : "";
  });
  let next = 0;
  return body.children.map((id) =>
    rows.some((row) => row.id === id) ? sorted[next++]!.id : id,
  );
}

/** S2 Column `allowsResizing` — a Table any of whose Columns allows it is resizable (Preview). */
export function catalogTableResizable<T extends SortRecord>(
  table: T,
  get: SortLookup<T>,
  typeOf: SortTypeOf<T>,
): boolean {
  return tableColumns(table, get, typeOf).some(
    (column) => column.props.allowsResizing === true,
  );
}

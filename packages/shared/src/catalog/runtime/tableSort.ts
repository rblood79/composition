/**
 * ADR-257 Phase 4 — a Table's Preview operations (S2 Column `allowsSorting` · `allowsResizing`).
 *
 * The sort is the Preview's runtime state (사용자 결정 4 — never the document; the Canvas keeps
 * the document's order): RAC's `onSortChange` gives `{ column, direction }`, `column` being the
 * Column's RAC key (`catalogTableColumnKey`). A bound Table's rows are sorted by
 * their field values before its display cuts them — by the rows' source, before its window · page
 * (`CatalogRowSorts` → `catalogBoundRows`; a source that does not: `resolver.ts` `boundTableRows`);
 * an authored Table's Rows by the text of their cell in that column (`catalogTableSortedRows`).
 * ADR-315 Phase 2 — the order itself is the views' (`collections/view/sortOrder.ts`): one sort.
 */
import { viewSortOrder } from "../../collections/view/sortOrder";

export type CatalogSortDirection = "ascending" | "descending";

/** RAC's `SortDescriptor`, its column the Column's RAC key (`catalogTableColumnKey`). */
export interface CatalogTableSort {
  readonly column: string;
  readonly direction: CatalogSortDirection;
}

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
  // ADR-280 — a rule's `sort` value as text (the Interactions panel writes scalars):
  // `<column key>:ascending` · `<column key>:descending`.
  if (typeof value === "string") {
    const match = /^(.+):(ascending|descending)$/.exec(value);
    return match
      ? {
          column: match[1]!,
          direction: match[2] as CatalogTableSort["direction"],
        }
      : undefined;
  }
  if (!value || typeof value !== "object") return undefined;
  const { column, direction } = value as Record<string, unknown>;
  if (typeof column !== "string" && typeof column !== "number")
    return undefined;
  if (direction !== "ascending" && direction !== "descending") return undefined;
  return { column: String(column), direction };
}

/**
 * A bound Table's sort entry as its rows read it: the sorted Column's field, the direction and
 * where its empty values go (ADR-315 Phase 2 — the Column's `sortEmptyValues`; absent = last).
 */
export interface CatalogRowSort {
  readonly key: string;
  readonly direction: CatalogSortDirection;
  readonly empty?: "first" | "last";
}
/** A bound Table's sort: its entries in order (the first, then the next among its equal rows). */
export type CatalogRowSorts = readonly CatalogRowSort[];

/** Two sorts are the same entries in the same order. */
export function catalogRowSortsEqual(
  a: CatalogRowSorts | undefined,
  b: CatalogRowSorts | undefined,
): boolean {
  if (!a?.length || !b?.length) return !a?.length && !b?.length;
  return (
    a.length === b.length &&
    a.every(
      (entry, index) =>
        entry.key === b[index]!.key &&
        entry.direction === b[index]!.direction &&
        (entry.empty ?? "last") === (b[index]!.empty ?? "last"),
    )
  );
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
 * cells in the sorted columns, entry after entry (other children keep their places). Undefined =
 * no sort applies (no sort, no known column, or a body of data rows — their source sorts those by
 * value). The order is the views' (`viewSortOrder` — one sort, ADR-315 HC2).
 */
export function catalogTableSortedRows<T extends SortRecord>(
  body: T,
  sorts: readonly CatalogTableSort[] | undefined,
  get: SortLookup<T>,
  typeOf: SortTypeOf<T>,
): readonly string[] | undefined {
  if (!sorts?.length || typeOf(body) !== "TableBody") return undefined;
  const table = get(body.parentId);
  if (!table) return undefined;
  const columns = tableColumns(table, get, typeOf);
  const entries = sorts.flatMap((sort) => {
    const index = columns.findIndex(
      (column) => catalogTableColumnKey(column) === sort.column,
    );
    if (index < 0) return [];
    const empty = columns[index]!.props.sortEmptyValues;
    return [
      {
        index,
        direction: sort.direction,
        ...(empty === "first" ? { empty: "first" as const } : {}),
      },
    ];
  });
  if (!entries.length) return undefined;
  const rows = recordChildren(body, get).filter((row) => typeOf(row) === "Row");
  if (rows.length < 2) return undefined;
  const order = viewSortOrder(
    rows.length,
    entries.map(({ index, direction, empty }) => ({
      valueAt: (place: number) => {
        const cell = cellAt(rows[place]!, index, get, typeOf);
        return cell ? recordText(cell, get) : "";
      },
      direction,
      // (A cell's text — digits by value, as the collator reads them.)
      type: "string",
      ...(empty ? { empty } : {}),
    })),
  );
  let next = 0;
  return body.children.map((id) =>
    rows.some((row) => row.id === id) ? rows[order[next++]!]!.id : id,
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

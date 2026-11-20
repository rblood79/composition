/**
 * ADR-315 Phase 2 — a Table state's data slices as the view query that runs them (HC2): one
 * translation, read by the local order (`catalogBoundRows` — the views' `viewSortOrder`) and by the
 * request (`serializeViewQueries`). Only the data slices are its input — the column slices
 * (hidden · order · pinned · widths) are not in its types, so a column change gives the same
 * query, the same request and the same rows (HC4).
 *
 * Until Phase 3 the one slice is the sort: state entries (Column keys) → the rows' sort entries
 * (`catalogTableStateRowSorts` — each Column's field and where it puts its empty values) → the
 * view's `ViewSort` list (`catalogRowSortsView`) → the binding's view chain with that sort
 * (`catalogTableStateQueries`).
 *
 * Where a slice runs (`catalogTableSliceServable`, breakdown §4.3.1): a Table whose rows are the
 * server's pages runs a slice only when the request carries the whole of it — a part is never
 * sent and made up for here (the server cuts the page: rows a second sort would have brought are
 * not in the answer). What the request cannot carry is not accepted into the state.
 */
import type { DataFieldId, ViewQuery, ViewSort } from "../document/types";
import type { CatalogRowSort, CatalogRowSorts } from "./tableSort";
import type { CatalogTableSortItem } from "./tableState";

/** A Table's Column as its sort reads it: its Column key and its `sortEmptyValues`. */
export interface CatalogTableSortColumn {
  readonly key: string;
  readonly sortEmptyValues?: unknown;
}

/**
 * A Table state's sort as its rows read it: each entry's Column as its field, with where that
 * Column puts its empty values. An entry of no Column is dropped.
 */
export function catalogTableStateRowSorts(
  sort: readonly CatalogTableSortItem[] | undefined,
  columns: readonly CatalogTableSortColumn[],
): CatalogRowSorts {
  return (sort ?? []).flatMap((entry): CatalogRowSort[] => {
    const column = columns.find((item) => item.key === entry.column);
    return column
      ? [
          {
            key: entry.column,
            direction: entry.direction,
            ...(column.sortEmptyValues === "first"
              ? { empty: "first" as const }
              : {}),
          },
        ]
      : [];
  });
}

/**
 * The rows' sort entries as a view's sort: each key as the field of that key in `schema` (the
 * fields the Table's rows have — the collection's, or its view's result fields). Undefined = an
 * entry names no field (a role's value · a key the data's schema does not have): the sort is not
 * a view's — it runs on the rows here only, and no request carries it.
 */
export function catalogRowSortsView(
  sorts: CatalogRowSorts,
  schema: readonly { id?: string; key?: string }[],
): ViewSort[] | undefined {
  const out: ViewSort[] = [];
  for (const sort of sorts) {
    const field = schema.find((item) => item.id && item.key === sort.key);
    if (!field) return undefined;
    out.push({
      field: [
        (field.id!.startsWith("data:field:")
          ? field.id!
          : `data:field:${field.id}`) as DataFieldId,
      ],
      direction: sort.direction,
      ...(sort.empty === "first" ? { empty: "first" as const } : {}),
    });
  }
  return out;
}

/** The id of the view a Table state adds to a binding that has none. */
export const CATALOG_TABLE_STATE_VIEW_ID = "table-state";

/**
 * A binding's view chain with a Table state's sort: the bound (last) view sorts by it — the state
 * is the run layer's value, the authored sort the default it stands in for (breakdown §4.2). A
 * binding without a view gets one that only sorts. No sort = the chain as authored.
 */
export function catalogTableStateQueries(
  authored: readonly ViewQuery[] | undefined,
  sorts: readonly ViewSort[] | undefined,
): readonly ViewQuery[] | undefined {
  if (!sorts?.length) return authored;
  if (!authored?.length)
    return [
      {
        where: { id: CATALOG_TABLE_STATE_VIEW_ID, op: "and", items: [] },
        sort: sorts,
      },
    ];
  return [...authored.slice(0, -1), { ...authored.at(-1)!, sort: sorts }];
}

/** How a Table's rows are served, as the judgment reads it. */
export interface CatalogTableRowService {
  /** The rows load from an endpoint (not the collection's own rows). */
  readonly remote: boolean;
  /** The endpoint's URL · body reads `{{ sortDescriptor }}` (`load({sortDescriptor})`) — one sort. */
  readonly readsSortTemplate?: boolean;
  /** The endpoint's query format (`querySerialization`). */
  readonly format?: {
    readonly kind?: unknown;
    readonly multiSort?: unknown;
  };
}

/** A slice a Table state holds that a request may have to carry. */
export type CatalogTableServedSlice = "sort";

/**
 * What of a slice a Table accepts into its state (breakdown §4.3.1) — `whole`, or for the sort
 * `one` entry with why (`sortTemplate` — the endpoint's own `{{ sortDescriptor }}` names one
 * column; `suffixSingle` — a flat parameter format that does not take a sort list). The session
 * (a header press · the browser's memory), a rule's Do and the panel's switch read this one
 * judgment.
 */
export function catalogTableSliceServable(
  service: CatalogTableRowService,
  slice: CatalogTableServedSlice,
):
  | { readonly accepts: "whole" }
  | {
      readonly accepts: "one";
      readonly reason: "sortTemplate" | "suffixSingle";
    } {
  void slice;
  if (!service.remote) return { accepts: "whole" };
  if (service.readsSortTemplate)
    return { accepts: "one", reason: "sortTemplate" };
  if (service.format?.kind === "suffix" && service.format.multiSort !== true)
    return { accepts: "one", reason: "suffixSingle" };
  return { accepts: "whole" };
}

/**
 * ADR-315 Phase 3 — a bound Table's data slices as its rows read them (each Column as its field):
 * what the resolver hands the rows' source with a Table's state (`CatalogRowSource`'s `slices`),
 * and the first step of the state's translation (`tableStateQuery.ts`). Kept apart from that file:
 * the resolver reads this one, and must not bring the request serializer with it.
 */
import type {
  ViewComparison,
  ViewCondition,
  ViewConditionValue,
} from "../document/types";
import type { CatalogRowSort, CatalogRowSorts } from "./tableSort";
import type { CatalogTableState } from "./tableState";

/**
 * A Table's Column as its state's data slices read it: its Column key, where its sort puts its
 * empty values (`sortEmptyValues`) and whether the Table's search reads it (`allowsSearching` —
 * every Column unless it says no; hiding a Column does not change it, breakdown §4.4).
 */
export interface CatalogTableStateColumn {
  readonly key: string;
  readonly sortEmptyValues?: unknown;
  readonly allowsSearching?: unknown;
}
/** (Phase 2's name.) */
export type CatalogTableSortColumn = CatalogTableStateColumn;

/** A bound Table's search as its rows read it: the text over the searchable Columns' fields. */
export interface CatalogRowSearch {
  readonly text: string;
  readonly keys: readonly string[];
  /** 사용자 결정 2 — the Table's `searchMatch`: graded matches (`fuzzy.ts`); absent = 「포함」. */
  readonly match?: "fuzzy";
}
/** A bound Table's column filter as its rows read it: a condition on that Column's field. */
export interface CatalogRowFilter {
  readonly key: string;
  readonly op: ViewComparison;
  readonly value?: ViewConditionValue;
  readonly sensitivity?: ViewCondition["sensitivity"];
  readonly unit?: ViewCondition["unit"];
}
/** A bound Table's data slices as its rows read them (each Column as its field). */
export interface CatalogRowSlices {
  readonly sorts?: CatalogRowSorts;
  readonly search?: CatalogRowSearch;
  readonly filters?: readonly CatalogRowFilter[];
}

/**
 * A Table state's sort as its rows read it: each entry's Column as its field, with where that
 * Column puts its empty values. An entry of no Column is dropped.
 */
export function catalogTableStateRowSorts(
  sort: CatalogTableState["sort"],
  columns: readonly CatalogTableStateColumn[],
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
 * A Table state's data slices as its rows read them; undefined = none (the rows as their view
 * gives them). `table` = the Table's own props (`searchMatch`).
 */
export function catalogTableStateRowSlices(
  state: CatalogTableState | undefined,
  columns: readonly CatalogTableStateColumn[],
  table?: { readonly searchMatch?: unknown },
): CatalogRowSlices | undefined {
  if (!state) return undefined;
  const sorts = catalogTableStateRowSorts(state.sort, columns);
  const keys = columns
    .filter((column) => column.allowsSearching !== false)
    .map((column) => column.key);
  const search =
    state.search && keys.length
      ? {
          text: state.search,
          keys,
          ...(table?.searchMatch === "fuzzy"
            ? { match: "fuzzy" as const }
            : {}),
        }
      : undefined;
  const filters = (state.columnFilters ?? []).flatMap(
    ({ column, condition }): CatalogRowFilter[] =>
      columns.some((item) => item.key === column)
        ? [{ key: column, ...condition }]
        : [],
  );
  if (!sorts.length && !search && !filters.length) return undefined;
  return {
    ...(sorts.length ? { sorts } : {}),
    ...(search ? { search } : {}),
    ...(filters.length ? { filters } : {}),
  };
}

/** Two row slices are the same slices (the rows they give are the same rows in the same order). */
export function catalogRowSlicesEqual(
  a: CatalogRowSlices | undefined,
  b: CatalogRowSlices | undefined,
): boolean {
  return a === b || JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});
}

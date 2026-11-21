/**
 * ADR-315 Phase 3 — a bound Table's data slices as its rows read them (each Column as its field):
 * what the resolver hands the rows' source with a Table's state (`CatalogRowSource`'s `slices`),
 * and the first step of the state's translation (`tableStateQuery.ts`). Kept apart from that file:
 * the resolver reads this one, and must not bring the request serializer with it.
 */
import {
  VIEW_AGGREGATE_FNS,
  type ViewAggregateFn,
  type ViewComparison,
  type ViewCondition,
  type ViewConditionValue,
} from "../document/types";
import type { CatalogRowSort, CatalogRowSorts } from "./tableSort";
import type { CatalogTableState } from "./tableState";

/**
 * ADR-315 Phase 5 — the key suffix of the child a collapsed group holds in place of its rows
 * (never drawn — the group is closed; `catalogGroupBoundRows` · a windowed Table's DOM).
 */
export const CATALOG_GROUP_PLACEHOLDER_SUFFIX = "/collapsed";

/**
 * A Table's Column as its state's data slices read it: its Column key, where its sort puts its
 * empty values (`sortEmptyValues`) and whether the Table's search reads it (`allowsSearching` —
 * every Column unless it says no; hiding a Column does not change it, breakdown §4.4).
 */
export interface CatalogTableStateColumn {
  readonly key: string;
  readonly sortEmptyValues?: unknown;
  readonly allowsSearching?: unknown;
  /**
   * ADR-315 Phase 5 — the author groups the Table by it (`defaultGrouped`): the grouping a state
   * without that slice has, in column order.
   */
  readonly defaultGrouped?: unknown;
  /** ADR-315 Phase 5 — what its group rows show of it (`aggregate` — a `ViewAggregateFn`). */
  readonly aggregate?: unknown;
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
/**
 * ADR-315 Phase 5 — a bound Table's grouping as its rows read it: the fields grouped by (outer
 * first), each Column's aggregate its group rows show, and the group rows expanded (their keys —
 * `catalogTableGroupKey`; `"all"` = every one). A collapsed group's rows are not read out.
 */
export interface CatalogRowGroups {
  readonly keys: readonly string[];
  readonly aggregates: readonly {
    readonly key: string;
    readonly fn: ViewAggregateFn;
  }[];
  readonly expanded: "all" | readonly string[];
  /**
   * `false` — a closed group holds no child (the Builder's Canvas: no RAC to open it, and a child
   * Row would be drawn inside its group's row). Absent = its one placeholder child (the DOM).
   */
  readonly closedChild?: false;
}
/**
 * ADR-315 Phase 5 증분 5d — a bound Table whose binding names its rows' child rows (the binding's
 * children field or parent ID field — `fieldMap.children` · `parentId`, a Tree's roles): the rows
 * expanded (their row keys; `"all"` = every one). A collapsed row's child rows are not read out —
 * it holds one placeholder child, as a collapsed group does (`closedChild` the same).
 */
export interface CatalogRowTree {
  readonly expanded: "all" | readonly string[];
  readonly closedChild?: false;
}
/** A bound Table's data slices as its rows read them (each Column as its field). */
export interface CatalogRowSlices {
  readonly sorts?: CatalogRowSorts;
  readonly search?: CatalogRowSearch;
  readonly filters?: readonly CatalogRowFilter[];
  readonly groups?: CatalogRowGroups;
  /** ADR-315 Phase 5 증분 5d — the rows' child rows (a grouping stands over it — no tree then). */
  readonly tree?: CatalogRowTree;
  /**
   * ADR-315 Phase 5 증분 5c — a totals row (the Table's footer): each Column's aggregate over every
   * row the slices keep (searched · filtered — before a window · page cuts them). Every Column
   * is listed: one without an aggregate is an empty cell.
   */
  readonly totals?: readonly {
    readonly key: string;
    readonly fn?: ViewAggregateFn;
  }[];
}

/**
 * ADR-315 Phase 5 — the Column keys a Table is grouped by: its state's `grouping`, else the
 * Columns its author grouped by (`defaultGrouped`, in column order). Only its own Columns.
 */
export function catalogTableGrouping(
  state: CatalogTableState | undefined,
  columns: readonly CatalogTableStateColumn[],
): readonly string[] {
  const has = (key: string) => columns.some((column) => column.key === key);
  return state?.grouping
    ? state.grouping.filter(has)
    : columns
        .filter((column) => column.defaultGrouped === true)
        .map((column) => column.key);
}

/**
 * ADR-315 Phase 5 — a group row's key: its group values from the outer level in, as JSON (exact
 * equality — the grouping's: `"A"` · `"a"` and `null` · `""` are two groups). A data row's key is
 * its item key — a JSON list after `group:` is not one an author writes.
 */
export function catalogTableGroupKey(values: readonly unknown[]): string {
  return `group:${JSON.stringify(values.map((value) => value ?? null))}`;
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
  table?: {
    readonly searchMatch?: unknown;
    /** ADR-315 Phase 5 증분 5c — the Table has a totals row (its footer). */
    readonly totals?: boolean;
    /** ADR-315 Phase 5 증분 5d — its binding names its rows' child rows (`CatalogRowTree`). */
    readonly nested?: boolean;
  },
): CatalogRowSlices | undefined {
  if (!state) return undefined;
  // (The Columns' 「Aggregate」 — a group row's and the totals row's.)
  const aggregates = columns.flatMap((column) =>
    typeof column.aggregate === "string" &&
    column.aggregate !== "applied" &&
    (VIEW_AGGREGATE_FNS as readonly string[]).includes(column.aggregate)
      ? [{ key: column.key, fn: column.aggregate as ViewAggregateFn }]
      : [],
  );
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
  // (ADR-315 Phase 5 — the grouping: a grouped Column's sort entry stands first, breakdown §4.4 —
  //  the groups follow it; the aggregates are the Columns' 「Aggregate」.)
  const grouping = catalogTableGrouping(state, columns);
  const groups: CatalogRowGroups | undefined = grouping.length
    ? {
        keys: grouping,
        aggregates,
        expanded: state.expandedKeys ?? [],
      }
    : undefined;
  const ordered = groups
    ? [
        ...sorts.filter((entry) => grouping.includes(entry.key)),
        ...sorts.filter((entry) => !grouping.includes(entry.key)),
      ]
    : sorts;
  // (ADR-315 Phase 5 증분 5d — a grouped Table's groups hold its rows; the rows' own child rows
  //  are not shown under a grouping.)
  const tree: CatalogRowTree | undefined =
    table?.nested && !groups
      ? { expanded: state.expandedKeys ?? [] }
      : undefined;
  const totals = table?.totals
    ? columns.map((column) => ({
        key: column.key,
        ...(aggregates.find((entry) => entry.key === column.key) ?? {}),
      }))
    : undefined;
  if (
    !ordered.length &&
    !search &&
    !filters.length &&
    !groups &&
    !tree &&
    !totals
  )
    return undefined;
  return {
    ...(ordered.length ? { sorts: ordered } : {}),
    ...(search ? { search } : {}),
    ...(filters.length ? { filters } : {}),
    ...(groups ? { groups } : {}),
    ...(tree ? { tree } : {}),
    ...(totals ? { totals } : {}),
  };
}

/** Two row slices are the same slices (the rows they give are the same rows in the same order). */
export function catalogRowSlicesEqual(
  a: CatalogRowSlices | undefined,
  b: CatalogRowSlices | undefined,
): boolean {
  return a === b || JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});
}

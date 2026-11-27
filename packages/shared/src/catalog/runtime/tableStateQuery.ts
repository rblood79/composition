/**
 * ADR-315 Phase 2 · 3 — a Table state's data slices as the view query that runs them (HC2): one
 * translation, read by the local run (`catalogBoundRows` — the views' `viewSortOrder` ·
 * `viewRowsPassing`, on row numbers) and by the request (`serializeViewQueries`). Only the data
 * slices are its input — the column slices (hidden · order · pinned · widths) are not in its
 * types, so a column change gives the same query, the same request and the same rows (HC4).
 *
 * State entries (Column keys) → the rows' slices (`catalogTableStateRowSlices` — each Column's
 * field: the sort with where the Column puts its empty values, the search over the searchable
 * Columns, the column filters) → the view's sort · conditions (`catalogRowSlicesView`) → the
 * binding's view chain with them (`catalogTableStateQueries` — the conditions joined to the
 * authored ones by `and`, the sort in place of the authored one).
 *
 * Where a slice runs (`catalogTableSliceServable`, breakdown §4.3.1): a Table whose rows are the
 * server's pages runs a slice only when the request carries the whole of it — a part is never
 * sent and made up for here (the server cuts the page: rows a second sort would have brought are
 * not in the answer). What the request cannot carry is not accepted into the state.
 */
import {
  VIEW_EXTENDED_AGGREGATES,
  type DataFieldId,
  type ViewAggregateFn,
  type ViewComparison,
  type ViewCondition,
  type ViewConditionGroup,
  type ViewQuery,
  type ViewSort,
} from "../document/types";
// (Not from `view/serialize`: the Builder's panels read this module on the first screen, and the
//  serializer brings the row intake with it — `tableStateQueryImports.static.test.ts`.)
import { VIEW_SEARCH_CONDITION } from "../../collections/view/evaluate";
import { DEFAULT_QUERY_SUFFIXES } from "../../collections/view/querySuffixes";
import type { CatalogRowSlices } from "./tableRowSlices";

/** A Table state's sort · conditions as a view holds them. */
export interface CatalogTableStateView {
  readonly sort?: readonly ViewSort[];
  /** The search's condition, then the scope's filter tree's root items (conditions · groups). */
  readonly where?: readonly (ViewCondition | ViewConditionGroup)[];
}

/**
 * The rows' slices as a view's: each key as the field of that key in `schema` (the fields the
 * Table's rows have — the collection's, or its view's result fields). The search is one condition
 * over its fields (`contains` — a request carries no grades: a fuzzy search is the server's
 * 「포함」 where the server answers). Undefined = a key names no field (a role's value · a key the
 * data's schema does not have): the slices are not a view's — they run on the rows here only,
 * and no request carries them.
 */
export function catalogRowSlicesView(
  slices: CatalogRowSlices | undefined,
  schema: readonly { id?: string; key?: string }[],
): CatalogTableStateView | undefined {
  if (!slices) return undefined;
  const fieldOf = (key: string) => catalogFieldIdOf(schema, key);
  const sort: ViewSort[] = [];
  for (const entry of slices.sorts ?? []) {
    const field = fieldOf(entry.key);
    if (!field) return undefined;
    sort.push({
      field: [field],
      direction: entry.direction,
      ...(entry.empty === "first" ? { empty: "first" as const } : {}),
    });
  }
  const where: (ViewCondition | ViewConditionGroup)[] = [];
  if (slices.search) {
    const fields = slices.search.keys.map(fieldOf);
    if (fields.some((field) => !field)) return undefined;
    where.push({
      id: VIEW_SEARCH_CONDITION,
      fields: (fields as DataFieldId[]).map((field) => [field]),
      op: "contains",
      value: slices.search.text,
    });
  }
  // (ADR-320 Decision 2 — the scope's filter tree: its root items as they are, a Column's
  //  condition under its id `table-filter:<Column key>`. The root is an `and`.)
  where.push(...(slices.where?.items ?? []));
  if (!sort.length && !where.length) return undefined;
  return {
    ...(sort.length ? { sort } : {}),
    ...(where.length ? { where } : {}),
  };
}

/** The field id of a key in `schema` (the rows' fields), as a view names it. */
export function catalogFieldIdOf(
  schema: readonly { id?: string; key?: string }[],
  key: string,
): DataFieldId | undefined {
  const field = schema.find((item) => item.id && item.key === key);
  return field
    ? ((field.id!.startsWith("data:field:")
        ? field.id!
        : `data:field:${field.id}`) as DataFieldId)
    : undefined;
}

/** The id of the view a Table state adds to a binding that has none. */
export const CATALOG_TABLE_STATE_VIEW_ID = "table-state";

/**
 * A binding's view chain with a Table state's slices: the bound (last) view sorts by the state's
 * sort — the state is the run layer's value, the authored sort the default it stands in for
 * (breakdown §4.2) — and its conditions get the state's, joined by `and` (§4.3). A binding
 * without a view gets one of the state's alone. No slice = the chain as authored.
 */
export function catalogTableStateQueries(
  authored: readonly ViewQuery[] | undefined,
  view: CatalogTableStateView | undefined,
): readonly ViewQuery[] | undefined {
  if (!view?.sort?.length && !view?.where?.length) return authored;
  const last = authored?.at(-1) ?? {
    where: { id: CATALOG_TABLE_STATE_VIEW_ID, op: "and" as const, items: [] },
  };
  const where = view.where?.length
    ? last.where.op === "and"
      ? { ...last.where, items: [...last.where.items, ...view.where] }
      : {
          id: CATALOG_TABLE_STATE_VIEW_ID,
          op: "and" as const,
          items: [last.where, ...view.where],
        }
    : last.where;
  return [
    ...(authored?.slice(0, -1) ?? []),
    { ...last, where, ...(view.sort?.length ? { sort: view.sort } : {}) },
  ];
}

/** The count's name in a candidate-values view's rows. */
export const CATALOG_FACET_COUNT = "count";

/**
 * ADR-315 Phase 3 — a Table Column's candidate values as a view chain: the binding's views with
 * the Table's state (`catalogTableStateQueries`), then a candidate-values view of that Column's
 * field (`facet`). ADR-320 Decision 9: the views before it leave out the one condition being
 * edited (`skip` — a Column's filter `table-filter:<key>`, a filter bar's chip), wherever it is;
 * every other condition stays (another on that field, the author's, the search). The one
 * evaluator runs it (HC2).
 */
export function catalogTableFacetQueries(
  authored: readonly ViewQuery[] | undefined,
  state: CatalogTableStateView | undefined,
  field: DataFieldId,
  skip: string,
): readonly ViewQuery[] {
  return [
    ...(catalogTableStateQueries(authored, state) ?? []),
    {
      where: { id: "table-facet", op: "and", items: [] },
      groupBy: [[field]],
      aggregates: [{ fn: "count", as: CATALOG_FACET_COUNT }],
      facet: true,
      facetSkip: skip,
    },
  ];
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
    /** `suffix`: the parameter the Table's search text goes in (json-server `q`). */
    readonly searchParam?: unknown;
    /** `suffix`: the comparisons it names a parameter suffix for (absent = the default table). */
    readonly suffixes?: Readonly<Record<string, unknown>>;
    /** ADR-315 Phase 5 증분 5g — `body`: the server answers `keys` (`only` · `except`). */
    readonly keyRows?: unknown;
    /** ADR-315 Phase 5 증분 5g — `body`: the server answers `groupOf` (a group's rows). */
    readonly groupRows?: unknown;
    /** ADR-315 사용자 결정 4 — `body`: the server runs the aggregates added after ADR-291. */
    readonly extendedAggregates?: unknown;
    /** ADR-315 Phase 5 증분 5g — `suffix`: the parameters of the keys to answer · to leave out. */
    readonly keyOnlyParam?: unknown;
    readonly keyExceptParam?: unknown;
  };
}

/**
 * A slice a Table state holds that a request may have to carry: the sort, the search, or a column
 * filter of a comparison. ADR-315 Phase 5 증분 5g — and the slices that read every row: a
 * grouping, a totals row, a tree (its rows' child rows by a parent field · a children field).
 */
export type CatalogTableServedSlice =
  | "sort"
  | "search"
  | { readonly filter: ViewComparison }
  | "grouping"
  | "totals"
  | "tree"
  | "pins";

/** What of a slice a Table accepts into its state. */
export type CatalogTableSliceAccepts =
  | { readonly accepts: "whole" }
  | {
      readonly accepts: "one";
      readonly reason: "sortTemplate" | "suffixSingle";
    }
  | {
      readonly accepts: "none";
      readonly reason:
        | "suffixNoSearch"
        | "suffixComparison"
        /** ADR-315 Phase 5 증분 5g — the endpoint names no request for rows by key (pins). */
        | "noKeyRows";
    }
  /**
   * ADR-315 Phase 5 증분 5g — accepted, run here over every row: the collection loads whole
   * (`VIEW_LOCAL_LOAD_CAP`; past it the Table shows nothing and says so) — `rowsSplit` · the
   * endpoint's pages split what a grouping · a totals row reads; `treeIndex` · a tree's rows are
   * indexed by their parent across every row (§4.3.1).
   */
  | {
      readonly accepts: "loaded";
      /** `aggregateNotRun` — an aggregate the server does not run (사용자 결정 4). */
      readonly reason: "rowsSplit" | "treeIndex" | "aggregateNotRun";
    };

/**
 * What of a slice a Table accepts into its state (breakdown §4.3.1) — `whole`; for the sort `one`
 * entry with why (`sortTemplate` — the endpoint's own `{{ sortDescriptor }}` names one column;
 * `suffixSingle` — a flat parameter format that does not take a sort list); for the search · a
 * column filter `none` with why (`suffixNoSearch` — a flat parameter format with no search
 * parameter: a condition over several fields is not a parameter; `suffixComparison` — the format
 * names no suffix for that comparison). A `body` format carries every slice; rows that are all
 * here (a local collection · an endpoint without a query format) run every slice here. The
 * session (a header press · a rule's Do · the browser's memory) and the panel read this one
 * judgment.
 */
export function catalogTableSliceServable(
  service: CatalogTableRowService,
  slice: CatalogTableServedSlice,
  /** A grouping's · a totals row's aggregates (the Columns' 「Aggregate」). */
  aggregates: readonly unknown[] = [],
): CatalogTableSliceAccepts {
  if (!service.remote) return { accepts: "whole" };
  // (ADR-315 Phase 5 증분 5g — the rows a server pages are part of the data: a grouping · a
  //  totals row · a tree over them is over every row, loaded here. Never the loaded part's.)
  // (… unless the endpoint answers a group's rows (`groupOf`): the groups · the totals are its —
  //  a group query, and an open group's rows a request of their own, §4.3.2.)
  // (A tree format — not `suffix` · not `none`, as the serializer reads it.)
  const tree =
    !!service.format &&
    service.format.kind !== "suffix" &&
    service.format.kind !== "none";
  if (slice === "grouping" || slice === "totals")
    return !tree || service.format!.groupRows !== true
      ? { accepts: "loaded", reason: "rowsSplit" }
      : service.format!.extendedAggregates !== true &&
          aggregates.some((fn) =>
            VIEW_EXTENDED_AGGREGATES.has(fn as ViewAggregateFn),
          )
        ? { accepts: "loaded", reason: "aggregateNotRun" }
        : { accepts: "whole" };
  if (slice === "tree") return { accepts: "loaded", reason: "treeIndex" };
  const suffix = service.format?.kind === "suffix";
  // (ADR-315 Phase 5 증분 5g — a pinned row may be on another page: the pinned rows are a request
  //  of their own (`keys.only`) and the page leaves them out (`keys.except`) — only where the
  //  endpoint names those requests, §4.3.3. Never a condition on the key field: a key differing
  //  in case only would be pinned with it.)
  if (slice === "pins") {
    const format = service.format;
    const named = (value: unknown) => typeof value === "string" && !!value;
    return (tree && format!.keyRows === true) ||
      (suffix && named(format!.keyOnlyParam) && named(format!.keyExceptParam))
      ? { accepts: "whole" }
      : { accepts: "none", reason: "noKeyRows" };
  }
  if (slice === "sort") {
    if (service.readsSortTemplate)
      return { accepts: "one", reason: "sortTemplate" };
    if (suffix && service.format!.multiSort !== true)
      return { accepts: "one", reason: "suffixSingle" };
    return { accepts: "whole" };
  }
  if (!suffix) return { accepts: "whole" };
  if (slice === "search")
    return typeof service.format!.searchParam === "string" &&
      service.format!.searchParam
      ? { accepts: "whole" }
      : { accepts: "none", reason: "suffixNoSearch" };
  const suffixes: Readonly<Record<string, unknown>> =
    service.format!.suffixes ?? DEFAULT_QUERY_SUFFIXES;
  const carried =
    slice.filter === "between"
      ? suffixes.gte !== undefined && suffixes.lte !== undefined
      : suffixes[slice.filter] !== undefined;
  return carried
    ? { accepts: "whole" }
    : { accepts: "none", reason: "suffixComparison" };
}

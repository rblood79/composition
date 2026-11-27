import {
  buildCollectionRowTemplateItem,
  COLLECTION_ROW_PROJECTION_WINDOW_LIMIT,
  getFlatProjectionRows,
  parentRowsToTree,
  readDataBindingRows,
  resolveBoundCollection,
  resolveField,
  resolveFieldRoles,
  toItemProjectionRow,
  type CollectionDataSource,
  type DataBindingValue,
} from "@composition/shared";
import {
  CATALOG_UNAVAILABLE_END_FIELD,
  CATALOG_UNAVAILABLE_FIELD,
  catalogUnavailableRowDates,
} from "../document/unavailableDates";
import type {
  CatalogBoundRow,
  CatalogBoundRows,
  CatalogRowBinding,
  CatalogViewResultMeta,
} from "../resolution/resolver";
import {
  viewAggregateOf,
  runViewQueries,
  viewResultSchema,
  viewFieldOf,
  viewRunReferences,
  viewRunSchema,
  type ViewRunCollection,
  type ViewRunInput,
  type ViewRunResult,
} from "../../collections/view/evaluate";
import {
  hasFormula,
  withComputedCells,
} from "../../collections/formula/compute";
import { formulaRuntimeSync } from "../../collections/formula/engine";
import { catalogRowQueryResolve, type CatalogRowQuery } from "./viewQuery";
import { viewSortOrder } from "../../collections/view/sortOrder";
import {
  viewRowsPassing,
  viewRowsPassingGroup,
  type ViewRowTest,
} from "../../collections/view/rowFilter";
import { viewRowTestGroupOf } from "../../collections/view/rowTests";
import { catalogFilterTreeConditions } from "./filterScope";
import type { CatalogRowSorts } from "./tableSort";
import {
  CATALOG_GROUP_PLACEHOLDER_SUFFIX,
  type CatalogRowPins,
  type CatalogRowSlices,
  type CatalogRowTree,
} from "./tableRowSlices";
import {
  catalogGroupBoundRows,
  catalogServedGroupBoundRows,
} from "./tableGroupRows";
import type {
  CatalogReader,
  DataBindingRef,
  DataCollectionId,
  DataFieldId,
  EditTarget,
  NodeId,
} from "../document/types";

/**
 * ADR-248 Phase 4e-4e: a node's data binding in the catalog document — the typed `binding`
 * (`DataBindingRef`) holds the collection and the fieldMap's fields as references (`data:collection:…`
 * · `data:field:…`; H1: the collections themselves stay in the data store). The Properties binding
 * picker keeps its value shape (`DataBindingValue`, source `dataTable`); these convert between the
 * two, and the Data panel's usage counts read the graph's collection index.
 */

const COLLECTION = "data:collection:";
const FIELD = "data:field:";
/** The reference id pattern the catalog validator takes after the prefix. */
const REF_ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

export const catalogCollectionId = (collectionId: string): DataCollectionId =>
  `${COLLECTION}${collectionId}` as DataCollectionId;
export const dataCollectionIdOf = (ref: string): string =>
  ref.startsWith(COLLECTION) ? ref.slice(COLLECTION.length) : ref;

/**
 * The picker value as a binding reference: `undefined` = no binding (clear), `null` = a value the
 * document cannot hold (a non-table source, or ids outside the reference pattern).
 */
export function catalogBindingRef(
  value: DataBindingValue | undefined,
): DataBindingRef | undefined | null {
  if (!value) return undefined;
  if (value.source !== "dataTable" || !value.collectionId) return null;
  if (!REF_ID.test(value.collectionId)) return null;
  const fieldMap: Record<string, DataFieldId> = {};
  for (const [role, fieldId] of Object.entries(value.fieldMap ?? {})) {
    if (typeof fieldId !== "string" || !REF_ID.test(fieldId)) return null;
    fieldMap[role] = `${FIELD}${fieldId}` as DataFieldId;
  }
  return {
    collectionId: catalogCollectionId(value.collectionId),
    fieldMap,
    ...(typeof value.key === "string" && value.key.trim()
      ? { key: value.key.trim() }
      : {}),
  };
}

/** A binding reference as the picker value (`name` = the collection's, when known). */
export function catalogBindingValue(
  ref: DataBindingRef | undefined,
  name = "",
): DataBindingValue | undefined {
  if (!ref) return undefined;
  const fieldMap = Object.fromEntries(
    Object.entries(ref.fieldMap).map(([role, fieldId]) => [
      role,
      fieldId.slice(FIELD.length),
    ]),
  );
  return {
    source: "dataTable",
    collectionId: dataCollectionIdOf(ref.collectionId),
    name,
    ...(Object.keys(fieldMap).length ? { fieldMap } : {}),
    ...(ref.key !== undefined ? { key: ref.key } : {}),
  };
}

/** The owned node's binding (a template position has none of its own). */
export function catalogTargetBinding(
  graph: CatalogReader,
  target: EditTarget,
): DataBindingRef | undefined {
  if (target.kind !== "node") return undefined;
  const node = graph.getEntry(target.id);
  return node?.kind === "node" ? node.binding : undefined;
}

interface CollectionIndexReader extends CatalogReader {
  bindingsOf(collectionId: string): ReadonlySet<string>;
}

/** Collection id (data store id) → the number of nodes bound to it (the graph's index). */
export function catalogCollectionUsage(
  graph: CollectionIndexReader,
  collectionIds: Iterable<string>,
): Map<string, number> {
  const usage = new Map<string, number>();
  for (const id of collectionIds) {
    const count = graph.bindingsOf(catalogCollectionId(id)).size;
    if (count) usage.set(id, count);
  }
  return usage;
}

/**
 * The elements a field's usage is read from (`resolveFieldUsage`): the nodes bound to the
 * collection and their owned subtrees, each with its own plain prop values and its binding in the
 * picker shape. Other nodes cannot use a collection's field (a template reads its own collection).
 */
export function catalogFieldUsageElements(
  graph: CollectionIndexReader,
  collectionId: string,
): {
  id: NodeId;
  type: string;
  props: Record<string, unknown>;
  dataBinding?: DataBindingValue;
}[] {
  const out: ReturnType<typeof catalogFieldUsageElements> = [];
  const seen = new Set<string>();
  const visit = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    const node = graph.getEntry(id);
    if (node?.kind !== "node") return;
    const props: Record<string, unknown> = {};
    for (const [key, write] of Object.entries(node.props))
      if (write.kind === "set") props[key] = write.value;
    const binding = catalogBindingValue(node.binding);
    out.push({
      id: node.id,
      type: node.definitionId,
      props,
      ...(binding ? { dataBinding: binding } : {}),
    });
    node.children.forEach(visit);
  };
  graph.bindingsOf(catalogCollectionId(collectionId)).forEach(visit);
  return out;
}

/**
 * The data rows a binding shows (ADR-248 4e-4e): the collection's current rows (mock or runtime,
 * `resolveCollectionSnapshot`) through the old projection row reader (label/description/icon/
 * value heuristics and `fieldMap` roles), at most the old window limit. `undefined` = the
 * collection is not loaded (the template items stay). Duplicate keys get their index.
 * `kind: "records"` = the collection's own records, every row (the old Canvas Chart's
 * `readDataBindingRows` — the chart model caps its rows itself). A `key` (already resolved — the
 * composition root resolves the binding's template) gives that one item (`useListData.getItem`,
 * past the window), or an empty item when no item has it.
 */
export function catalogBoundRows(
  ref: CatalogRowBinding,
  sources: readonly CollectionDataSource[],
  kind: "items" | "records" = "items",
  limit = COLLECTION_ROW_PROJECTION_WINDOW_LIMIT,
  /** ADR-310 Phase 7 — a page's first row (`[start, limit)` — the rows before it are the earlier pages'). */
  start = 0,
  /**
   * A bound Table's state as its rows read it (the Preview's — its sort entries in order, its
   * search, its column filters): the rows are filtered and ordered by it before `limit` · `start`
   * cut them — 「더 보기」 and a page show the filtered · sorted collection's rows. A view its
   * variable sorts (`query.sort`) keeps its own order, and rows the server answered with the
   * state in the request (`query.served.state` — ADR-315 HC2) are not filtered · sorted again.
   */
  slices?: CatalogRowSlices,
): CatalogBoundRows | undefined {
  const dataBinding = catalogBindingValue(ref);
  const table = dataBinding && resolveBoundCollection(dataBinding, sources);
  if (!dataBinding || !table) return undefined;
  // ADR-284 Decision 3 · 6 — the view runs on the collection's whole rows, before the display
  // window below: its result stands in for the collection's rows (every reader after this point —
  // items · records · trees · the "+N more" total — reads the view's rows).
  let view: CatalogViewResultMeta | undefined;
  let collections = sources;
  /** The collection's rows replaced by a view's result (a grouped one with its own fields). */
  const resultRows = (
    rows: readonly unknown[],
    schema?: ViewRunResult["schema"],
  ): readonly CollectionDataSource[] =>
    sources.map((source) =>
      source === table
        ? {
            ...source,
            useMockData: true,
            mockData: rows as never,
            status: "success" as const,
            ...(schema ? { schema: schema as never } : {}),
          }
        : source,
    );
  // (ADR-291 Decision 3 — computed cells exist at the row-reading stage, whatever the view · the
  // server did: a binding with no view and rows the server answered read them too.)
  const schema = viewRunSchema(table.schema);
  const computedRows = (rows: readonly unknown[], query?: CatalogRowQuery) =>
    withComputedCells(rows, schema, {
      ...(query ? { resolve: catalogRowQueryResolve(query) } : {}),
    });
  if (ref.query?.served) {
    // (The server answered this view: its rows are the result — never filtered again, R1.)
    const source = readDataBindingRows(dataBinding, sources);
    const rows = computedRows(source, ref.query);
    const { complete, total, warnings, depth, mode } = ref.query.served;
    const whole = complete && (total === undefined || total <= rows.length);
    view = {
      matched: rows.length,
      loaded: rows.length,
      complete: whole,
      ...(total !== undefined ? { total } : {}),
      broken: [],
      applied: 0,
      served: true,
      ...(warnings ? { unsent: warnings } : {}),
    };
    if (depth !== undefined && depth < ref.query.queries.length) {
      // (A count of the answered view — 「결과 수 표시」: the server's total, else the loaded rows'
      // count marked as part of the data.)
      const counts = ref.query.queries.slice(depth);
      const known = total !== undefined || whole;
      const result = runBindingView(
        rows,
        table,
        { ...ref.query, queries: counts },
        sources,
      );
      // (「적용 조건 수」 is the answered views' own — read from their conditions, not the rows.)
      const appliedNames = new Set(
        counts.flatMap((query) =>
          (query.aggregates ?? [])
            .filter((aggregate) => aggregate.fn === "applied")
            .map((aggregate) => aggregate.as),
        ),
      );
      const applied = appliedNames.size
        ? runBindingView(
            [],
            table,
            { ...ref.query, queries: ref.query.queries.slice(0, depth) },
            sources,
          ).applied
        : 0;
      const counted = (
        known
          ? result.rows.map((row) =>
              Object.fromEntries(
                Object.keys(row as object).map((key) => [
                  key,
                  total ?? rows.length,
                ]),
              ),
            )
          : partialAggregates(result.rows, counts)
      ).map((row) =>
        appliedNames.size
          ? {
              ...(row as object),
              ...Object.fromEntries(
                [...appliedNames].map((name) => [name, applied]),
              ),
            }
          : row,
      );
      view = { ...view, matched: counted.length, complete: known };
      collections = resultRows(counted, result.schema);
    } else if (mode === "aggregate") {
      // (ADR-291 Decision 6 — the server ran the grouping: its rows are the view's result rows,
      // with the result's fields — the group keys and the aggregates.)
      const last = ref.query.queries.at(-1)!;
      collections = resultRows(
        rows,
        viewResultSchema(last, schema, viewRunReferences(sources)),
      );
    } else if (rows !== source) {
      collections = resultRows(rows);
    }
  } else if (ref.query) {
    const rows = readDataBindingRows(dataBinding, sources);
    const result = runBindingView(rows, table, ref.query, sources);
    // (Local rows are the whole data; an API page is part of it until no further page.)
    const complete =
      table.useMockData === true ? true : ref.query.loaded?.complete;
    view = {
      matched: result.rows.length,
      loaded: rows.length,
      ...(complete !== undefined ? { complete } : {}),
      broken: result.broken,
      applied: result.applied,
    };
    // (A grouped view's rows have its own fields: the group fields and the aggregates. Over part
    // of the data its aggregates say so — never a partial count shown as the whole, Decision 6.)
    const grouped = ref.query.queries.some(
      (item) => item.groupBy || item.aggregates,
    );
    collections = resultRows(
      grouped && complete !== true
        ? partialAggregates(result.rows, ref.query.queries)
        : result.rows,
      grouped ? result.schema : undefined,
    );
  } else if ((table.schema ?? []).some((field) => field.formula)) {
    collections = resultRows(
      computedRows(readDataBindingRows(dataBinding, sources)),
    );
  }
  if (view && ref.query?.sort) view = { ...view, sort: ref.query.sort };
  const sort = slices?.sorts;
  const { sorts: _sorts, ...unsorted } = slices ?? {};
  let shown = boundRowsOf(
    ref,
    dataBinding,
    collections,
    kind,
    limit,
    start,
    ref.query?.served?.state
      ? // (ADR-315 Phase 5 증분 5g — what of the slices a server answered: its pinned rows around
        //  its page, its groups, its totals row.)
        servedSlicesOf(slices, computedRows)
      : ref.query?.sort
        ? unsorted
        : slices?.pins?.rows
          ? {
              ...slices,
              pins: { ...slices.pins, rows: computedRows(slices.pins.rows) },
            }
          : slices,
  );
  // (The server answered in the Table's sort: the rows say so — their reader does not sort them.)
  if (shown && sort?.length && ref.query?.served?.state)
    Object.assign(shown, { sorted: sort });
  // (A key with no group in a grouped view: that group has no rows — its counts are 0, a user
  // nothing points at has 0 orders.)
  const last = ref.query?.queries.at(-1);
  if (
    ref.key !== undefined &&
    last?.groupBy &&
    shown?.[0] &&
    !Object.keys(shown[0].values).length
  )
    shown = [
      {
        ...shown[0],
        values: Object.fromEntries(
          (last.aggregates ?? [])
            .filter((aggregate) => aggregate.fn === "count")
            .map((aggregate) => [aggregate.as, 0]),
        ),
      },
    ];
  // (S2 `disabledKeys` by a data field — 부록 D.3 2단계, 2026-11-23: the rows it marks, over every
  //  row the binding reads, not only the window.)
  const disabledKeys =
    shown && kind === "items"
      ? disabledRowKeys(dataBinding, collections)
      : undefined;
  if (shown && disabledKeys) Object.assign(shown, { disabledKeys });
  // (S2 `isDateUnavailable` from data — 부록 D.3 2단계: the dates its rows name, every row.)
  const unavailableDates =
    shown && kind === "items"
      ? unavailableRowDates(dataBinding, collections)
      : undefined;
  if (shown && unavailableDates) Object.assign(shown, { unavailableDates });
  return shown && view ? Object.assign(shown, { view }) : shown;
}

/**
 * S2 체크리스트 부록 D.3 2단계 (2026-11-23) — the keys of a bound collection's rows its disabled field
 * marks (the binding's `fieldMap.disabled`, a boolean field — `true` disables the row's item): over
 * every row the binding reads and every child level (`fieldMap.children`), keyed as its items are
 * (`toItemProjectionRow` — `fieldMap.value` → the key field → `id` · `key` · `value` → `row-N`).
 * The resolver adds them to the collection's `disabledKeys`; undefined = no disabled field.
 */
function disabledRowKeys(
  dataBinding: DataBindingValue,
  collections: readonly CollectionDataSource[],
): string[] | undefined {
  const ref = dataBinding.fieldMap?.disabled;
  if (typeof ref !== "string" || !ref) return undefined;
  const bound = resolveBoundCollection(dataBinding, collections);
  const field =
    (bound?.schema ? resolveField(bound.schema, ref)?.key : undefined) ?? ref;
  const roles = resolveFieldRoles(dataBinding, bound?.schema, bound?.keyField);
  const keys: string[] = [];
  const visit = (rows: readonly unknown[]) =>
    rows.forEach((row, index) => {
      if (row === null || typeof row !== "object") return;
      const values = row as Record<string, unknown>;
      if (values[field] === true)
        keys.push(toItemProjectionRow(row, index, roles).itemKey);
      const children = roles?.children ? values[roles.children] : undefined;
      if (Array.isArray(children)) visit(children);
    });
  visit(readDataBindingRows(dataBinding, collections));
  return keys;
}

/**
 * S2 체크리스트 부록 D.3 2단계 (2026-11-23) — the dates a date component's binding names: each row's
 * 「Unavailable date」 field (`fieldMap.unavailable`, a field id) and, with `unavailableEnd`, the
 * period up to it (an ISO interval `start/end`) — over every row the binding reads (its view's
 * result). Undefined = no such field.
 */
function unavailableRowDates(
  dataBinding: DataBindingValue,
  collections: readonly CollectionDataSource[],
): string[] | undefined {
  const map = dataBinding.fieldMap as
    Record<string, string | undefined> | undefined;
  const ref = map?.[CATALOG_UNAVAILABLE_FIELD];
  if (typeof ref !== "string" || !ref) return undefined;
  const bound = resolveBoundCollection(dataBinding, collections);
  const keyOf = (id: string | undefined) =>
    id
      ? ((bound?.schema ? resolveField(bound.schema, id)?.key : undefined) ??
        id)
      : undefined;
  return catalogUnavailableRowDates(
    readDataBindingRows(dataBinding, collections),
    keyOf(ref)!,
    keyOf(map?.[CATALOG_UNAVAILABLE_END_FIELD]),
  ).map((entry) =>
    typeof entry === "string" ? entry : `${entry.start}/${entry.end}`,
  );
}

/**
 * Aggregates over part of the data (an API collection before its last page) as shown: a count is
 * at least its value (`12+` — a `uniqueCount` too), another aggregate an estimate (`≈ 4.2`) — the
 * rows keep the group fields. A `first` is the data's first row whatever the part (exact), and a
 * list (`unique` · `extent`) is left as it is. Display only: the run's own values are numbers.
 */
const EXACT_ON_PART: ReadonlySet<string> = new Set([
  "applied",
  "first",
  "unique",
  "extent",
]);
function partialAggregates(
  rows: readonly unknown[],
  queries: CatalogRowQuery["queries"],
): unknown[] {
  const marks = new Map<string, string>();
  for (const query of queries)
    for (const aggregate of query.aggregates ?? [])
      // (「적용 조건 수」 reads the conditions, not the rows — whole on any part of the data.)
      if (!EXACT_ON_PART.has(aggregate.fn))
        marks.set(aggregate.as, aggregate.fn);
  return rows.map((row) => {
    if (row === null || typeof row !== "object") return row;
    const out = { ...(row as Record<string, unknown>) };
    for (const [name, fn] of marks) {
      const value = out[name];
      if (value === null || value === undefined) continue;
      out[name] =
        fn === "count" || fn === "uniqueCount" ? `${value}+` : `≈ ${value}`;
    }
    return out;
  });
}

/**
 * The last run per source rows and query (ADR-284 R4 — the memo key is the view definition, the
 * values it read and the source rows; a variable write or a row change is another key).
 */
interface ViewReferenceSnapshot {
  rows: readonly unknown[];
  schema: string;
}
interface CachedViewRun {
  result: ViewRunResult;
  references: ReadonlyMap<string, ViewReferenceSnapshot | undefined>;
}
const viewRuns = new WeakMap<object, Map<string, CachedViewRun>>();

function referenceSnapshot(
  target: ViewRunCollection | undefined,
): ViewReferenceSnapshot | undefined {
  return target
    ? { rows: target.rows, schema: JSON.stringify(target.schema) }
    : undefined;
}

function runBindingView(
  rows: readonly unknown[],
  table: CollectionDataSource,
  query: CatalogRowQuery,
  sources: readonly CollectionDataSource[],
): ViewRunResult {
  const references = viewRunReferences(sources);
  // (ADR-291 — a formula edit changes the rows' cells without changing the rows; a run before the
  // engine loaded read them as `null` — the load is another key, not that result.)
  const schema = viewRunSchema(table.schema);
  const pending =
    (table.schema ?? []).some(hasFormula) && !formulaRuntimeSync();
  const signature = JSON.stringify([
    query.queries,
    query.values,
    schema,
    pending,
  ]);
  let runs = viewRuns.get(rows);
  if (!runs) viewRuns.set(rows, (runs = new Map()));
  const cached = runs.get(signature);
  // Track what the evaluator actually read, including nested and missing targets. Repeating
  // the reference traversal here loses dependencies when the evaluator gains a new path.
  if (
    cached &&
    [...cached.references].every(([id, before]) => {
      const current = referenceSnapshot(references(id));
      return (
        before?.rows === current?.rows && before?.schema === current?.schema
      );
    })
  )
    return cached.result;
  const dependencies = new Map<string, ViewReferenceSnapshot | undefined>();
  const result = runViewQueries(rows, {
    queries: query.queries,
    schema,
    resolve: catalogRowQueryResolve(query),
    references: (id) => {
      const target = references(id);
      dependencies.set(id, referenceSnapshot(target));
      return target;
    },
  });
  // (A few views per rows: the oldest goes first.)
  if (runs.size >= 16) runs.delete(runs.keys().next().value!);
  runs.set(signature, { result, references: dependencies });
  return result;
}

/**
 * ADR-325 Decision 8 (사용자 결정 3) — whether a row the user inserted belongs in a list the server
 * answered for a view: the view's conditions (its `where`s, none of its groupings · sorts) judged
 * here by the one evaluator. A row already in the server's answer is never judged (it stays where
 * the server put it until the list loads again).
 */
export function catalogRowMatchesQuery(
  row: unknown,
  ref: CatalogRowBinding,
  sources: readonly CollectionDataSource[],
): boolean {
  const dataBinding = catalogBindingValue(ref);
  const table = dataBinding && resolveBoundCollection(dataBinding, sources);
  if (!table || !ref.query) return true;
  const queries = ref.query.queries
    .filter((query) => !query.groupBy?.length && !query.aggregates?.length)
    .map((query) => ({ ...query, sort: undefined }));
  if (!queries.length) return true;
  const rows = withComputedCells([row], viewRunSchema(table.schema), {
    resolve: catalogRowQueryResolve(ref.query),
  });
  return (
    runBindingView(rows, table, { ...ref.query, queries }, sources).rows
      .length > 0
  );
}

/** The role names a row's template values carry over its item's own fields (`buildCollectionRowTemplateItem`). */
const ROW_ROLE_VALUES = new Set(["label", "description", "icon", "value"]);
/** The source rows last ordered by a sort (`sortedRowOrder`) — a few sorts per rows. */
const sortedOrders = new WeakMap<
  readonly unknown[],
  Map<string, Uint32Array>
>();
/**
 * The source rows' indexes in a Table sort's order — by the value the row's template reads for
 * each entry's field (`CatalogBoundRow.values[key]`), compared by the field's type (the views'
 * sort — `viewSortOrder`). The same rows sorted the same way are the same order (a window move ·
 * another read of the step — sorting 10,000 rows for each); a column's ranks are kept too, so
 * another direction or one more entry compares numbers only.
 */
function sortedRowOrder(
  sourceRows: readonly unknown[],
  sorts: CatalogRowSorts,
  roles: Parameters<typeof toItemProjectionRow>[2],
  schema: readonly { id?: string; key: string; type?: string }[] | undefined,
): Uint32Array {
  const byRole = sorts.some((sort) => ROW_ROLE_VALUES.has(sort.key));
  // (The Column key is the field's key — `resolveField`, ADR-152.)
  const types = sorts.map((sort) => resolveField(schema, sort.key)?.type);
  const signature = JSON.stringify([
    sorts.map((sort) => [sort.key, sort.direction, sort.empty ?? "last"]),
    types,
    byRole ? (roles ?? null) : 0,
  ]);
  let held = sortedOrders.get(sourceRows);
  if (!held) sortedOrders.set(sourceRows, (held = new Map()));
  let order = held.get(signature);
  if (!order) {
    order = viewSortOrder(
      sourceRows.length,
      sorts.map((sort, entry) => {
        const role = ROW_ROLE_VALUES.has(sort.key);
        return {
          valueAt: (index: number) => {
            const item = sourceRows[index];
            if (role)
              return buildCollectionRowTemplateItem(
                toItemProjectionRow(item, index, roles),
              )[sort.key];
            return item !== null &&
              typeof item === "object" &&
              !Array.isArray(item)
              ? (item as Record<string, unknown>)[sort.key]
              : undefined;
          },
          direction: sort.direction,
          ...(types[entry] !== undefined ? { type: types[entry] } : {}),
          ...(sort.empty ? { empty: sort.empty } : {}),
          // (A role's value depends on the binding's roles: not kept by the key alone.)
          ...(role ? {} : { cache: { rows: sourceRows, name: sort.key } }),
        };
      }),
    );
    if (held.size >= 8) held.delete(held.keys().next().value!);
    held.set(signature, order);
  }
  return order;
}

/** The source rows a Table's search · filters keep, in its sort's order — a few states per rows. */
const keptOrders = new WeakMap<
  readonly unknown[],
  Map<string, Uint32Array | null>
>();
/** A source row's value of a key: the row's own field, or a role's template value. */
function rowValueOf(
  sourceRows: readonly unknown[],
  key: string,
  roles: Parameters<typeof toItemProjectionRow>[2],
): (index: number) => unknown {
  if (ROW_ROLE_VALUES.has(key))
    return (index) =>
      buildCollectionRowTemplateItem(
        toItemProjectionRow(sourceRows[index], index, roles),
      )[key];
  return (index) => {
    const item = sourceRows[index];
    return item !== null && typeof item === "object" && !Array.isArray(item)
      ? (item as Record<string, unknown>)[key]
      : undefined;
  };
}
/**
 * ADR-315 Phase 5 증분 5c — a totals row's values: each aggregate over the kept rows' cells (the
 * evaluator's — `viewAggregateOf`, as a group row's), by Column key.
 */
function catalogRowTotals(
  sourceRows: readonly unknown[],
  kept: ArrayLike<number>,
  aggregates: NonNullable<CatalogRowSlices["totals"]>,
  roles: Parameters<typeof toItemProjectionRow>[2],
): Record<string, unknown> {
  // (Each Column's cells read off the rows — `rowValueOf`, as the filters' — not a template row
  //  made of every kept row first: 10,000 rows, 2 objects a row on every sort · keystroke.)
  const out: Record<string, unknown> = {};
  for (const aggregate of aggregates)
    out[aggregate.key] = aggregate.fn
      ? viewAggregateOf(
          aggregate.fn,
          () => Array.from(kept, rowValueOf(sourceRows, aggregate.key, roles)),
          kept.length,
        )
      : null;
  return out;
}

/**
 * ADR-315 Phase 3 — the source rows' indexes a Table's search · column filters keep, in `order`
 * (its sort's — else the rows' own; a fuzzy search without a sort: the best matches first). The
 * tests are the views' comparisons on row numbers (`viewRowsPassing`): the sort's order is made
 * once and a search typed on filters it — never a sort a keystroke. Undefined = no test applies.
 */
function keptRowOrder(
  sourceRows: readonly unknown[],
  order: Uint32Array | undefined,
  slices: CatalogRowSlices,
  roles: Parameters<typeof toItemProjectionRow>[2],
  schema: Parameters<typeof viewRunSchema>[0],
  /** The collections a filter condition's path through a reference reads (ADR-320). */
  references?: NonNullable<ViewRunInput["references"]>,
): Uint32Array | undefined {
  const { search, where } = slices;
  const typeOf = (key: string) => resolveField(schema, key)?.type;
  const byRole = (search?.keys ?? []).some((key) => ROW_ROLE_VALUES.has(key));
  // (ADR-320 — the scope's filter tree reads fields by their data id: the rows' fields as a view
  //  run reads them. A condition's value is the tree's own — a run-time tree holds no reference.)
  const fields = where ? viewRunSchema(schema) : [];
  const read = where ? catalogFilterTreeConditions(where) : [];
  const signature = JSON.stringify([
    search ?? null,
    where ?? null,
    (slices.sorts ?? []).map((sort) => [
      sort.key,
      sort.direction,
      sort.empty ?? "last",
    ]),
    (search?.keys ?? []).map(typeOf),
    // (The fields the tree reads, as the rows have them now: a type · a key changing is another run.)
    read.map((condition) =>
      condition.fields.map((path) => {
        const field = viewFieldOf(path, fields, references);
        return field ? [field.key, field.type ?? null] : null;
      }),
    ),
    byRole ? (roles ?? null) : 0,
  ]);
  let held = keptOrders.get(sourceRows);
  if (!held) keptOrders.set(sourceRows, (held = new Map()));
  const before = held.get(signature);
  if (before !== undefined) return before ?? undefined;
  const field = (key: string) => {
    const type = typeOf(key);
    return {
      valueAt: rowValueOf(sourceRows, key, roles),
      ...(type !== undefined ? { type } : {}),
      // (A role's value depends on the binding's roles: no name to keep a search's misses by.)
      ...(ROW_ROLE_VALUES.has(key) ? {} : { name: key }),
    };
  };
  // (ADR-320 Decision 3 — the tree as row tests: what applies is the evaluator's reading. A field
  //  read through a reference reads the target row; any other reads the row's own cell.)
  const filters = where
    ? viewRowTestGroupOf(
        where,
        {
          schema: fields,
          resolve: (value) => ({ value }),
          ...(references ? { references } : {}),
        },
        sourceRows,
        (item) =>
          item.read
            ? (index) => item.read!(sourceRows[index])
            : rowValueOf(sourceRows, item.key, roles),
      )
    : undefined;
  const searchTests: ViewRowTest[] = search
    ? [
        {
          fields: search.keys.map(field),
          op: "contains" as const,
          value: search.text,
          search: search.match === "fuzzy" ? "fuzzy" : "contains",
        } satisfies ViewRowTest,
      ]
    : [];
  // (A tree of its root's conditions only: the fast path — the tests with the search, a row one
  //  test dropped not compared again. An `or` · a nested group: the group path, then the search.)
  const flat = !filters || filters.items.every((item) => !("items" in item));
  let pass: Uint8Array | undefined;
  let rank: Uint16Array | undefined;
  if (flat) {
    ({ pass, rank } = viewRowsPassing(
      sourceRows.length,
      [...((filters?.items ?? []) as readonly ViewRowTest[]), ...searchTests],
      { rows: sourceRows },
    ));
  } else {
    pass = viewRowsPassingGroup(sourceRows.length, filters!);
    if (searchTests.length) {
      const found = viewRowsPassing(sourceRows.length, searchTests, {
        rows: sourceRows,
      });
      rank = found.rank;
      if (found.pass) {
        if (!pass) pass = found.pass;
        else
          for (let index = 0; index < pass.length; index += 1)
            pass[index]! &= found.pass[index]!;
      }
    }
  }
  let kept: Uint32Array | null = null;
  if (pass) {
    let count = 0;
    for (let index = 0; index < pass.length; index += 1) count += pass[index]!;
    kept = new Uint32Array(count);
    let at = 0;
    if (order) {
      for (let place = 0; place < order.length; place += 1)
        if (pass[order[place]!]) kept[at++] = order[place]!;
    } else {
      for (let index = 0; index < pass.length; index += 1)
        if (pass[index]) kept[at++] = index;
      // (No sort: a fuzzy search's rows by their grade — equal grades in the rows' own order.)
      if (rank) kept.sort((a, b) => rank[a]! - rank[b]! || a - b);
    }
  }
  if (held.size >= 8) held.delete(held.keys().next().value!);
  held.set(signature, kept);
  return kept ?? undefined;
}

/**
 * ADR-315 Phase 5 증분 5d — a tree's rows as one flat list: every row of every level (depth-first,
 * a row before its child rows — a binding's children field; the source rows themselves for a
 * parent ID field), the top rows, each row's child rows and each row's key (a duplicate key's mark
 * by its place in the list — the same under every sort · search · expansion).
 */
interface CatalogRowTreeIndex {
  readonly items: readonly unknown[];
  readonly roots: readonly number[];
  readonly children: readonly (readonly number[] | undefined)[];
  readonly keys: readonly string[];
}
const treeIndexes = new WeakMap<
  readonly unknown[],
  Map<string, CatalogRowTreeIndex>
>();
function catalogRowTreeIndex(
  sourceRows: readonly unknown[],
  roles: NonNullable<Parameters<typeof toItemProjectionRow>[2]>,
): CatalogRowTreeIndex {
  const signature = JSON.stringify([
    roles.children ?? null,
    roles.parentId ?? null,
    roles.value ?? null,
  ]);
  let held = treeIndexes.get(sourceRows);
  if (!held) treeIndexes.set(sourceRows, (held = new Map()));
  const before = held.get(signature);
  if (before) return before;
  let items: readonly unknown[];
  let roots: number[];
  const children: (number[] | undefined)[] = [];
  if (roles.parentId) {
    // (A parent ID field: the source rows indexed by their keys — `parentRowsToTree`, a row whose
    //  parent is missing · itself · in a cycle stands at the top.)
    items = sourceRows;
    const nodes = parentRowsToTree(
      sourceRows.map((item, index) => toItemProjectionRow(item, index, roles)),
      roles.parentId,
    );
    roots = nodes.map((node) => node.row.rowIndex);
    const stack = [...nodes];
    while (stack.length) {
      const node = stack.pop()!;
      if (node.children.length) {
        children[node.row.rowIndex] = node.children.map(
          (child) => child.row.rowIndex,
        );
        stack.push(...node.children);
      }
    }
  } else {
    // (A children field: each row's child rows are an array in it — listed after it.)
    const flat: unknown[] = [];
    const field = roles.children!;
    const visit = (item: unknown): number => {
      const at = flat.length;
      flat.push(item);
      const nested =
        item !== null && typeof item === "object" && !Array.isArray(item)
          ? (item as Record<string, unknown>)[field]
          : undefined;
      if (Array.isArray(nested) && nested.length)
        children[at] = nested.map(visit);
      return at;
    };
    roots = sourceRows.map(visit);
    items = flat;
  }
  const seen = new Set<string>();
  const keys = items.map((item, index) => {
    const key = String(toItemProjectionRow(item, index, roles).itemKey);
    if (!seen.has(key)) {
      seen.add(key);
      return key;
    }
    return `${key}~${index}`;
  });
  const index: CatalogRowTreeIndex = { items, roots, children, keys };
  if (held.size >= 4) held.delete(held.keys().next().value!);
  held.set(signature, index);
  return index;
}

/**
 * ADR-315 Phase 5 증분 5d — a bound Table's rows as a tree (TanStack's sub rows, breakdown §5.4
 * 「계층 데이터」): every row of every level is read · tested; a row stays when it passes the
 * search · filters or a row under it does (its path to the match stays — TanStack
 * `filterFromLeafRows`); each level's rows stand in the sort's order among themselves; a collapsed
 * row's child rows are not read out (one placeholder child — react-aria counts the row as
 * expandable, as a collapsed group); the window · page count top rows (`paginateExpandedRows:
 * false`); the totals are over every row kept, every level.
 */
function treeBoundRows(
  sourceRows: readonly unknown[],
  roles: NonNullable<Parameters<typeof toItemProjectionRow>[2]>,
  schema: Parameters<typeof viewRunSchema>[0],
  slices: CatalogRowSlices,
  tree: CatalogRowTree,
  limit: number,
  start: number,
  references?: NonNullable<ViewRunInput["references"]>,
): CatalogBoundRows {
  const { items, roots, children, keys } = catalogRowTreeIndex(
    sourceRows,
    roles,
  );
  const sort = slices.sorts?.length ? slices.sorts : undefined;
  let place: Uint32Array | undefined;
  if (sort) {
    const order = sortedRowOrder(items, sort, roles, schema);
    place = new Uint32Array(items.length);
    order.forEach((index, at) => (place![index] = at));
  }
  const passed =
    slices.search || slices.where
      ? keptRowOrder(items, undefined, slices, roles, schema, references)
      : undefined;
  let kept: Uint8Array | undefined;
  if (passed) {
    kept = new Uint8Array(items.length);
    for (const index of passed) kept[index] = 1;
    // (A row with a kept row under it stays: children after their parent — the parents last.)
    const parents: number[] = [];
    const stack = [...roots];
    while (stack.length) {
      const index = stack.pop()!;
      const under = children[index];
      if (under) {
        parents.push(index);
        stack.push(...under);
      }
    }
    for (let at = parents.length - 1; at >= 0; at -= 1) {
      const index = parents[at]!;
      if (!kept[index] && children[index]!.some((child) => kept![child]))
        kept[index] = 1;
    }
  }
  const siblings = (list: readonly number[]): number[] => {
    const shown = kept ? list.filter((index) => kept![index]) : [...list];
    return place ? shown.sort((a, b) => place![a]! - place![b]!) : shown;
  };
  const expanded = tree.expanded === "all" ? undefined : new Set(tree.expanded);
  const rowOf = (index: number, depth: number): CatalogBoundRow => {
    const under = children[index] ? siblings(children[index]!) : [];
    const key = keys[index]!;
    const open = under.length > 0 && (!expanded || expanded.has(key));
    const nested = !under.length
      ? undefined
      : open
        ? under.map((child) => rowOf(child, depth + 1))
        : tree.closedChild === false
          ? undefined
          : [
              {
                key: `${key}${CATALOG_GROUP_PLACEHOLDER_SUFFIX}`,
                values: {},
                placeholder: true as const,
              },
            ];
    return {
      key,
      values: buildCollectionRowTemplateItem(
        toItemProjectionRow(items[index], index, roles),
      ),
      ...(nested ? { children: nested } : {}),
      tree: { depth, expanded: open, parent: under.length > 0 },
    };
  };
  const top = siblings(roots);
  const end = Math.min(top.length, Math.max(0, limit));
  const out: CatalogBoundRow[] = top
    .slice(Math.min(start, end), end)
    .map((index) => rowOf(index, 0));
  const meta: Record<string, unknown> = { nested: true };
  if (start > 0 || top.length > end) meta.total = top.length;
  if (slices.totals) {
    const every: number[] = [];
    for (let index = 0; index < items.length; index += 1)
      if (!kept || kept[index]) every.push(index);
    meta.totals = catalogRowTotals(items, every, slices.totals, roles);
  }
  if (sort) meta.sorted = sort;
  return Object.assign(out, meta) as CatalogBoundRows;
}

/**
 * ADR-315 Phase 5 증분 5f — a flat Table's pinned rows (`CatalogRowPins`) out of its rows: the
 * source row numbers of the pinned keys in their pinned order — each key's first row among the
 * rows the search · filters keep (`order` — sorted, kept; none = every row in source order) or,
 * with `keep`, among every row — and the other rows of `order` in theirs. A key with no row (left
 * out, gone) is not shown; the state keeps it (breakdown §4.4).
 */
function catalogPinnedRowOrder(
  sourceRows: readonly unknown[],
  order: ArrayLike<number> | undefined,
  pins: CatalogRowPins,
  roles: Parameters<typeof toItemProjectionRow>[2],
): { top: number[]; bottom: number[]; rest: number[] } {
  const wanted = new Set([...pins.top, ...pins.bottom]);
  const found = new Map<string, number>();
  const look = (index: number) => {
    const key = String(
      toItemProjectionRow(sourceRows[index], index, roles).itemKey,
    );
    if (wanted.has(key) && !found.has(key)) found.set(key, index);
  };
  const pool = pins.keep ? undefined : order;
  const count = pool ? pool.length : sourceRows.length;
  for (let at = 0; at < count && found.size < wanted.size; at += 1)
    look(pool ? pool[at]! : at);
  const at = (keys: readonly string[]) =>
    keys.flatMap((key) => (found.has(key) ? [found.get(key)!] : []));
  const top = at(pins.top);
  const bottom = at(pins.bottom);
  const out = new Set([...top, ...bottom]);
  const rest: number[] = [];
  const length = order ? order.length : sourceRows.length;
  for (let place = 0; place < length; place += 1) {
    const index = order ? order[place]! : place;
    if (!out.has(index)) rest.push(index);
  }
  return { top, bottom, rest };
}
/**
 * ADR-315 Phase 5 증분 5g — the slices that stand on a server's answer to a Table's state: its
 * pinned rows' answer, its groups' answers, its totals row (the rest the request carried).
 */
function servedSlicesOf(
  slices: CatalogRowSlices | undefined,
  computedRows: (rows: readonly unknown[]) => readonly unknown[],
): CatalogRowSlices | undefined {
  if (!slices) return undefined;
  const out: { -readonly [K in keyof CatalogRowSlices]: CatalogRowSlices[K] } =
    {};
  if (slices.pins?.rows)
    out.pins = { ...slices.pins, rows: computedRows(slices.pins.rows) };
  if (slices.groups?.served) out.groups = slices.groups;
  if (slices.servedTotals) {
    out.servedTotals = slices.servedTotals;
    if (slices.totals) out.totals = slices.totals;
  }
  return Object.keys(out).length ? out : undefined;
}
/** A row list's meta (its counts · totals · sort — the keys that are no row's place). */
export function catalogRowListMeta(
  rows: readonly unknown[],
): Record<string, unknown> {
  const meta: Record<string, unknown> = {};
  for (const key of Object.keys(rows))
    if (!/^\d+$/.test(key))
      meta[key] = (rows as unknown as Record<string, unknown>)[key];
  return meta;
}

function boundRowsOf(
  ref: DataBindingRef,
  dataBinding: DataBindingValue,
  collections: readonly CollectionDataSource[],
  kind: "items" | "records",
  limit: number,
  start = 0,
  slices?: CatalogRowSlices,
): CatalogBoundRows | undefined {
  // (No entry is no sort.)
  const sort = slices?.sorts?.length ? slices.sorts : undefined;
  const tested = !!slices?.search || !!slices?.where;
  if (kind === "records")
    return readDataBindingRows(dataBinding, collections).map((item, index) => ({
      key: String(index),
      values:
        item !== null && typeof item === "object" && !Array.isArray(item)
          ? (item as Record<string, unknown>)
          : {},
    }));
  const seen = new Set<string>();
  // (`useTreeData.getChildren` — the binding's children field: each row carries its child rows.)
  const bound = resolveBoundCollection(dataBinding, collections);
  const roles = resolveFieldRoles(dataBinding, bound?.schema, bound?.keyField);
  const childrenKey = roles?.children;
  const parentKey = roles?.parentId;
  const childRows = (item: unknown): CatalogBoundRow[] | undefined => {
    const children =
      childrenKey && item !== null && typeof item === "object"
        ? (item as Record<string, unknown>)[childrenKey]
        : undefined;
    if (!Array.isArray(children) || !children.length) return undefined;
    return children.map((child, index) => {
      const row = toItemProjectionRow(child, index, roles);
      let key = String(row.itemKey);
      if (seen.has(key)) key = `${key}~${index}`;
      seen.add(key);
      const nested = childRows(child);
      return {
        key,
        values: buildCollectionRowTemplateItem(row),
        ...(nested ? { children: nested } : {}),
      };
    });
  };
  // (ADR-315 Phase 5 증분 5d — a Table whose binding names its rows' child rows reads them as a
  //  tree: every row of every level is searched · sorted · totalled, not just the top ones.)
  if (
    slices?.tree &&
    roles &&
    (childrenKey || parentKey) &&
    ref.key === undefined &&
    !slices.groups?.keys.length
  )
    return treeBoundRows(
      readDataBindingRows(dataBinding, collections),
      roles,
      bound?.schema,
      slices,
      slices.tree,
      limit,
      start,
      viewRunReferences(collections),
    );
  // (A sorted Table: the source rows in the sort's order — the rows `limit` takes are the first of
  //  the sorted collection, not the first rows sorted among themselves.)
  // (ADR-315 Phase 5 — a grouped Table reads every row: its groups · aggregates are over all of
  //  them, and its window · page count group rows.)
  const groups =
    slices?.groups?.keys.length && !parentKey && ref.key === undefined
      ? slices.groups
      : undefined;
  // (ADR-315 Phase 5 증분 5c — a totals row reads every row the slices keep, as a grouping does.)
  const totalsOf =
    slices?.totals && !parentKey && ref.key === undefined
      ? slices.totals
      : undefined;
  // (ADR-315 Phase 5 증분 5f — a flat Table's pinned rows: read out of every row, first · last.)
  const pins =
    slices?.pins &&
    (slices.pins.top.length || slices.pins.bottom.length) &&
    !groups &&
    !childrenKey &&
    !parentKey &&
    ref.key === undefined
      ? slices.pins
      : undefined;
  const sourceRows =
    (sort || tested || groups || totalsOf || pins) &&
    !parentKey &&
    ref.key === undefined
      ? readDataBindingRows(dataBinding, collections)
      : undefined;
  const sortOrder =
    sourceRows && sort
      ? sortedRowOrder(sourceRows, sort, roles, bound?.schema)
      : undefined;
  // (The Table's search · filters keep some of the rows: the numbers of those, in that order.)
  const order =
    sourceRows && tested
      ? (keptRowOrder(
          sourceRows,
          sortOrder,
          slices!,
          roles,
          bound?.schema,
          viewRunReferences(collections),
        ) ?? sortOrder)
      : sortOrder;
  // (ADR-315 Phase 5 증분 5g — a server's totals row stands in for the totals over the rows here.)
  const totals = slices?.servedTotals
    ? { ...slices.servedTotals }
    : totalsOf && sourceRows
      ? catalogRowTotals(
          sourceRows,
          order ??
            Array.from({ length: sourceRows.length }, (_, index) => index),
          totalsOf,
          roles,
        )
      : undefined;
  // (ADR-315 Phase 5 증분 5g — a server's groups: the rows are its group rows, an open group's
  //  children its answers — `catalogServedGroupBoundRows`.)
  if (groups?.served && sourceRows) {
    const top = catalogServedGroupBoundRows(sourceRows, groups, (items) =>
      items.map((item, index): CatalogBoundRow => {
        const row = toItemProjectionRow(item, index, roles);
        let key = String(row.itemKey);
        if (seen.has(key)) key = `${key}~${row.rowIndex}`;
        seen.add(key);
        return { key, values: buildCollectionRowTemplateItem(row) };
      }),
    );
    const cut = top.slice(0, Math.max(0, limit));
    const out =
      start > 0
        ? Object.assign(cut.slice(start), { total: top.length })
        : top.length > cut.length
          ? Object.assign(cut, { total: top.length })
          : cut;
    if (totals) Object.assign(out, { totals });
    return out;
  }
  if (groups && sourceRows) {
    const kept =
      order ?? Array.from({ length: sourceRows.length }, (_, index) => index);
    // (Each row's key by the source order — a duplicate key's mark is the same under every sort.
    //  The kept rows marked by their source place, then read in that order — no sort.)
    const byIndex = new Array<CatalogBoundRow | undefined>(sourceRows.length);
    const isKept = new Uint8Array(sourceRows.length);
    for (let at = 0; at < kept.length; at += 1) isKept[kept[at]!] = 1;
    for (let index = 0; index < sourceRows.length; index += 1) {
      if (!isKept[index]) continue;
      const row = toItemProjectionRow(sourceRows[index], index, roles);
      let key = String(row.itemKey);
      if (seen.has(key)) key = `${key}~${row.rowIndex}`;
      seen.add(key);
      // (ADR-315 Phase 5 증분 5d — under a grouping the rows' own child rows are not shown: a
      //  group's rows are its leaves, breakdown §5.4.)
      byIndex[index] = {
        key,
        values: buildCollectionRowTemplateItem(row),
      };
    }
    const top = catalogGroupBoundRows(
      Array.from(kept, (index) => byIndex[index]!),
      groups,
    );
    const cut = top.slice(0, Math.max(0, limit));
    const out =
      start > 0
        ? Object.assign(cut.slice(start), { total: top.length })
        : top.length > cut.length
          ? Object.assign(cut, { total: top.length })
          : cut;
    if (totals) Object.assign(out, { totals });
    return sort && sortOrder ? Object.assign(out, { sorted: sort }) : out;
  }
  // (ADR-315 Phase 5 증분 5f — the pinned rows out of the others: the rest is cut — a page · the
  //  window · 「더 보기」 count it — and the pinned rows stand before · after it.)
  // (ADR-315 Phase 5 증분 5g — a server's pinned rows: out of its answer to their request; the
  //  rows are its page, which left them out.)
  const pinSource = pins?.rows ?? sourceRows;
  const pinned =
    pins && pinSource
      ? catalogPinnedRowOrder(
          pinSource,
          pins.rows ? undefined : order,
          pins,
          roles,
        )
      : undefined;
  const rest = pinned && !pins?.rows ? pinned.rest : order;
  const taken = rest ? Math.min(Math.max(0, limit), rest.length) : 0;
  const projected =
    sourceRows && rest
      ? Array.from({ length: taken }, (_, place) =>
          toItemProjectionRow(sourceRows[rest[place]!], rest[place]!, roles),
        )
      : getFlatProjectionRows(
          { dataBinding, collections },
          parentKey || ref.key !== undefined ? Number.MAX_SAFE_INTEGER : limit,
        );
  const boundRow = (
    row: (typeof projected)[number],
    children?: CatalogBoundRow[],
  ): CatalogBoundRow => {
    let key = String(row.itemKey);
    if (seen.has(key)) key = `${key}~${row.rowIndex}`;
    seen.add(key);
    return {
      key,
      values: buildCollectionRowTemplateItem(row),
      ...(children ? { children } : {}),
    };
  };
  // (The pinned rows take their keys first — a duplicate key's mark goes to another row.)
  const pinnedOf = (indices: readonly number[], side: "top" | "bottom") =>
    indices.map((index): CatalogBoundRow => ({
      ...boundRow(toItemProjectionRow(pinSource![index], index, roles)),
      pinned: side,
    }));
  const top = pinned ? pinnedOf(pinned.top, "top") : [];
  const bottom = pinned ? pinnedOf(pinned.bottom, "bottom") : [];
  const flatRoots = parentKey
    ? parentRowsToTree(projected, parentKey)
    : undefined;
  const rows: CatalogBoundRow[] = flatRoots
    ? flatRoots
        .slice(0, ref.key === undefined ? limit : undefined)
        .map(function visit(node): CatalogBoundRow {
          const row = boundRow(node.row);
          const children = node.children.map(visit);
          return children.length ? { ...row, children } : row;
        })
    : sourceRows && rest && taken === rest.length
      ? // (Every row is shown: a duplicate key's index mark goes by the source order — the same
        //  row keeps the same key under every sort.)
        //  The rows placed by their source place, then bound in that order — no sort.
        (() => {
          const at = new Array<(typeof projected)[number] | undefined>(
            sourceRows.length,
          );
          for (const row of projected) at[row.rowIndex] = row;
          const bound = new Array<CatalogBoundRow>(sourceRows.length);
          for (let index = 0; index < at.length; index += 1) {
            const row = at[index];
            if (row) bound[index] = boundRow(row, childRows(row.item));
          }
          return projected.map((row) => bound[row.rowIndex]!);
        })()
      : projected.map((row) => boundRow(row, childRows(row.item)));
  /** (The rows a sort ordered say so — their reader does not sort them again. A totals row's.) */
  const marked = (out: CatalogBoundRows): CatalogBoundRows => {
    if (totals) Object.assign(out, { totals });
    // (ADR-315 Phase 5 증분 5d — a Table reads them again as a tree: `CatalogRowSlices.tree`.)
    if (childrenKey || parentKey) Object.assign(out, { nested: true });
    if (sort && sortOrder) Object.assign(out, { sorted: sort });
    // (ADR-315 Phase 5 증분 5g — a server's answer with more rows than the keys pinned is not
    //  their request's: said, never passed quietly — §4.3.3.)
    if (
      pins?.rows &&
      pins.rows.length > new Set([...pins.top, ...pins.bottom]).size
    )
      Object.assign(out, { pinMismatch: true });
    // (ADR-315 Phase 5 증분 5f — the pinned rows around the rows cut; the counts are the rest's.)
    return top.length || bottom.length
      ? Object.assign([...top, ...out, ...bottom], catalogRowListMeta(out))
      : out;
  };
  if (ref.key !== undefined) {
    const item = rows.find((row) => row.key === ref.key);
    return [item ?? { key: ref.key, values: {} }];
  }
  // At the window limit the collection may hold more: its count is the sample's "+N more".
  const all = () =>
    rows.length < limit
      ? rows.length
      : (flatRoots?.length ??
        rest?.length ??
        readDataBindingRows(dataBinding, collections).length);
  // (A page: its rows, with the collection's count — the Pagination's page count.)
  if (start > 0)
    return marked(Object.assign(rows.slice(start), { total: all() }));
  if (rows.length < limit) return marked(rows);
  const total = all();
  return marked(total > rows.length ? Object.assign(rows, { total }) : rows);
}

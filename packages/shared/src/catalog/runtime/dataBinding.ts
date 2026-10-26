import {
  buildCollectionRowTemplateItem,
  COLLECTION_ROW_PROJECTION_WINDOW_LIMIT,
  getFlatProjectionRows,
  parentRowsToTree,
  readDataBindingRows,
  resolveBoundCollection,
  resolveFieldRoles,
  toItemProjectionRow,
  type CollectionDataSource,
  type DataBindingValue,
} from "@composition/shared";
import type {
  CatalogBoundRow,
  CatalogBoundRows,
  CatalogRowBinding,
  CatalogViewResultMeta,
} from "../resolution/resolver";
import { runViewQueries, type ViewRunResult } from "../../collections/view/evaluate";
import { catalogRowQueryResolve, type CatalogRowQuery } from "./viewQuery";
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
): CatalogBoundRows | undefined {
  const dataBinding = catalogBindingValue(ref);
  const table = dataBinding && resolveBoundCollection(dataBinding, sources);
  if (!dataBinding || !table) return undefined;
  // ADR-284 Decision 3 · 6 — the view runs on the collection's whole rows, before the display
  // window below: its result stands in for the collection's rows (every reader after this point —
  // items · records · trees · the "+N more" total — reads the view's rows).
  let view: CatalogViewResultMeta | undefined;
  let collections = sources;
  if (ref.query) {
    const rows = readDataBindingRows(dataBinding, sources);
    const result = runBindingView(rows, table, ref.query);
    view = {
      matched: result.rows.length,
      loaded: rows.length,
      ...(table.useMockData === true ? { complete: true } : {}),
      broken: result.broken,
      applied: result.applied,
    };
    collections = sources.map((source) =>
      source === table
        ? {
            ...source,
            useMockData: true,
            mockData: result.rows as never,
            status: "success",
          }
        : source,
    );
  }
  const shown = boundRowsOf(ref, dataBinding, collections, kind, limit);
  return shown && view ? Object.assign(shown, { view }) : shown;
}

/**
 * The last run per source rows and query (ADR-284 R4 — the memo key is the view definition, the
 * values it read and the source rows; a variable write or a row change is another key).
 */
const viewRuns = new WeakMap<object, Map<string, ViewRunResult>>();
function runBindingView(
  rows: readonly unknown[],
  table: CollectionDataSource,
  query: CatalogRowQuery,
): ViewRunResult {
  const signature = JSON.stringify([query.queries, query.values]);
  let runs = viewRuns.get(rows);
  if (!runs) viewRuns.set(rows, (runs = new Map()));
  const cached = runs.get(signature);
  if (cached) return cached;
  const result = runViewQueries(rows, {
    queries: query.queries,
    schema: (table.schema ?? []).flatMap((field) =>
      field.id && field.key
        ? [{ id: field.id, key: field.key, type: field.type }]
        : [],
    ),
    resolve: catalogRowQueryResolve(query),
  });
  // (A few views per rows: the oldest goes first.)
  if (runs.size >= 16) runs.delete(runs.keys().next().value!);
  runs.set(signature, result);
  return result;
}

function boundRowsOf(
  ref: DataBindingRef,
  dataBinding: DataBindingValue,
  collections: readonly CollectionDataSource[],
  kind: "items" | "records",
  limit: number,
): CatalogBoundRows | undefined {
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
  const roles = resolveFieldRoles(
    dataBinding,
    resolveBoundCollection(dataBinding, collections)?.schema,
  );
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
  const projected = getFlatProjectionRows(
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
    : projected.map((row) => boundRow(row, childRows(row.item)));
  if (ref.key !== undefined) {
    const item = rows.find((row) => row.key === ref.key);
    return [item ?? { key: ref.key, values: {} }];
  }
  // At the window limit the collection may hold more: its count is the sample's "+N more".
  if (rows.length < limit) return rows;
  const total =
    flatRoots?.length ?? readDataBindingRows(dataBinding, collections).length;
  return total > rows.length ? Object.assign(rows, { total }) : rows;
}

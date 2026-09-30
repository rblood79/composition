import {
  buildCollectionRowTemplateItem,
  COLLECTION_ROW_PROJECTION_WINDOW_LIMIT,
  getFlatProjectionRows,
  resolveBoundCollection,
  type CollectionDataSource,
  type DataBindingValue,
} from "@composition/shared";
import type { CatalogBoundRow } from "../../../../../packages/shared/src/catalog/resolution/resolver";
import { setWholeField } from "../../../../../packages/shared/src/catalog/commands";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import type {
  CatalogReader,
  DataBindingRef,
  DataCollectionId,
  DataFieldId,
  EditTarget,
  NodeId,
} from "../../../../../packages/shared/src/catalog/document/types";

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
  return { collectionId: catalogCollectionId(value.collectionId), fieldMap };
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

/** Set (or with `undefined` clear) the targets' binding — one step. */
export const catalogBindingCommand = (
  targets: readonly EditTarget[],
  binding: DataBindingRef | undefined,
): CatalogCommand =>
  setWholeField({
    targets,
    field: "binding",
    value: binding,
    label: binding ? "Bind data" : "Unbind data",
  });

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
 */
export function catalogBoundRows(
  ref: DataBindingRef,
  collections: readonly CollectionDataSource[],
  limit = COLLECTION_ROW_PROJECTION_WINDOW_LIMIT,
): CatalogBoundRow[] | undefined {
  const dataBinding = catalogBindingValue(ref);
  if (!dataBinding || !resolveBoundCollection(dataBinding, collections))
    return undefined;
  const seen = new Set<string>();
  return getFlatProjectionRows({ dataBinding, collections }, limit).map(
    (row) => {
      let key = String(row.itemKey);
      if (seen.has(key)) key = `${key}~${row.rowIndex}`;
      seen.add(key);
      return { key, values: buildCollectionRowTemplateItem(row) };
    },
  );
}

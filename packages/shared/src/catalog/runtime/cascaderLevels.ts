import { endpointReadsTemplate } from "../../collections/executeCollectionEndpoint";
import type { CollectionDataSource } from "../../collections/resolveCollectionItems";
import type { ApiEndpointDefinition } from "../../types/collection.types";
import { cascaderValueMatch, type CascaderTable } from "./cascader";

/**
 * ADR-322 Phase 6 (사용자 결정 4 · breakdown §4.3) — a Cascader whose levels load one by one: its
 * collection's query endpoint reads `{{ parentKey }}` and declares keys unique across the hierarchy
 * (`responseMapping.keysUnique`). The session's access (`CatalogPreviewSession.cascaderLevels`): the
 * branches not opened yet, each branch's load, and the keys a later level brought that an earlier one
 * had — the server broke its declaration: both items cannot be picked, a value of that key is cleared.
 */
export type CatalogCascaderLevelState = "loading" | "error" | "loaded";

export interface CatalogCascaderLevels {
  /** The keys of rows that may have items under them, their level not asked yet. */
  readonly branchKeys: ReadonlySet<string>;
  /** A branch's level: asked · failed · here (`undefined` = not asked). */
  readonly stateOf: (
    parentKey: string,
  ) => CatalogCascaderLevelState | undefined;
  /** Ask a branch's level (again after a failure; nothing while it loads or once it is here). */
  readonly load: (parentKey: string) => void;
  /** Keys a later level carried that an earlier one had (the declaration broken). */
  readonly conflicts: ReadonlySet<string>;
  /** A loaded level made part of the running selection ambiguous. */
  readonly correctSelection: typeof correctCascaderSelection;
  /** A level's state changed (`useSyncExternalStore`). */
  readonly subscribe: (listener: () => void) => () => void;
  readonly version: () => number;
}

export function correctCascaderSelection(
  this: Pick<CatalogCascaderLevels, "conflicts">,
  keys: readonly string[],
  table: CascaderTable,
) {
  const kept = keys.filter(
    (key) =>
      !this.conflicts.has(key) &&
      cascaderValueMatch(table, key).kind !== "duplicate",
  );
  if (kept.length === keys.length) return undefined;
  const removed = keys.filter((key) => !kept.includes(key));
  return {
    kept,
    warning: `[Cascader] 서버 계약 위반 — 겹친 선택을 비운다: ${JSON.stringify(removed)}`,
  };
}

/**
 * ADR-326 §4.7 (4) — whether a collection's levels load one by one: its query endpoint (not mock)
 * reads `{{ parentKey }}` and declares keys unique across the hierarchy. The Preview session and
 * the Builder's row read ask the same question.
 */
export function cascaderLoadsLevels(
  collection: Pick<CollectionDataSource, "useMockData"> | undefined,
  endpoint: ApiEndpointDefinition | undefined,
): boolean {
  return (
    !!collection &&
    !collection.useMockData &&
    !!endpoint &&
    endpointReadsTemplate(endpoint, "parentKey") &&
    endpoint.responseMapping?.keysUnique === true
  );
}

/** A collection field named by the binding (`data:field:<schema id>`) as the row's key. */
export function cascaderFieldKey(
  collection: Pick<CollectionDataSource, "schema"> | undefined,
  ref: string | undefined,
): string | undefined {
  if (!ref) return undefined;
  const id = ref.startsWith("data:field:")
    ? ref.slice("data:field:".length)
    : ref;
  return collection?.schema?.find((field) => field.id === id)?.key ?? id;
}

/** A row's key fields after the collection's key field (ADR-325 Decision 7). */
export const ROW_KEY_FIELDS = ["id", "key", "value"] as const;
/**
 * ADR-325 Decision 7 — a row's own key: the collection's key field, else `id` · `key` · `value`
 * (the binding's value field is a component's item key, never the store's).
 */
export function collectionRowKeyOf(
  collection: Pick<CollectionDataSource, "schema" | "keyField"> | undefined,
): (row: Readonly<Record<string, unknown>>) => string | number | undefined {
  const keyField = collection?.keyField
    ? collection.schema?.find((field) => field.id === collection.keyField)?.key
    : undefined;
  const fields = keyField ? [keyField, ...ROW_KEY_FIELDS] : ROW_KEY_FIELDS;
  return (row) => {
    for (const field of fields) {
      const value = row[field];
      if ((typeof value === "string" && value) || typeof value === "number")
        return value;
    }
    return undefined;
  };
}

/**
 * ADR-326 §4.7 (4) — the keys of rows that may have items under them, their level not here yet
 * (`CatalogCascaderLevels.branchKeys`): a row whose level is not loaded, flagged by the binding's
 * 「has children」 field (none = every row may). The session reads it with the levels it loaded;
 * the Builder with none loaded — the state a Preview is in when it first opens.
 */
export function cascaderBranchKeys(
  rows: readonly unknown[],
  dataKey: (
    row: Readonly<Record<string, unknown>>,
  ) => string | number | undefined,
  flagField: string | undefined,
  stateOf: (parentKey: string) => CatalogCascaderLevelState | undefined = () =>
    undefined,
): Set<string> {
  const keys = new Set<string>();
  for (const row of rows as readonly Record<string, unknown>[]) {
    if (row === null || typeof row !== "object") continue;
    const key = dataKey(row);
    if (key === undefined) continue;
    if (stateOf(String(key)) === "loaded") continue;
    if (flagField === undefined || row[flagField] === true)
      keys.add(String(key));
  }
  return keys;
}

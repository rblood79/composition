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

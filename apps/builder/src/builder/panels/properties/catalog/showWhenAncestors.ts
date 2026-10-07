import { catalogStateKeysOf } from "../../../../../../../packages/shared/src/catalog/runtime/presence";
import type { CatalogWorkspace } from "../../../catalogRuntime/workspace";

type Root = CatalogWorkspace["root"];

/** An ancestor that gives state keys: its record, type and — an authored node — its node id. */
export interface StateAncestor {
  readonly recordId: string;
  readonly type: string;
  readonly nodeId?: string;
  readonly keys: readonly string[];
}

/** The selected record's ancestors that give state keys, nearest first. */
export function stateAncestors(root: Root, identity: string): StateAncestor[] {
  const out: StateAncestor[] = [];
  const record = root.canvasInputs.get(identity);
  for (
    let cursor = record && root.canvasInputs.get(record.parentId);
    cursor;
    cursor = root.canvasInputs.get(cursor.parentId)
  ) {
    const type = root.typeOf(cursor);
    const keys = type ? catalogStateKeysOf(type) : [];
    if (!keys.length) continue;
    // An authored node's record is its own id (`…::project:node:X` = X); a template position's is not.
    const own = cursor.id.slice(cursor.id.lastIndexOf("::") + 2);
    out.push({
      recordId: cursor.id,
      type,
      ...(own === cursor.sourceId ? { nodeId: own } : {}),
      keys,
    });
  }
  return out;
}

/**
 * Whether the selected record's section applies: an authored node with a state-giving ancestor, or
 * one that already has a condition. (The panel reads this before mounting — no hook per selection.)
 */
export function catalogShowWhenApplies(root: Root, identity: string): boolean {
  const record = root.canvasInputs.get(identity);
  if (!record) return false;
  return !!record.showWhen || stateAncestors(root, identity).length > 0;
}


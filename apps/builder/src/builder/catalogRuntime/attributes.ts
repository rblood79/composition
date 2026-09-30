import { setHtmlId } from "../../../../../packages/shared/src/catalog/commands";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import type { NodeId } from "../../../../../packages/shared/src/catalog/document/types";

/** The graph's author DOM id index (`CatalogGraph.nodesWithHtmlId`). */
export interface CatalogHtmlIdIndex {
  nodesWithHtmlId(htmlId: string): ReadonlySet<string>;
}

/** Whether another node already uses an author DOM id. */
export function catalogHtmlIdTaken(
  index: CatalogHtmlIdIndex,
  htmlId: string,
  self: NodeId,
): boolean {
  return [...index.nodesWithHtmlId(htmlId)].some((id) => id !== self);
}

/**
 * The first free `base_N` author DOM id (the old ID check's rule: an empty id gets `type_N`, a
 * duplicate moves to the next free number of its base).
 */
export function catalogUniqueHtmlId(
  index: CatalogHtmlIdIndex,
  base: string,
  self: NodeId,
): string {
  const stem = base.replace(/_\d+$/, "");
  for (let n = 1; ; n++) {
    const candidate = `${stem}_${n}`;
    if (!catalogHtmlIdTaken(index, candidate, self)) return candidate;
  }
}

/**
 * ADR-248 Phase 4e-4: an author DOM id edit as one command, or the reason it is refused (another
 * node uses it — ids stay unique so interactions can target them). An empty id removes it.
 */
export function catalogHtmlIdCommand(
  index: CatalogHtmlIdIndex,
  node: NodeId,
  htmlId: string,
): { command: CatalogCommand } | { refused: "HTML_ID_TAKEN" } {
  const value = htmlId.trim();
  if (value && catalogHtmlIdTaken(index, value, node))
    return { refused: "HTML_ID_TAKEN" };
  return { command: setHtmlId({ id: node, htmlId: value }) };
}

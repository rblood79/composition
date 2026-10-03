import {
  resolveDelegatedSubpartOwnerType,
  resolveSubpartStyleOwnerType,
} from "../../../../../packages/shared/src/catalog/resolvers/resolveDelegatedChildFontSize";
import { definitionTypeName } from "../../../../../packages/shared/src/catalog/commands/context";
import type {
  CatalogReader,
  DefinitionId,
} from "../../../../../packages/shared/src/catalog/document/types";
import type { CatalogConsumerNode } from "./compositionRoot";

/**
 * ADR-248 Phase 4e: the parent that owns a drawn record as a delegated sub-part (ADR-923 — a
 * field's Label · Input · FieldError, a picker's trigger wrapper …): the same shared predicate the
 * old panels read through the old store, over the catalog records (the record's, its parent's and
 * its grandparent's type). `all` = every axis (Properties), `style` = the style axis (Styles —
 * includes the style-only sub-parts such as SelectValue). `null` = not a sub-part.
 */
export function catalogSubpartOwnerType(
  graph: CatalogReader,
  records: ReadonlyMap<string, CatalogConsumerNode>,
  identity: string | null | undefined,
  axis: "all" | "style",
): string | null {
  const record = identity ? records.get(identity) : undefined;
  if (!record) return null;
  const typeOf = (node: CatalogConsumerNode | undefined) => {
    if (!node) return null;
    try {
      return definitionTypeName(graph, node.definitionId as DefinitionId);
    } catch {
      return null;
    }
  };
  const parent = records.get(record.parentId);
  const grandparent = parent ? records.get(parent.parentId) : undefined;
  const types = [typeOf(record), typeOf(parent), typeOf(grandparent)] as const;
  return axis === "style"
    ? resolveSubpartStyleOwnerType(...types)
    : resolveDelegatedSubpartOwnerType(...types);
}

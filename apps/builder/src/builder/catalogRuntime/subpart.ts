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
import { catalogTextKey } from "./canvasText";
import { catalogTextBinding } from "./textBinding";

/**
 * ADR-248 Phase 4e: the parent that owns a drawn record as a delegated sub-part (ADR-923 — a
 * field's Label · Input · FieldError, a picker's trigger wrapper …): the same shared predicate the
 * old panels read through the old store, over the catalog records (the record's, its parent's and
 * its grandparent's type). `all` = every axis (Properties), `style` = the style axis (Styles —
 * includes the style-only sub-parts such as SelectValue). `null` = not a sub-part. On the `all`
 * axis a text bound to its instance's prop (`textBinding.ts`) is the instance's too.
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
  if (axis === "style") return resolveSubpartStyleOwnerType(...types);
  const owner = resolveDelegatedSubpartOwnerType(...types);
  if (owner) return owner;
  // A text its template binds to the instance's prop (ADR-254 Decision 5 — a Card's title through
  // its CardHeader, an InlineAlert's description): the instance owns it, wherever it sits.
  const key = catalogTextKey(record);
  const binding = key
    ? catalogTextBinding(graph.library, records, record, key)
    : undefined;
  return binding ? typeOf(binding.source) : null;
}

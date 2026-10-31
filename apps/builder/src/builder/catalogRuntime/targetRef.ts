import type {
  CatalogCapabilityTarget,
  CatalogNodeRef,
  DefinitionId,
  EditTarget,
  InteractionEntry,
  NodeId,
  TemplateId,
} from "../../../../../packages/shared/src/catalog/document/types";
import { catalogActionsDeep } from "../../../../../packages/shared/src/catalog/document/interactionActions";
import { ownedChildren } from "../../../../../packages/shared/src/catalog/document/graph";
import type { CatalogInteractionOwner } from "./interactions";
import type { CatalogVariableReader } from "./stateVariables";

/**
 * ADR-283 — a drawn place (an edit target: a node, or a position inside an instance) as the stored
 * reference a rule of `owner` keeps (Decision 1): a page node → `{ nodeId }`, a position of a page
 * instance → `{ address }`, a place of the origin whose template holds the owner → `{ local }` (a
 * template is drawn once per instance, so a page node rule cannot name it — `undefined`).
 */
export function catalogTargetRefOf(
  graph: CatalogVariableReader,
  owner: CatalogInteractionOwner,
  target: EditTarget,
): CatalogNodeRef | undefined {
  const holder = target.kind === "node" ? target.id : target.ownerId;
  const definitionId = catalogTemplateDefinitionOf(graph, holder);
  if (!definitionId)
    return target.kind === "node"
      ? { nodeId: target.id }
      : { address: target.address };
  if (catalogTemplateDefinitionOf(graph, owner.ownerId) !== definitionId)
    return undefined;
  const path = catalogTemplatePathOf(graph, holder);
  if (!path) return undefined;
  return target.kind === "node"
    ? { local: { instances: [], templatePath: path } }
    : {
        local: {
          instances: target.address.instances,
          templatePath: target.address.templatePath,
        },
      };
}

/** The definition whose template holds the node `id` (its owner chain top), else undefined. */
export function catalogTemplateDefinitionOf(
  graph: CatalogVariableReader,
  id: string,
): DefinitionId | undefined {
  const seen = new Set<string>();
  for (
    let cursor = graph.ownerOf(id);
    cursor && !seen.has(cursor);
    cursor = graph.ownerOf(cursor)
  ) {
    seen.add(cursor);
    const owner = graph.getEntry(cursor as never);
    if (owner?.kind === "definition") return owner.id;
    if (owner?.kind === "definitionOverride") return owner.targetId;
    if (owner?.kind !== "node") return undefined;
  }
  return undefined;
}

/** The root-to-node ids of a template node inside its definition's template. */
export function catalogTemplatePathOf(
  graph: CatalogVariableReader,
  id: string,
): TemplateId[] | undefined {
  const path: TemplateId[] = [id as TemplateId];
  const seen = new Set<string>();
  for (
    let cursor = graph.ownerOf(id);
    cursor && !seen.has(cursor);
    cursor = graph.ownerOf(cursor)
  ) {
    seen.add(cursor);
    const owner = graph.getEntry(cursor as never);
    if (owner?.kind !== "node") return path;
    // (A slot content or replacement is a position of the template it sits in — owned children.)
    if (!ownedChildren(owner).includes(path[0] as NodeId)) return undefined;
    path.unshift(owner.id as TemplateId);
  }
  return path;
}

/** Whether a stored target names nothing (a swap · detach left it, user decision 3). */
export const catalogTargetUnset = (target: CatalogCapabilityTarget) =>
  "unset" in target;

/** The node a stored reference stands on in the document (its last step), for labels. */
export function catalogTargetLeafId(
  target: CatalogCapabilityTarget,
): string | undefined {
  if ("nodeId" in target) return target.nodeId;
  if ("address" in target) return target.address.templatePath.at(-1);
  if ("local" in target) return target.local.templatePath.at(-1);
  return undefined;
}

/** Two stored references name the same place. */
export const sameCatalogTarget = (
  left: CatalogCapabilityTarget,
  right: CatalogCapabilityTarget,
) => JSON.stringify(left) === JSON.stringify(right);

/**
 * ADR-283 Decision 4 · 5 — the last capability fallback a Canvas pick made (the rule row shows the
 * same line the picker's change shows): a rule id and the capability ids.
 */
let pickFallback: { ruleId: string; from: string; to: string } | undefined;
const pickFallbackListeners = new Set<() => void>();
export const catalogTargetPickFallback = {
  get: () => pickFallback,
  set(next: typeof pickFallback) {
    pickFallback = next;
    for (const listener of [...pickFallbackListeners]) listener();
  },
  subscribe(listener: () => void) {
    pickFallbackListeners.add(listener);
    return () => pickFallbackListeners.delete(listener);
  },
};

/**
 * ADR-283 R7 — the rules whose capability target names nothing (`unset` — a swap · detach left
 * them): Publish reports the count (not blocking) so they are not shipped unnoticed.
 */
export function catalogUnsetTargetRuleCount(document: {
  entries: Readonly<Record<string, unknown>>;
}): number {
  let count = 0;
  for (const entry of Object.values(document.entries) as InteractionEntry[])
    if (
      entry?.kind === "interaction" &&
      catalogActionsDeep(entry.actions).some(
        (action) => action.opcode === "capability" && "unset" in action.target,
      )
    )
      count++;
  return count;
}

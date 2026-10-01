import { definitionTypeName } from "../../../../../packages/shared/src/catalog/commands/context";
import type {
  CatalogReader,
  DefinitionId,
  NodeId,
} from "../../../../../packages/shared/src/catalog/document/types";
import {
  requestEditingSemanticsDetachConfirmation,
  requestEditingSemanticsImpactConfirmation,
  type EditingSemanticsDetachConfirmationRequest,
  type EditingSemanticsImpactConfirmationRequest,
} from "../utils/editingSemanticsImpactConfirmation";
import type { CatalogWorkspace } from "./workspace";

/**
 * ADR-248 4e: the old Builder's component confirmations over the catalog document, through the
 * same dialog (`EditingSemanticsImpactDialogHost`) — detaching an instance and dissolving a
 * component with instances ask first; the first edit of a component's template in its edit view
 * asks once per component and instance set (Cancel takes the edit back).
 */
export interface CatalogComponentConfirm {
  detach(
    request: Omit<EditingSemanticsDetachConfirmationRequest, "kind">,
  ): Promise<boolean>;
  impact(request: EditingSemanticsImpactConfirmationRequest): Promise<boolean>;
}

export const CATALOG_COMPONENT_CONFIRM: CatalogComponentConfirm = {
  detach: requestEditingSemanticsDetachConfirmation,
  impact: requestEditingSemanticsImpactConfirmation,
};

function definitionName(graph: CatalogReader, definitionId: string): string {
  const definition = graph.getEntry(definitionId);
  return definition?.kind === "definition"
    ? definition.name
    : definitionTypeName(graph, definitionId as DefinitionId);
}

/** Detach an instance after the user confirms (the old "Detach instance" dialog). */
export async function confirmCatalogDetach(
  graph: CatalogReader,
  id: NodeId,
  run: () => void,
  confirm: CatalogComponentConfirm = CATALOG_COMPONENT_CONFIRM,
): Promise<boolean> {
  const node = graph.getEntry(id);
  if (node?.kind !== "node") return false;
  const originLabel = definitionName(graph, node.definitionId);
  const confirmed = await confirm.detach({
    instanceId: id,
    instanceLabel: node.name || originLabel,
    originId: node.definitionId,
    originLabel,
  });
  if (confirmed) run();
  return confirmed;
}

function impactRequest(
  graph: CatalogReader,
  definitionId: string,
): EditingSemanticsImpactConfirmationRequest | undefined {
  const startedAt = performance.now();
  const instances = [...graph.instancesOf(definitionId)];
  if (instances.length === 0) return undefined;
  return {
    countDurationMs: performance.now() - startedAt,
    impactedInstanceIds: instances,
    instanceCount: instances.length,
    originId: definitionId,
    originLabel: definitionName(graph, definitionId),
  };
}

/** Dissolve a component; with instances the user confirms first (the old origin toggle). */
export async function confirmCatalogDissolve(
  graph: CatalogReader,
  definitionId: string,
  run: () => void,
  confirm: CatalogComponentConfirm = CATALOG_COMPONENT_CONFIRM,
): Promise<boolean> {
  const request = impactRequest(graph, definitionId);
  const confirmed = request ? await confirm.impact(request) : true;
  if (confirmed) run();
  return confirmed;
}

/** The step changed a node under `definitionId`'s template (its owner chain reaches it). */
function touchesTemplate(
  graph: CatalogReader,
  changedIds: ReadonlySet<string>,
  definitionId: string,
): boolean {
  for (const id of changedIds) {
    let owner = graph.ownerOf(id);
    for (let depth = 0; owner && depth < 64; depth += 1) {
      if (owner === definitionId) return true;
      owner = graph.ownerOf(owner);
    }
  }
  return false;
}

/**
 * Watch user actions in a component's edit view: the first one that changes its template while
 * it has instances asks "Editing … will affect N instances" — Continue keeps it (and later edits
 * of the same component and instances ask no more), Cancel undoes the steps since it. A layout's
 * view does not ask (the old gate was the component origin's). Returns the unsubscribe.
 */
export function watchCatalogComponentEdits(
  workspace: CatalogWorkspace,
  confirm: CatalogComponentConfirm = CATALOG_COMPONENT_CONFIRM,
): () => void {
  const confirmed = new Set<string>();
  let pending = false;
  return workspace.subscribeExecute((result) => {
    // Steps while the dialog is open share its answer.
    if (pending) return;
    const view = workspace.session.getSnapshot().definitionView;
    if (!view) return;
    const graph = workspace.runtime.graph;
    const definition = graph.getEntry(view);
    if (definition?.kind !== "definition" || definition.usage === "layout")
      return;
    if (!touchesTemplate(graph, result.changedIds, view)) return;
    const request = impactRequest(graph, view);
    if (!request) return;
    const key = JSON.stringify([view, request.impactedInstanceIds]);
    if (confirmed.has(key)) return;
    const depth = workspace.runtime.historyDepth.undo - 1;
    pending = true;
    void confirm.impact(request).then((ok) => {
      pending = false;
      if (ok) {
        confirmed.add(key);
        return;
      }
      while (workspace.runtime.historyDepth.undo > depth)
        if (!workspace.undo()) break;
    });
  });
}


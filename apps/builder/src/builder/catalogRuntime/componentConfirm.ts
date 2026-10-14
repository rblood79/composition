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
import {
  catalogDefinitionTitle,
  isComponentsView,
  isProjectComponentsView,
  isLibraryOrigin,
} from "./originView";
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
    : isLibraryOrigin(definitionId)
      ? catalogDefinitionTitle(graph, definitionId)
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

/**
 * The component edits a graph's user already confirmed (`[definitionId, instanceIds]`): the
 * origin-edit watcher asks once per key, and a push confirmed up front (ADR-262) registers its key
 * so the step it then runs is not asked about again.
 */
const confirmedEdits = new WeakMap<object, Set<string>>();
function confirmedKeys(graph: CatalogReader): Set<string> {
  let keys = confirmedEdits.get(graph);
  if (!keys) {
    keys = new Set();
    confirmedEdits.set(graph, keys);
  }
  return keys;
}
const impactKey = (graph: CatalogReader, definitionId: string) =>
  JSON.stringify([definitionId, [...graph.instancesOf(definitionId)]]);

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

/**
 * ADR-262 (user decision 4): push an instance's overrides after the user confirms when other
 * instances take them — the origin edit's 「will affect N instances」 dialog, counting the others;
 * with no other instance the step runs at once.
 */
export async function confirmCatalogPush(
  graph: CatalogReader,
  instanceId: NodeId,
  run: () => void,
  confirm: CatalogComponentConfirm = CATALOG_COMPONENT_CONFIRM,
): Promise<boolean> {
  const node = graph.getEntry(instanceId);
  if (node?.kind !== "node") return false;
  const startedAt = performance.now();
  const others = [...graph.instancesOf(node.definitionId)].filter(
    (id) => id !== instanceId,
  );
  const confirmed = others.length
    ? await confirm.impact({
        countDurationMs: performance.now() - startedAt,
        impactedInstanceIds: others,
        instanceCount: others.length,
        originId: node.definitionId,
        originLabel: definitionName(graph, node.definitionId),
      })
    : true;
  if (!confirmed) return false;
  // (The push edits the origin: the watcher below would ask again — this answer covers it.)
  confirmedKeys(graph).add(impactKey(graph, node.definitionId));
  run();
  return true;
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
 * ADR-260: the component whose origin a step edited — a changed node is the origin (in place, or
 * deleted and kept by its definition) or lies under it (the nearest origin on its owner chain).
 */
function editedOrigin(
  graph: CatalogReader,
  changedIds: ReadonlySet<string>,
): string | undefined {
  for (const id of changedIds)
    for (
      let at: string | undefined = id, depth = 0;
      at && depth < 64;
      at = graph.ownerOf(at), depth += 1
    ) {
      const definitionId = graph.definitionOfTemplateRoot(at);
      const definition = definitionId ? graph.getEntry(definitionId) : undefined;
      // (A deleted origin its definition keeps too — the project components page edits it.)
      if (definition?.kind === "definition" && definition.usage !== "layout")
        return definitionId;
    }
  return undefined;
}

/** The built-in origin whose project override a step changed (`undefined` = none). */
function overriddenOrigin(
  graph: CatalogReader,
  changedIds: ReadonlySet<string>,
): string | undefined {
  for (const id of changedIds) {
    const entry = graph.getEntry(id);
    if (entry?.kind === "definitionOverride") return entry.targetId;
  }
  return undefined;
}

/**
 * Watch user actions on a component's origin — in its edit view, or the origin in place on a page
 * (ADR-260) — the first one that changes it while it has instances asks "Editing … will affect N instances" — Continue keeps it (and later edits
 * of the same component and instances ask no more), Cancel undoes the steps since it. A layout's
 * view does not ask (the old gate was the component origin's). Returns the unsubscribe.
 */
export function watchCatalogComponentEdits(
  workspace: CatalogWorkspace,
  confirm: CatalogComponentConfirm = CATALOG_COMPONENT_CONFIRM,
): () => void {
  const confirmed = confirmedKeys(workspace.runtime.graph);
  let pending = false;
  return workspace.subscribeExecute((result) => {
    // Steps while the dialog is open share its answer.
    if (pending) return;
    const view = workspace.session.getSnapshot().definitionView;
    const graph = workspace.runtime.graph;
    // The Components page: a sample's edits are the project's defaults for its origin (its
    // override) — the component edited is that origin.
    let edited: string | undefined;
    if (view && isComponentsView(view) && !isProjectComponentsView(view)) {
      edited = overriddenOrigin(graph, result.changedIds);
      if (!edited) return;
    } else if (view && !isProjectComponentsView(view)) {
      const definition = graph.getEntry(view);
      if (definition?.kind !== "definition" || definition.usage === "layout")
        return;
      if (touchesTemplate(graph, result.changedIds, view)) edited = view;
    }
    // ADR-260 Decision 4: an origin in place (on a page, or inside a viewed template), or one
    // the project components page shows.
    edited ??= editedOrigin(graph, result.changedIds);
    if (!edited) return;
    const request = impactRequest(graph, edited);
    if (!request) return;
    const key = impactKey(graph, edited);
    if (confirmed.has(key)) return;
    const depth = workspace.runtime.historyDepth.undo - 1;
    pending = true;
    void confirm.impact(request).then((ok) => {
      pending = false;
      if (ok) {
        confirmed.add(key);
        return;
      }
      // Progress is the history depth, not undo's result: an outside-only entry (a data edit made
      // while the dialog was open) returns none and stopped the loop above the template edit
      // (2026-10-05 audit L10).
      while (workspace.runtime.historyDepth.undo > depth) {
        const before = workspace.runtime.historyDepth.undo;
        workspace.undo();
        if (workspace.runtime.historyDepth.undo >= before) break;
      }
    });
  });
}

import { useMemo } from "react";

import { catalogTargetDefinitionId } from "../../../catalogRuntime/editContract";

import {
  useCatalogEditContract,
  useCatalogSession,
  useCatalogWorkspace,
} from "../../../catalogRuntime/react";

import { catalogSubpartOwnerType } from "../../../catalogRuntime/subpart";

/**
 * ADR-248 Phase 4e-4: Properties of the open catalog project — the selection's edit contract
 * (catalog accepts / reusable contract, value sources from the read model) in the shared generic
 * field renderer. An edit is one `setFields` over every selected target of the same definition
 * (one history step); a value back to the inherited one removes the own write.
 *
 * ADR-252: the Design panel's Property tab — the panel (header · tabs) is `DesignPanel`; this file
 * gives the selection read (`useCatalogPropertiesSelection`), the tab body and the header actions.
 */
export function useCatalogPropertiesSelection() {
  const workspace = useCatalogWorkspace();
  const selection = useCatalogSession((state) => state.selection);
  const first = selection[0];
  const contract = useCatalogEditContract(first?.target);
  const graph = workspace.runtime.graph;
  // Every selected target showing the same definition takes the edit (a mixed selection edits the
  // first target only).
  const targets = useMemo(() => {
    if (!first) return [];
    try {
      const definition = catalogTargetDefinitionId(graph, first.target);
      return selection
        .filter((item) => {
          try {
            return catalogTargetDefinitionId(graph, item.target) === definition;
          } catch {
            return false;
          }
        })
        .map((item) => item.target);
    } catch {
      return [];
    }
  }, [first, graph, selection]);
  const title = useMemo(() => {
    if (!first) return undefined;
    const entry =
      first.target.kind === "node"
        ? graph.getEntry(first.target.id)
        : undefined;
    return (entry?.kind === "node" && entry.name) || contract.type;
  }, [contract.type, first, graph]);
  // A delegated sub-part (a field's Label · Input · FieldError …): its parent composes it, so its
  // own fields reach nothing — the owner notice instead (ADR-923, the old panel's).
  // (One root read for the panel's parts — the RAC slot section takes it, ADR-246 count.)
  const root = first && contract.type ? workspace.root : undefined;
  const subpartOwner = root
    ? catalogSubpartOwnerType(graph, root.domInputs, first.identity, "all")
    : undefined;
  return {
    first,
    contract,
    targets,
    title,
    subpartOwner,
    graph,
    workspace,
    root,
  };
}

export type CatalogPropertiesSelection = ReturnType<
  typeof useCatalogPropertiesSelection
>;

export const CALENDAR_TYPES: ReadonlySet<string> = new Set([
  "Calendar",
  "RangeCalendar",
]);

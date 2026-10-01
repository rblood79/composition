import { memo, useCallback, useMemo, useSyncExternalStore } from "react";
import type { NodeId } from "../../../../../../../packages/shared/src/catalog/document/types";
import {
  catalogAppliedPreset,
  catalogLayoutPresetCommand,
  catalogLayoutSlots,
} from "../../../catalogRuntime/layoutPreset";
import {
  useCatalogSession,
  useCatalogWorkspace,
} from "../../../catalogRuntime/react";
import { PropertySection } from "../../../components";
import { useCatalogCommandRunner } from "../../navigator/catalog/useCatalogCommandRunner";
import { LayoutPresetGrid } from "../editors/LayoutPresetSelector";
import { LayoutSlotsList } from "../editors/LayoutPresetSelector/LayoutSlotsSection";
import type { ExistingSlotInfo } from "../editors/LayoutPresetSelector/types";

/** The layout definition whose template root `nodeId` is; else undefined. */
function layoutOfRoot(
  graph: ReturnType<typeof useCatalogWorkspace>["runtime"]["graph"],
  nodeId: NodeId,
): string | undefined {
  const project = graph.getEntry(graph.projectId);
  if (project?.kind !== "project") return undefined;
  return project.definitionIds.find((id) => {
    const definition = graph.getEntry(id);
    return (
      definition?.kind === "definition" &&
      definition.usage === "layout" &&
      definition.templateRootId === nodeId
    );
  });
}

/**
 * ADR-248 Phase 4e-6-37: the old layout body editor over the catalog layout — on the body (the
 * template root) of a layout in the definition edit view, the Layout Preset grid (one step; the
 * existing-slot dialog asks replace or merge) and the Slots list (a row selects the slot).
 */
export const CatalogLayoutBodySection = memo(function CatalogLayoutBodySection({
  nodeId,
}: {
  nodeId: NodeId;
}) {
  const workspace = useCatalogWorkspace();
  const run = useCatalogCommandRunner();
  const graph = workspace.runtime.graph;
  const breakpoint = useCatalogSession((state) => state.breakpoint);
  const subscribe = useCallback(
    (notify: () => void) => workspace.runtime.subscribeSteps(() => notify()),
    [workspace],
  );
  // Re-read on each step: the slot list as a key (name · node · child count).
  const key = useSyncExternalStore(subscribe, () =>
    layoutOfRoot(graph, nodeId)
      ? catalogLayoutSlots(graph, nodeId)
          .map((slot) => `${slot.nodeId}:${slot.slotName}:${slot.childCount}`)
          .join("|")
      : null,
  );
  const slots = useMemo(
    () => (key === null ? [] : catalogLayoutSlots(graph, nodeId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the key changes with the slots
    [key, graph, nodeId],
  );
  const existing = useMemo<ExistingSlotInfo[]>(
    () =>
      slots.map((slot) => ({
        slotName: slot.slotName,
        elementId: slot.nodeId,
        hasChildren: slot.childCount > 0,
        childCount: slot.childCount,
      })),
    [slots],
  );
  const apply = useCallback(
    (presetKey: string, mode: "replace" | "merge" | "cancel") => {
      if (mode === "cancel") return;
      const command = catalogLayoutPresetCommand(graph, {
        rootId: nodeId,
        presetKey,
        mode,
        newId: workspace.newId,
      });
      if (command) run(command);
    },
    [graph, nodeId, run, workspace],
  );
  const select = useCallback(
    (slotNodeId: string) => {
      const record = workspace.root.recordsOfSource(slotNodeId)[0];
      if (record) workspace.selectRecords([record]);
    },
    [workspace],
  );
  if (key === null) return null;
  return (
    <>
      <PropertySection title="Layout Preset">
        <LayoutPresetGrid
          breakpoint={breakpoint}
          existingSlots={existing}
          currentPresetKey={catalogAppliedPreset(slots)}
          applyPreset={apply}
          isApplying={false}
        />
      </PropertySection>
      <LayoutSlotsList slots={existing} onSelect={select} />
    </>
  );
});

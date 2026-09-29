import type { CanvasSceneNode } from "../workspace/canvas/scene/canvasSceneNode";
import type { BoundingBox } from "../workspace/canvas/selection/types";
import {
  buildSlotMarkerTargets,
  type SlotMarkerTarget,
} from "../workspace/canvas/skia/skiaOverlayHelpers";
import type { EditingSemanticsRole } from "../utils/editingSemantics";
import { CatalogCompositionRoot } from "./compositionRoot";

export interface CatalogSlotOverlayContext {
  editMode: boolean;
  pageId: string;
  roles: ReadonlyMap<string, EditingSemanticsRole>;
  /** Already clipped to ancestors and page occlusion at this paint boundary. */
  visibleBounds?: ReadonlyMap<string, BoundingBox>;
}

export interface CatalogSlotOverlayTarget extends SlotMarkerTarget {
  id: string;
}

/** Ephemeral scene inputs for the existing editor overlay; no catalog entry is written. */
export function deriveCatalogSlotOverlayTargets(
  root: CatalogCompositionRoot,
  context: CatalogSlotOverlayContext,
): CatalogSlotOverlayTarget[] {
  if (!context.editMode) return [];
  const geometry = root.getGeometry(root.canvasInputs.keys());
  const nodes = new Map<string, CanvasSceneNode>();
  const children = new Map<string, CanvasSceneNode[]>();
  const slotBounds = new Map<string, BoundingBox>();
  for (const node of root.canvasInputs.values()) {
    const role = context.roles.get(node.id);
    const scene = {
      id: node.id,
      // The helper's spec fallback has no catalog-slot entry. Padding comes
      // only from the resolved graph, not from the old Slot spec.
      type: node.bindingId === "slot" ? "catalog-slot" : "catalog-node",
      slot: node.bindingId === "slot" ? [] : undefined,
      // Editing role in the canonical fields the helper reads (`reusable` origin · `ref` instance).
      ...(role === "origin" ? { reusable: true } : {}),
      ...(role === "instance" ? { ref: node.definitionId } : {}),
      props: { style: { padding: node.visual.padding ?? 0 } },
      parentId: node.parentId || null,
      pageId: context.pageId,
      layoutId: node.id,
      parent_id: node.parentId || undefined,
      page_id: context.pageId,
      // This helper reads the listed fields only; no canonical source is made.
    } as unknown as CanvasSceneNode;
    nodes.set(node.id, scene);
    if (node.bindingId === "slot") {
      const rect = geometry.get(node.id);
      if (!rect) throw new Error(`CATALOG_SLOT_LAYOUT_REQUIRED:${node.id}`);
      slotBounds.set(node.id, rect);
    }
  }
  for (const node of root.canvasInputs.values())
    children.set(
      node.id,
      node.children.map((id) => {
        const child = nodes.get(id);
        if (!child) throw new Error(`CATALOG_SLOT_CHILD_REQUIRED:${id}`);
        return child;
      }),
    );
  const visible = new Map(context.visibleBounds ?? slotBounds);
  const result: CatalogSlotOverlayTarget[] = [];
  for (const [id, bounds] of slotBounds) {
    const target = buildSlotMarkerTargets(
      new Map([[id, bounds]]),
      nodes,
      children,
      visible,
    )[0];
    if (target) result.push({ id, ...target });
  }
  return result;
}

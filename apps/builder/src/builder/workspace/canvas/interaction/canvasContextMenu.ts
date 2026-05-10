import { canDetachInstance } from "../../../utils/editingSemantics";
import { resolveTopmostHitElementId } from "./selectionModel";
import type { CanvasInteractionNode } from "./interactionNode";

export function resolveCanvasDetachContextTarget(
  hitCandidates: string[],
  hitElementsMap: ReadonlyMap<string, CanvasInteractionNode>,
  hitChildrenMap?: ReadonlyMap<string, readonly CanvasInteractionNode[]> | null,
): string | null {
  const hitElementId = resolveTopmostHitElementId(
    hitCandidates,
    hitElementsMap,
    hitChildrenMap,
  );
  if (!hitElementId) return null;

  const element = hitElementsMap.get(hitElementId);
  return canDetachInstance(element) ? hitElementId : null;
}

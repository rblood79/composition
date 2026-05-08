import type { Element } from "../../../../types/core/store.types";
import { canDetachInstance } from "../../../utils/editingSemantics";
import { resolveTopmostHitElementId } from "./selectionModel";

export function resolveCanvasDetachContextTarget(
  hitCandidates: string[],
  hitElementsMap: Map<string, Element>,
  hitChildrenMap?: Map<string, Element[]> | null,
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

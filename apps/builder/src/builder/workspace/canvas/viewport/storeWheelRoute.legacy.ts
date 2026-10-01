import { useStore } from "../../../stores";
import { getCanonicalNode } from "../../../stores/canonical/canonicalElementsBridge";
import { isScrollable, useScrollState } from "../../../stores/scrollState";
import { resolveEffectiveOverflow } from "../layout/engines/implicitStyles";

/**
 * ADR-248 4e-7: the old element store's wheel routing — one selected scrollable element takes a
 * plain wheel (moved out of `useViewportControl`; the catalog Canvas passes its own route). Goes
 * with the old store.
 */
export function routeWheelToStoreSelection(
  deltaX: number,
  deltaY: number,
): boolean {
  const selectedIds = useStore.getState().selectedElementIds;
  if (selectedIds.length !== 1) return false;
  const selectedId = selectedIds[0];
  const node = getCanonicalNode(selectedId);
  const overflow = resolveEffectiveOverflow(
    node?.type,
    node?.props?.style as Record<string, unknown> | undefined,
  );
  if (
    (overflow !== "scroll" && overflow !== "auto") ||
    !isScrollable(selectedId)
  )
    return false;
  useScrollState.getState().scrollBy(selectedId, deltaX, deltaY);
  return true;
}

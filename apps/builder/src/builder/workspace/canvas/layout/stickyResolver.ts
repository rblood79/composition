/**
 * Position sticky offset (ADR-267).
 *
 * The engine lays a sticky box out in flow and gives its constraints (`StickyConstraints` —
 * Blink `ComputeStickyPositionConstraints`); this is Blink's `ComputeStickyOffset`: at the scroll
 * container's scroll position, how far the box moves from its static position so that it stays
 * inside the scrollport by its insets without leaving its containing block. The right / bottom
 * pull comes first and the left / top one is added to it (Blink's order — left and top win).
 * An `auto` inset (null) does not pull: a box whose insets are all auto does not move.
 */

import type { StickyConstraints } from "../../../../../../../packages/shared/src/catalog/runtime/engineTypes";

export interface StickyScroll {
  scrollTop: number;
  scrollLeft: number;
}

export function resolveStickyOffset(
  constraints: StickyConstraints<unknown>,
  scroll: StickyScroll = { scrollTop: 0, scrollLeft: 0 },
): { dx: number; dy: number } {
  const view = constraints.constrainingRect;
  const box = constraints.stickyRect;
  const block = constraints.containingBlockRect;
  const viewX = view.x + scroll.scrollLeft;
  const viewY = view.y + scroll.scrollTop;
  let dx = 0;
  let dy = 0;
  if (constraints.right !== null) {
    const limit = viewX + view.width - constraints.right;
    dx += Math.max(
      Math.min(0, limit - (box.x + box.width)),
      Math.min(0, block.x - box.x),
    );
  }
  if (constraints.left !== null) {
    const limit = viewX + constraints.left;
    dx += Math.min(
      Math.max(0, limit - box.x),
      Math.max(0, block.x + block.width - (box.x + box.width)),
    );
  }
  if (constraints.bottom !== null) {
    const limit = viewY + view.height - constraints.bottom;
    dy += Math.max(
      Math.min(0, limit - (box.y + box.height)),
      Math.min(0, block.y - box.y),
    );
  }
  if (constraints.top !== null) {
    const limit = viewY + constraints.top;
    dy += Math.min(
      Math.max(0, limit - box.y),
      Math.max(0, block.y + block.height - (box.y + box.height)),
    );
  }
  return { dx, dy };
}

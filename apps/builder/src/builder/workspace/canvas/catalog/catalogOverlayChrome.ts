import type { BoundingBox } from "../selection/types";
import type { EditingSemanticsRole } from "../../../utils/editingSemanticsRole";

export interface CatalogOverlaySlotMark {
  box: BoundingBox;
  empty: boolean;
  role: EditingSemanticsRole;
  identity: string;
}

export interface CatalogOverlayRemainder {
  box: BoundingBox;
  hiddenRows: number;
  ownerId: string;
}

export interface CatalogOverlayChromeBuilders {
  /** Slot chrome of the drawn scene (`catalogSlotMarks`). */
  slots(): readonly CatalogOverlaySlotMark[];
  /** Bound collections' "+N more" areas (`catalogRowRemainders` placed on the scene's boxes). */
  remainders(): readonly CatalogOverlayRemainder[];
  /** Page boxes painted over a record's page (`catalogOccludingPages`). */
  occluders(identity: string): readonly BoundingBox[];
}

export interface CatalogOverlayChromeCache {
  slots(): readonly CatalogOverlaySlotMark[];
  remainders(): readonly CatalogOverlayRemainder[];
  occludersOf(identity: string): readonly BoundingBox[];
}

/**
 * Overlay chrome read from the drawn scene — slot marks, row remainders, page occluders — kept
 * until the scene changes. The builders walk every record (and `graph.getEntry` per record) and
 * read the scene's boxes, which only a scene change moves (a step, a preview, rows, a page grid,
 * another root): `sceneVersion` is the Canvas's scene version (`cellsVersion`), not the overlay's
 * (hover · selection do not move a box). A camera-only frame reads the kept lists.
 *
 * **Why (2026-10-21)**: a 22-page document of 11k records recomputed these on every pan frame —
 * ~1 ms per frame (`catalogSlotMarks` + occluders), 12~18 % of the main thread at 120 Hz and the
 * largest app-side share of a pan (`.agent/runs/2026-10-21-canvas-perf-regression/lever2/`).
 */
export function createOverlayChromeCache(
  sceneVersion: () => number,
  build: CatalogOverlayChromeBuilders,
): CatalogOverlayChromeCache {
  let version = -1;
  let slots: readonly CatalogOverlaySlotMark[] | undefined;
  let remainders: readonly CatalogOverlayRemainder[] | undefined;
  const occluders = new Map<string, readonly BoundingBox[]>();
  const follow = () => {
    const next = sceneVersion();
    if (next === version) return;
    version = next;
    slots = undefined;
    remainders = undefined;
    occluders.clear();
  };
  return {
    slots() {
      follow();
      return (slots ??= build.slots());
    },
    remainders() {
      follow();
      return (remainders ??= build.remainders());
    },
    occludersOf(identity) {
      follow();
      let boxes = occluders.get(identity);
      if (!boxes) {
        boxes = build.occluders(identity);
        occluders.set(identity, boxes);
      }
      return boxes;
    },
  };
}

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

/** The drag presentation the renderer applies (`nodeRendererTree.ts`). */
export interface CatalogDragShift {
  drag: { elementIds: ReadonlySet<string>; dx: number; dy: number } | null;
  /** Some sibling eases aside (`hasDragSiblingOffsets`). */
  siblings: boolean;
  siblingOffset(identity: string): { dx: number; dy: number } | undefined;
}

/**
 * Slot marks of the drawn scene moved as their records are drawn during a drag: under a dragged
 * record by the drag's offset, under a sibling easing aside by that sibling's. The scene's boxes
 * stay put until the drop (the renderer only translates), so the marks read the same offsets.
 * No drag: the same list (a camera-only frame pays nothing).
 *
 * **Why (2026-10-22 user report)**: an empty slot's hatch stayed where the component was while
 * the component followed the pointer.
 */
export function catalogDraggedSlotMarks(
  marks: readonly CatalogOverlaySlotMark[],
  parentOf: (identity: string) => string | undefined,
  shift: CatalogDragShift,
): readonly CatalogOverlaySlotMark[] {
  const { drag } = shift;
  if (!drag && !shift.siblings) return marks;
  let moved: CatalogOverlaySlotMark[] | undefined;
  marks.forEach((mark, index) => {
    let offset: { dx: number; dy: number } | undefined;
    for (
      let at: string | undefined = mark.identity;
      at && !offset;
      at = parentOf(at)
    )
      offset = drag?.elementIds.has(at)
        ? drag
        : shift.siblings
          ? shift.siblingOffset(at)
          : undefined;
    if (!offset || (offset.dx === 0 && offset.dy === 0)) return;
    moved ??= [...marks];
    moved[index] = {
      ...mark,
      box: {
        ...mark.box,
        x: mark.box.x + offset.dx,
        y: mark.box.y + offset.dy,
      },
    };
  });
  return moved ?? marks;
}

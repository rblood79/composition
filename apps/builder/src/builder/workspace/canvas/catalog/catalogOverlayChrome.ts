import type { BoundingBox } from "../selection/types";
import type { EditingSemanticsRole } from "../../../utils/editingSemanticsRole";

export interface CatalogOverlaySlotMark {
  box: BoundingBox;
  empty: boolean;
  role: EditingSemanticsRole;
  identity: string;
  /** Under a dragged root (drawn over every page): not cut by the occluding pages. */
  onTop?: boolean;
}

export interface CatalogOverlayRemainder {
  box: BoundingBox;
  hiddenRows: number;
  ownerId: string;
  /** Under a dragged root (drawn over every page): not cut by the occluding pages. */
  onTop?: boolean;
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
  siblingOffset(identity: string): { dx: number; dy: number } | undefined;
  siblings: boolean;
  /**
   * A record the stream draws at its top layer from its own place — a dragged root, a fixed box
   * (`RenderCommandStream.topLayerElementIds`): the offsets of the records above it are not its.
   */
  topLayerRoot(identity: string): boolean;
}

/** Where the renderer draws a record during a drag, against its scene box. */
export interface CatalogDragPlacement {
  dx: number;
  dy: number;
  /** Under a dragged root: drawn over every page (the occluding pages do not cut it). */
  onTop: boolean;
}

/**
 * A record's drag placement, as the renderer draws it: each level adds its own offset (the drag's
 * on a dragged record, a sibling's easing aside) to its parent's place (`renderCommands.ts`
 * translateStack), up to a top-layer root. Kept per call — the records under one container walk
 * its chain once. No drag: undefined (a camera-only frame pays nothing).
 *
 * **Why (2026-10-22 user report)**: an empty slot's hatch stayed where the component was while
 * the component followed the pointer. **2026-10-24 review**: the nearest offset alone left a mark
 * under an easing child of an easing container off by the container's offset.
 */
export function catalogDragPlacement(
  parentOf: (identity: string) => string | undefined,
  shift: CatalogDragShift,
): ((identity: string) => CatalogDragPlacement | undefined) | undefined {
  const { drag } = shift;
  if (!drag && !shift.siblings) return undefined;
  const kept = new Map<string, CatalogDragPlacement | null>();
  const placementOf = (identity: string): CatalogDragPlacement | null => {
    const known = kept.get(identity);
    if (known !== undefined) return known;
    const dragged = drag?.elementIds.has(identity) ?? false;
    const own = dragged
      ? drag
      : shift.siblings
        ? shift.siblingOffset(identity)
        : undefined;
    const root = shift.topLayerRoot(identity);
    const parent = root ? undefined : parentOf(identity);
    const above = parent ? placementOf(parent) : null;
    const dx = (own?.dx ?? 0) + (above?.dx ?? 0);
    const dy = (own?.dy ?? 0) + (above?.dy ?? 0);
    const onTop = (dragged && root) || (above?.onTop ?? false);
    const placement = dx || dy || onTop ? { dx, dy, onTop } : null;
    kept.set(identity, placement);
    return placement;
  };
  return (identity) => placementOf(identity) ?? undefined;
}

/**
 * Scene-box chrome (slot marks, row remainders, binding badges) moved with its records during a
 * drag (`catalogDragPlacement`). Nothing moved: the same list.
 */
export function catalogDraggedChrome<T>(
  items: readonly T[],
  identityOf: (item: T) => string | undefined,
  placementOf: ((identity: string) => CatalogDragPlacement | undefined) | undefined,
  move: (item: T, placement: CatalogDragPlacement) => T,
): readonly T[] {
  if (!placementOf) return items;
  let moved: T[] | undefined;
  items.forEach((item, index) => {
    const identity = identityOf(item);
    const placement = identity ? placementOf(identity) : undefined;
    if (!placement) return;
    moved ??= [...items];
    moved[index] = move(item, placement);
  });
  return moved ?? items;
}

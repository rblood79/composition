import type { BoundingBox } from "../workspace/canvas/selection/types";
import { renderCounters } from "../workspace/canvas/skia/renderCounters";
import type {
  ChildOverflowContext,
  OverflowContentInfo,
} from "../workspace/canvas/skia/overlayTypes";

/**
 * ADR-248 Phase 4e: `overflow` on the catalog Canvas — what clips, the scroll range of a
 * scroll/auto box, and the overflow overlay (Figma's: hovering a clipping box shows the children
 * outside it; a selected child of a scroll/auto box is hatched where it leaves the box). The rules
 * are the old Canvas's (`buildBoxNodeData` clip, `computeScrollExtent` / `computeMaxScroll` — kept here so the
 * catalog Canvas does not reach the old layout engine — and `buildOverflowInfoMap`).
 */

type OverflowType = OverflowContentInfo["overflowType"];

export interface CatalogOverflowTree {
  overflowOf(id: string): unknown;
  childrenOf(id: string): readonly string[];
  parentOf(id: string): string | undefined;
}

/** Hidden, clip, scroll and auto all clip the children (CSS: anything but `visible`). */
export function catalogOverflowClips(
  overflow: unknown,
): overflow is OverflowType {
  return (
    overflow === "hidden" ||
    overflow === "clip" ||
    overflow === "scroll" ||
    overflow === "auto"
  );
}

export const catalogOverflowScrolls = (overflow: unknown): boolean =>
  overflow === "scroll" || overflow === "auto";

/** The same depth limit as the old descent (cycles and abnormal depth). */
const MAX_DEPTH = 32;
/** A changed subtree this close to the far edge may have been the one reaching it. */
const EXTENT_TOLERANCE = 1e-3;
/** Sub-pixel layout noise is not overflow. */
const EPSILON = 0.5;

/**
 * How far a scroll/auto box scrolls: its descendants' extent (parent-local rects, the descent
 * stopping at a box that clips its own) plus the end padding and border, past its own size.
 */
export function catalogScrollRange(
  id: string,
  tree: CatalogOverflowTree,
  rectOf: (id: string) => BoundingBox | undefined,
  end: { right: number; bottom: number },
  /** The box's descendant extent when the caller holds it (`catalogScrollExtent`). */
  extent?: CatalogScrollExtent,
): { maxScrollTop: number; maxScrollLeft: number } {
  const box = rectOf(id);
  if (!box) return { maxScrollTop: 0, maxScrollLeft: 0 };
  const { right, bottom } = extent ?? catalogScrollExtent(id, tree, rectOf);
  return {
    maxScrollTop: Math.max(0, bottom + end.bottom - box.height),
    maxScrollLeft: Math.max(0, right + end.right - box.width),
  };
}

/** The far edges a scroll/auto box's descendants reach, in its own coordinates (floor 0). */
export interface CatalogScrollExtent {
  readonly right: number;
  readonly bottom: number;
}

/** Descends from `start` (box-local offset · depth) the way the scroll range does. */
function descendExtent(
  start: { id: string; x: number; y: number; depth: number }[],
  tree: CatalogOverflowTree,
  rectOf: (id: string) => BoundingBox | undefined,
  subtree = false,
): CatalogScrollExtent {
  let maxRight = 0;
  let maxBottom = 0;
  const stack = start;
  const seen = new Set<string>();
  while (stack.length) {
    const { id: child, x, y, depth } = stack.pop()!;
    if (seen.has(child)) continue;
    seen.add(child);
    if (process.env.NODE_ENV === "development") {
      if (subtree) renderCounters.scrollSubtreeVisits += 1;
      else renderCounters.scrollRangeVisits += 1;
    }
    const rect = rectOf(child);
    if (!rect) continue;
    const left = x + rect.x;
    const top = y + rect.y;
    maxRight = Math.max(maxRight, left + rect.width);
    maxBottom = Math.max(maxBottom, top + rect.height);
    if (depth >= MAX_DEPTH || catalogOverflowClips(tree.overflowOf(child)))
      continue;
    for (const next of tree.childrenOf(child))
      stack.push({ id: next, x: left, y: top, depth: depth + 1 });
  }
  return { right: maxRight, bottom: maxBottom };
}

/** A scroll/auto box's descendant extent — every descendant the range reads (full descent). */
export function catalogScrollExtent(
  id: string,
  tree: CatalogOverflowTree,
  rectOf: (id: string) => BoundingBox | undefined,
): CatalogScrollExtent {
  if (process.env.NODE_ENV === "development")
    renderCounters.scrollRangeCalls += 1;
  return descendExtent(
    tree.childrenOf(id).map((child) => ({ id: child, x: 0, y: 0, depth: 0 })),
    tree,
    rectOf,
  );
}

/**
 * ADR-263 Phase 4: what one descendant's subtree adds to `ownerId`'s extent (owner coordinates) —
 * the full descent restricted to that subtree. `ownerId` is the descendant's nearest clipping
 * ancestor. Null = the descent does not reach it (a missing rect on the way, past the depth limit).
 */
export function catalogSubtreeScrollExtent(
  ownerId: string,
  nodeId: string,
  tree: CatalogOverflowTree,
  rectOf: (id: string) => BoundingBox | undefined,
): CatalogScrollExtent | null {
  let x = 0;
  let y = 0;
  let depth = 0;
  for (
    let cursor = tree.parentOf(nodeId);
    cursor !== ownerId;
    cursor = tree.parentOf(cursor)
  ) {
    if (cursor === undefined || depth > MAX_DEPTH) return null;
    const rect = rectOf(cursor);
    if (!rect) return null;
    x += rect.x;
    y += rect.y;
    depth += 1;
  }
  if (depth > MAX_DEPTH || !rectOf(nodeId)) return null;
  return descendExtent([{ id: nodeId, x, y, depth }], tree, rectOf, true);
}

/**
 * ADR-263 Phase 4: a scroll/auto box's extent after some descendant subtrees changed, from the
 * extent before and what those subtrees contributed before and after — without the full descent.
 * Null = recompute: a changed subtree reached the old far edge on an axis and nothing reaches it
 * any more (the edge may come back in).
 */
export function catalogUpdatedScrollExtent(
  previous: CatalogScrollExtent,
  before: readonly (CatalogScrollExtent | null)[],
  after: readonly (CatalogScrollExtent | null)[],
): CatalogScrollExtent | null {
  const axis = (key: "right" | "bottom"): number | null => {
    const reached = Math.max(0, ...after.map((e) => e?.[key] ?? 0));
    // The tolerance counts a subtree summed in another order (float rounding) as reaching it.
    const touched = before.some(
      (e) => !!e && e[key] >= previous[key] - EXTENT_TOLERANCE,
    );
    if (touched && reached < previous[key]) return null;
    return Math.max(previous[key], reached);
  };
  const right = axis("right");
  const bottom = axis("bottom");
  return right === null || bottom === null ? null : { right, bottom };
}

const outside = (b: BoundingBox, c: BoundingBox) =>
  b.x < c.x - EPSILON ||
  b.y < c.y - EPSILON ||
  b.x + b.width > c.x + c.width + EPSILON ||
  b.y + b.height > c.y + c.height + EPSILON;

/**
 * A clipping box's descendants that leave it (scene boxes). The descent stops at a descendant
 * that already leaves it and at one that clips its own.
 */
export function catalogOverflowContent(
  id: string,
  tree: CatalogOverflowTree,
  bounds: ReadonlyMap<string, BoundingBox>,
): OverflowContentInfo | null {
  const overflowType = tree.overflowOf(id);
  const container = bounds.get(id);
  if (!catalogOverflowClips(overflowType) || !container) return null;
  const overflowChildren: OverflowContentInfo["overflowChildren"] = [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const stack = tree.childrenOf(id).map((child) => ({ id: child, depth: 0 }));
  const seen = new Set<string>();
  while (stack.length) {
    const { id: child, depth } = stack.pop()!;
    if (seen.has(child)) continue;
    seen.add(child);
    const box = bounds.get(child);
    if (!box) continue;
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.width);
    maxY = Math.max(maxY, box.y + box.height);
    if (outside(box, container)) {
      overflowChildren.push({ id: child, bounds: box });
      continue;
    }
    if (depth >= MAX_DEPTH || catalogOverflowClips(tree.overflowOf(child)))
      continue;
    for (const next of tree.childrenOf(child))
      stack.push({ id: next, depth: depth + 1 });
  }
  if (!overflowChildren.length) return null;
  return {
    containerBounds: container,
    contentBounds: {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    },
    overflowChildren,
    overflowType,
  };
}

/**
 * A selected box that leaves its nearest clipping ancestor, when that ancestor scrolls (the part
 * outside is hatched). A box inside an ancestor that already leaves the container is not reached
 * by the container's descent, as in the old map.
 */
export function catalogOverflowHatch(
  id: string,
  tree: CatalogOverflowTree,
  bounds: ReadonlyMap<string, BoundingBox>,
): ChildOverflowContext | null {
  const childBounds = bounds.get(id);
  if (!childBounds) return null;
  const between: string[] = [];
  let container = tree.parentOf(id);
  for (let depth = 0; container && depth <= MAX_DEPTH; depth += 1) {
    if (catalogOverflowClips(tree.overflowOf(container))) break;
    between.push(container);
    container = tree.parentOf(container);
  }
  const overflowType = container ? tree.overflowOf(container) : undefined;
  const containerBounds = container ? bounds.get(container) : undefined;
  if (
    !containerBounds ||
    !catalogOverflowScrolls(overflowType) ||
    !outside(childBounds, containerBounds) ||
    between.some((ancestor) => {
      const box = bounds.get(ancestor);
      return !!box && outside(box, containerBounds);
    })
  )
    return null;
  return {
    containerBounds,
    childBounds,
    overflowType: overflowType as OverflowType,
  };
}

/**
 * The scrollbar of a scroll/auto box (the old Canvas's thumb geometry: track = the box side, thumb
 * ≥ 20 px); none when nothing overflows.
 */
export function catalogScrollbar(
  width: number,
  height: number,
  range: { maxScrollTop: number; maxScrollLeft: number },
  offset: { scrollTop: number; scrollLeft: number } = {
    scrollTop: 0,
    scrollLeft: 0,
  },
): CatalogScrollbar | undefined {
  const bar: CatalogScrollbar = {};
  if (range.maxScrollTop > 0) {
    const thumbHeight = Math.max(
      20,
      (height / (height + range.maxScrollTop)) * height,
    );
    bar.vertical = {
      trackHeight: height,
      thumbHeight,
      thumbY: (offset.scrollTop / range.maxScrollTop) * (height - thumbHeight),
    };
  }
  if (range.maxScrollLeft > 0) {
    const thumbWidth = Math.max(
      20,
      (width / (width + range.maxScrollLeft)) * width,
    );
    bar.horizontal = {
      trackWidth: width,
      thumbWidth,
      thumbX: (offset.scrollLeft / range.maxScrollLeft) * (width - thumbWidth),
    };
  }
  return bar.vertical || bar.horizontal ? bar : undefined;
}

export interface CatalogScrollbar {
  vertical?: { trackHeight: number; thumbHeight: number; thumbY: number };
  horizontal?: { trackWidth: number; thumbWidth: number; thumbX: number };
}

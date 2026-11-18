/**
 * Waterfall (masonry) — RAC `WaterfallLayout` (react-aria.adobe.com/examples/photos) · S2 CardView
 * `layout="waterfall"`. The columns are the container's grid tracks; the row axis has none: each
 * item goes, in order, under the **shortest column** (a tie within 1px → the leftmost) and the
 * container is as tall as its longest column.
 *
 * The Canvas engine lays it out as `grid-template-rows: masonry` (`packages/engine/src/tree.rs`
 * `solve_grid_masonry` — `styleOf` sends the keyword). The DOM has no stable masonry track, so the
 * Preview places the RAC items with the same rule (`catalogWaterfallPlace`): each item in its
 * column of one grid row, at its own height, moved down by its column's height (`translate`), and
 * that row as tall as the longest column.
 */
/** A record laid out as a waterfall: a CardView or a GridList with `layout: waterfall`. */
export function catalogWaterfallLayout(node: {
  readonly bindingId?: string;
  readonly props: Readonly<Record<string, unknown>>;
}): boolean {
  return (
    (node.bindingId === "cardview" || node.bindingId === "gridlist") &&
    node.props.layout === "waterfall"
  );
}

/** Below this the columns tie and the leftmost wins (the engine's `masonry_lanes` — same value). */
const LANE_TOLERANCE = 1;

/** An item's margin box on the column axis: top margin, box height, bottom margin. */
export type WaterfallExtent = readonly [number, number, number];

/** The column of each item, in order (the engine's `masonry_lanes`). */
export function catalogWaterfallLanes(
  extents: readonly WaterfallExtent[],
  columns: number,
  rowGap: number,
): number[] {
  const heights = new Array<number>(Math.max(1, columns)).fill(0);
  return extents.map(([top, height, bottom]) => {
    const min = Math.min(...heights);
    const lane = Math.max(
      0,
      heights.findIndex((value) => value <= min + LANE_TOLERANCE),
    );
    heights[lane] += top + height + bottom + rowGap;
    return lane;
  });
}

/** A computed CSS length in px (0 when it is not a number). */
export const catalogPx = (value: string): number => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};

/** `grid`'s laid-out item elements: shown, in flow. */
export function catalogWaterfallItems(
  grid: HTMLElement,
  view: Window & typeof globalThis,
): HTMLElement[] {
  return [...grid.children].filter(
    (el): el is HTMLElement =>
      el instanceof view.HTMLElement &&
      (() => {
        const cs = view.getComputedStyle(el);
        return (
          cs.display !== "none" &&
          cs.position !== "absolute" &&
          cs.position !== "fixed"
        );
      })(),
  );
}

/** The number of resolved grid tracks (`grid-template-columns` px tokens). */
export function catalogGridTrackCount(cs: CSSStyleDeclaration): number {
  return cs.gridTemplateColumns
    .split(/\s+/)
    .filter((token) => /^-?[\d.]+px$/.test(token)).length;
}

/** The element's own scale (a zoomed Preview frame): drawn px per CSS px. */
export function catalogElementScale(el: HTMLElement): number {
  return el.offsetWidth > 0
    ? el.getBoundingClientRect().width / el.offsetWidth || 1
    : 1;
}

/** The items' margin boxes on the column axis, in CSS px. */
export function catalogWaterfallExtents(
  items: readonly HTMLElement[],
  view: Window & typeof globalThis,
  scale: number,
): WaterfallExtent[] {
  return items.map((el) => {
    const ecs = view.getComputedStyle(el);
    return [
      catalogPx(ecs.marginTop),
      el.getBoundingClientRect().height / scale,
      catalogPx(ecs.marginBottom),
    ];
  });
}

/** Lays `grid`'s item elements out as a waterfall (see the module comment). */
export function catalogWaterfallPlace(grid: HTMLElement): void {
  const view = grid.ownerDocument.defaultView;
  if (!view) return;
  const items = catalogWaterfallItems(grid, view);
  const cs = view.getComputedStyle(grid);
  const columns = Math.max(1, catalogGridTrackCount(cs));
  const rowGap = catalogPx(cs.rowGap);
  const scale = catalogElementScale(grid);
  const place = (lanes: readonly number[]) =>
    items.forEach((el, i) => {
      el.style.gridColumn = `${lanes[i] + 1} / span 1`;
      el.style.gridRow = "1 / span 1";
      el.style.alignSelf = "start";
    });
  const measure = () => catalogWaterfallExtents(items, view, scale);
  const roundRobin = items.map((_, i) => i % columns);
  place(roundRobin);
  let extents = measure();
  const lanes = catalogWaterfallLanes(extents, columns, rowGap);
  if (lanes.some((lane, i) => lane !== roundRobin[i])) {
    place(lanes);
    extents = measure();
  }
  const heights = new Array<number>(columns).fill(0);
  items.forEach((el, i) => {
    const lane = lanes[i];
    el.style.translate = heights[lane] > 0 ? `0 ${heights[lane]}px` : "";
    const [top, height, bottom] = extents[i];
    heights[lane] += top + height + bottom + rowGap;
  });
  const longest = items.length ? Math.max(...heights) - rowGap : 0;
  grid.style.gridTemplateRows = `${Math.max(0, longest)}px`;
}

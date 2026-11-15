/**
 * ADR-310 Phase 8 (사용자 결정 7) — a virtual-scrolled grid's cells as RAC's `GridLayout` places them
 * (react-stately `layout/GridLayout` `update` — a closed formula over the scroll width): the column
 * count, the item width (between `minItemSize` and `maxItemSize`), the height in proportion, the
 * horizontal spacing and the side margin. The Canvas places a virtual grid's sample cells with it
 * so the two consumers draw the same cells (G8). Pure — no RAC import.
 */
export interface CatalogGridLayoutOptions {
  readonly minItemSize?: { readonly width: number; readonly height: number };
  readonly maxItemSize?: { readonly width: number; readonly height: number };
  readonly minSpace?: { readonly width: number; readonly height: number };
  readonly maxHorizontalSpace?: number;
  readonly maxColumns?: number;
}

export interface CatalogGridLayoutCells {
  readonly columns: number;
  readonly itemWidth: number;
  readonly itemHeight: number;
  readonly gapX: number;
  readonly gapY: number;
  readonly margin: number;
  /** Each item's rect, in order (`x` · `y` from the scroll box's top left). */
  readonly cells: readonly {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  }[];
  /** The content height (the last row's bottom plus its gap). */
  readonly height: number;
}

/** RAC `GridLayout`'s defaults (react-stately 3.51.0). */
const DEFAULTS = {
  minItemSize: { width: 200, height: 200 },
  maxItemSize: { width: Infinity, height: Infinity },
  minSpace: { width: 18, height: 18 },
  maxHorizontalSpace: Infinity,
  maxColumns: Infinity,
};

export function catalogGridLayoutCells(
  width: number,
  count: number,
  options: CatalogGridLayoutOptions = {},
): CatalogGridLayoutCells {
  const minItemSize = options.minItemSize ?? DEFAULTS.minItemSize;
  const maxItemSize = options.maxItemSize ?? DEFAULTS.maxItemSize;
  const minSpace = options.minSpace ?? DEFAULTS.minSpace;
  const maxHorizontalSpace =
    options.maxHorizontalSpace ?? DEFAULTS.maxHorizontalSpace;
  const maxColumns = options.maxColumns ?? DEFAULTS.maxColumns;
  const maxItemWidth = Math.min(maxItemSize.width, width);
  const maxItemHeight = Number.isFinite(maxItemSize.height)
    ? maxItemSize.height
    : Math.floor((minItemSize.height / minItemSize.width) * maxItemWidth);
  const columns = Math.max(
    1,
    Math.min(maxColumns, Math.floor(width / (minItemSize.width + minSpace.width))),
  );
  const available = width - minSpace.width * Math.max(0, columns);
  let itemWidth = Math.floor(available / columns);
  itemWidth = Math.max(minItemSize.width, Math.min(maxItemWidth, itemWidth));
  const t =
    (itemWidth - minItemSize.width) /
    Math.max(1, maxItemWidth - minItemSize.width);
  let itemHeight =
    minItemSize.height + Math.floor((maxItemHeight - minItemSize.height) * t);
  itemHeight = Math.max(minItemSize.height, Math.min(maxItemHeight, itemHeight));
  const gapX = Math.min(
    Math.max(maxHorizontalSpace, minSpace.width),
    Math.floor((width - columns * itemWidth) / (columns + 1)),
  );
  const margin = Math.floor(
    (width - columns * itemWidth - gapX * (columns + 1)) / 2,
  );
  const rows = Math.ceil(count / columns);
  const cells: { x: number; y: number; width: number; height: number }[] = [];
  let y = rows > 0 ? minSpace.height : 0;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns && cells.length < count; col += 1)
      cells.push({
        x: gapX + col * (itemWidth + gapX) + margin,
        y,
        width: itemWidth,
        height: itemHeight,
      });
    y += itemHeight + minSpace.height;
  }
  return {
    columns,
    itemWidth,
    itemHeight,
    gapX,
    gapY: minSpace.height,
    margin,
    cells,
    height: y,
  };
}

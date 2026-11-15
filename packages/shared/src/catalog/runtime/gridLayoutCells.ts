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

/**
 * The columns alone (the Canvas's virtual grid tracks — `virtualGrid.ts`): the column count, the
 * item width, the horizontal spacing and the side margin.
 */
export function catalogGridLayoutColumns(
  width: number,
  options: CatalogGridLayoutOptions = {},
): { columns: number; itemWidth: number; gapX: number; gapY: number; margin: number } {
  const minItemSize = options.minItemSize ?? DEFAULTS.minItemSize;
  const minSpace = options.minSpace ?? DEFAULTS.minSpace;
  const maxItemWidth = Math.min(
    (options.maxItemSize ?? DEFAULTS.maxItemSize).width,
    width,
  );
  const columns = Math.max(
    1,
    Math.min(
      options.maxColumns ?? DEFAULTS.maxColumns,
      Math.floor(width / (minItemSize.width + minSpace.width)),
    ),
  );
  const itemWidth = Math.max(
    minItemSize.width,
    Math.min(maxItemWidth, Math.floor((width - minSpace.width * columns) / columns)),
  );
  const gapX = Math.min(
    Math.max(options.maxHorizontalSpace ?? DEFAULTS.maxHorizontalSpace, minSpace.width),
    Math.floor((width - columns * itemWidth) / (columns + 1)),
  );
  const margin = Math.floor((width - columns * itemWidth - gapX * (columns + 1)) / 2);
  return { columns, itemWidth, gapX, gapY: minSpace.height, margin };
}

export function catalogGridLayoutCells(
  width: number,
  count: number,
  options: CatalogGridLayoutOptions = {},
): CatalogGridLayoutCells {
  const { columns, itemWidth, gapX, gapY, margin } = catalogGridLayoutColumns(
    width,
    options,
  );
  const minItemSize = options.minItemSize ?? DEFAULTS.minItemSize;
  const maxItemSize = options.maxItemSize ?? DEFAULTS.maxItemSize;
  const maxItemWidth = Math.min(maxItemSize.width, width);
  const maxItemHeight = Number.isFinite(maxItemSize.height)
    ? maxItemSize.height
    : Math.floor((minItemSize.height / minItemSize.width) * maxItemWidth);
  // (The height in proportion to the width — RAC's estimate; measured heights replace it.)
  const t =
    (itemWidth - minItemSize.width) /
    Math.max(1, maxItemWidth - minItemSize.width);
  const itemHeight = Math.max(
    minItemSize.height,
    Math.min(
      maxItemHeight,
      minItemSize.height + Math.floor((maxItemHeight - minItemSize.height) * t),
    ),
  );
  const rows = Math.ceil(count / columns);
  const cells: { x: number; y: number; width: number; height: number }[] = [];
  let y = rows > 0 ? gapY : 0;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns && cells.length < count; col += 1)
      cells.push({
        x: gapX + col * (itemWidth + gapX) + margin,
        y,
        width: itemWidth,
        height: itemHeight,
      });
    y += itemHeight + gapY;
  }
  return { columns, itemWidth, itemHeight, gapX, gapY, margin, cells, height: y };
}

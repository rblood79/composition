import {
  catalogGridLayoutColumns,
  type CatalogGridLayoutOptions,
} from "./gridLayoutCells";

/**
 * ADR-310 Phase 8 (사용자 결정 7) — a virtual-scrolled grid's `GridLayout` options, from the list's
 * type, props and scroll width alone (the Preview · Publish root has no geometry, so both consumers
 * read the same values):
 *
 * - **CardView** — S2 CardView's table (installed `@react-spectrum/s2` 1.8.2 `CardView` `layoutOptions`,
 *   density `regular` — the prop is not on the binding): the rendered t-shirt size is the smaller of
 *   the `size` prop and the largest size two columns fit in (S2 `updateSize`).
 * - **GridList `layout="grid"`** — RAC's reference (Virtualizer 「GridLayout」 example): the layout's
 *   defaults.
 *
 * Heights are measured (S2 · the reference pass no `preserveAspectRatio`): a row is as tall as its
 * tallest item. Pure.
 */
const SIZES = ["XS", "S", "M", "L", "XL"] as const;

/** S2 CardView `layoutOptions[size].regular` — minSpace · min item · max item (square). */
const CARD_VIEW_REGULAR: Record<
  (typeof SIZES)[number],
  readonly [number, number, number]
> = {
  XS: [8, 100, 140],
  S: [12, 150, 210],
  M: [16, 200, 280],
  L: [20, 270, 370],
  XL: [24, 340, 460],
};

const square = (value: number) => ({ width: value, height: value });

export function catalogVirtualGridOptions(
  type: string,
  props: Readonly<Record<string, unknown>>,
  width: number,
): CatalogGridLayoutOptions | undefined {
  // (GridList's `layout` defaults to `grid` — `props.layout || "grid"` in its DOM.)
  if (props.layout === "waterfall" || props.layout === "stack") return undefined;
  if (type === "GridList") return {};
  if (type !== "CardView") return undefined;
  let fits = SIZES.length - 1;
  while (fits > 0) {
    const [space, min] = CARD_VIEW_REGULAR[SIZES[fits]];
    if (width >= min * 2 + space * 3) break;
    fits -= 1;
  }
  const asked = SIZES.indexOf(
    String(props.size ?? "M") as (typeof SIZES)[number],
  );
  const [space, min, max] =
    CARD_VIEW_REGULAR[SIZES[Math.min(fits, asked < 0 ? 2 : asked)]];
  return {
    minSpace: square(space),
    minItemSize: square(min),
    maxItemSize: square(max),
  };
}

/**
 * The Canvas's box for a virtual grid: the `GridLayout` columns as grid tracks — the item width,
 * the horizontal spacing as column gap and start inset (with the centring margin), the minimum
 * vertical space above, between and below the rows — rows as tall as their content (`start`: the
 * DOM's items keep their measured height). Engine input form (`styleOf`): lengths are `"Npx"`,
 * tracks an array.
 */
export function catalogVirtualGridStyle(
  type: string,
  props: Readonly<Record<string, unknown>>,
  width: number,
): Record<string, string | string[]> | undefined {
  const options = catalogVirtualGridOptions(type, props, width);
  if (!options) return undefined;
  const { columns, itemWidth, gapX, gapY, margin } = catalogGridLayoutColumns(
    width,
    options,
  );
  const px = (value: number) => `${value}px`;
  return {
    display: "grid",
    gridTemplateColumns: Array.from({ length: columns }, () => px(itemWidth)),
    alignItems: "start",
    justifyContent: "start",
    columnGap: px(gapX),
    rowGap: px(gapY),
    paddingTop: px(gapY),
    paddingBottom: px(gapY),
    paddingLeft: px(gapX + margin),
    paddingRight: px(0),
  };
}

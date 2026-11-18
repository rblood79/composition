/**
 * ADR-314 Phase 4 (breakdown §3.4 「반복 수」) — how many SkeletonCollection items a CardView draws.
 * S2 leaves it to the collection's RAC layout, which repeats the one `skeleton` node; a virtualized
 * CardView gets that from RAC itself (`GridLayout` — our `CatalogGridLayout` extends it). These pure
 * counts are the same rules for the non-virtualized paths (flex wrap · grid · `CatalogWaterfallGrid`),
 * held against the installed layouts (`react-stately` 3.51.0 — `adr314SkeletonCollection.test.tsx`).
 *
 * `viewportHeight` is the height to fill (a CardView of a set height). A CardView as tall as its
 * content has none — composition's policy, not S2's: grid = the current row to its end and one row
 * more, waterfall = one item in every column.
 */

export interface CatalogGridSkeletonInput {
  /** Items per row. */
  readonly columns: number;
  /** Cards before the skeleton items (0 while `loading`). */
  readonly existing: number;
  readonly itemHeight: number;
  /** Row gap. */
  readonly gap: number;
  readonly viewportHeight?: number;
}

/** RAC `GridLayout.update` (`layout/GridLayout.js` 60 ~ 115): repeat to the row's end, add rows to fill. */
export function catalogGridSkeletonCount(
  input: CatalogGridSkeletonInput,
): number {
  const columns = Math.max(1, Math.floor(input.columns));
  // (The skeleton node counts once more — an extra row for it, `collectionSize++`.)
  let rows = Math.ceil((input.existing + 1) / columns);
  let extraRows = input.viewportHeight === undefined ? 1 : 0;
  let y = rows > 0 ? input.gap : 0;
  let consumed = 0;
  let skeleton = false;
  let count = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      if (!skeleton) {
        if (consumed < input.existing) {
          consumed += 1;
          continue;
        }
        skeleton = true;
      }
      count += 1;
    }
    y += input.itemHeight + input.gap;
    if (skeleton && row === rows - 1) {
      if (input.viewportHeight !== undefined) {
        // (A row that adds no height cannot fill the viewport — stop at the row's end. RAC's loop
        //  would not end either; its rows always have an estimated height.)
        if (input.itemHeight + input.gap > 0 && y < input.viewportHeight)
          rows += 1;
      } else if (extraRows > 0) {
        extraRows -= 1;
        rows += 1;
      }
    }
  }
  return count;
}

export interface CatalogWaterfallSkeletonInput {
  /** Each column's height after the existing cards (RAC starts every column at the gap). */
  readonly columnHeights: readonly number[];
  readonly itemHeight: number;
  readonly gap: number;
  readonly viewportHeight?: number;
}

/**
 * RAC `WaterfallLayout.update` (`layout/WaterfallLayout.js` 98 ~ 112): add to the shortest column
 * until every column has one and the shortest reaches the viewport's height.
 */
export function catalogWaterfallSkeletonCount(
  input: CatalogWaterfallSkeletonInput,
): number {
  const heights = input.columnHeights.length
    ? [...input.columnHeights]
    : [input.gap];
  // (Items that add no height cannot fill the viewport — one in every column, not the bound's 10,000.)
  if (input.itemHeight + input.gap <= 0) return heights.length;
  const start = [...heights];
  let count = 0;
  // (A safety bound — the loop ends once every column grew and the shortest passed the viewport.)
  while (count < 10_000) {
    const everyGrew = heights.every((h, i) => h !== start[i]);
    const filled =
      input.viewportHeight === undefined ||
      Math.min(...heights) >= input.viewportHeight;
    if (everyGrew && filled) break;
    const shortest = heights.reduce(
      (min, h, i) => (h < heights[min]! ? i : min),
      0,
    );
    heights[shortest] = heights[shortest]! + input.itemHeight + input.gap;
    count += 1;
  }
  return count;
}

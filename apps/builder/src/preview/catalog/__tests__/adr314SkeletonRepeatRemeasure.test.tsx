import { act, render } from "@testing-library/react";
import { GridList } from "react-aria-components";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CatalogSkeletonFill,
  CatalogSkeletonItem,
} from "../../../../../../packages/shared/src/catalog/runtime/skeletonCollection.components";
import {
  catalogGridSkeletonCount,
  catalogWaterfallSkeletonCount,
} from "../../../../../../packages/shared/src/catalog/runtime/skeletonRepeat";

/**
 * ADR-314 후속 (ultrareview 2026-11-19) — the skeleton repeat count follows the drawn grid.
 * ① The count is measured after every render of the CardView, not only when `existing` ·
 *   `waterfall` · `fixedHeight` change: a card size · gap · column edit (a Preview delta) changes the
 *   grid with those three the same.
 * ② A row that adds no height (template 0px tall · row gap 0) cannot fill a set height — the counts
 *   stop instead of looping (grid) or drawing the safety bound's 10,000 items (waterfall).
 */
afterEach(() => {
  vi.restoreAllMocks();
});

describe("ADR-314 후속 — the skeleton repeat count re-measures the drawn grid", () => {
  it("a card height edit with the same existing · waterfall · fixedHeight re-counts the items", () => {
    // jsdom draws nothing: the template is `cardHeight` tall and 100 wide, the CardView 200 × 400.
    let cardHeight = 100;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        return {
          width: 100,
          height: this.dataset.card !== undefined ? cardHeight : 0,
        } as DOMRect;
      },
    );
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(200);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(400);
    const grid = (size: number) => (count: number) => (
      <GridList aria-label="cards" style={{ display: "flex" }} data-size={size}>
        {Array.from({ length: count }, (_, index) => (
          <CatalogSkeletonItem
            key={index}
            id={`s-${index}`}
            measure={index === 0}
          >
            <div data-card="" data-size={size} />
          </CatalogSkeletonItem>
        ))}
      </GridList>
    );
    const view = render(
      <CatalogSkeletonFill
        render={grid(100)}
        existing={0}
        waterfall={false}
        fixedHeight
      />,
    );
    const items = () => view.container.querySelectorAll("[data-card]").length;
    // 2 columns · rows of 100 until 400: 4 rows.
    expect(items()).toBe(8);
    cardHeight = 200;
    act(() => {
      view.rerender(
        <CatalogSkeletonFill
          render={grid(200)}
          existing={0}
          waterfall={false}
          fixedHeight
        />,
      );
    });
    // Rows of 200 until 400: 2 rows.
    expect(items()).toBe(4);
    view.unmount();
  });
});

describe("ADR-314 후속 — a row that adds no height ends the counts", () => {
  it("grid: the row to its end (no row can fill the height)", () => {
    expect(
      catalogGridSkeletonCount({
        columns: 3,
        existing: 1,
        itemHeight: 0,
        gap: 0,
        viewportHeight: 400,
      }),
    ).toBe(2);
  });

  it("waterfall: one item in every column", () => {
    expect(
      catalogWaterfallSkeletonCount({
        columnHeights: [0, 0, 0],
        itemHeight: 0,
        gap: 0,
        viewportHeight: 400,
      }),
    ).toBe(3);
  });
});

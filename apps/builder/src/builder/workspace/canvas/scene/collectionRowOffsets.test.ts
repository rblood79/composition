// @vitest-environment node
import { describe, expect, it } from "vitest";
import { resolveCollectionRowOffsets } from "./collectionRowOffsets";

const base = {
  gap: 2,
  leadingExtent: 5, // border 1 + padding 4
  trailingExtent: 5,
  viewportHeight: 400,
  overscan: 0,
};

/** 행 묶음 자식 배치를 흉내 — [lead?, rows s..e-1, trail?] 사이 gap. 반환 = 각 window 행 top. */
function placeRows(
  heights: readonly number[],
  gap: number,
  r: ReturnType<typeof resolveCollectionRowOffsets>,
) {
  const tops: number[] = [];
  let y = 0;
  let first = true;
  const push = (h: number, isRow: boolean) => {
    if (!first) y += gap;
    first = false;
    if (isRow) tops.push(y);
    y += h;
  };
  if (r.startVisual > 0) push(r.leadSpacer, false);
  for (let j = r.startVisual; j < r.endVisual; j += 1) push(heights[j], true);
  if (r.endVisual < heights.length) push(r.trailSpacer, false);
  return { tops, extent: y };
}

function trueTops(heights: readonly number[], gap: number) {
  const tops: number[] = [];
  let y = 0;
  heights.forEach((h, i) => {
    tops.push(y);
    y += h + (i < heights.length - 1 ? gap : 0);
  });
  return { tops, extent: y };
}

describe("resolveCollectionRowOffsets", () => {
  it("균일: 행 영역 = n·h + (n−1)·gap, maxScrollTop 은 inset 포함", () => {
    const r = resolveCollectionRowOffsets({
      ...base,
      visualRowCount: 100,
      rowHeights: 32,
      scrollTop: 0,
    });
    expect(r.rowsExtent).toBe(100 * 32 + 99 * 2);
    expect(r.maxScrollTop).toBe(5 + 3398 + 5 - 400);
    expect(r.uniform).toBe(true);
  });

  it.each([0, 37, 1200, 2000, 3008])(
    "교대 높이 scrollTop %i: spacer 로 배치한 window 행 top = 참 top, 총 extent 보존",
    (scrollTop) => {
      const heights = Array.from({ length: 100 }, (_, i) => (i % 2 ? 50 : 32));
      const r = resolveCollectionRowOffsets({
        ...base,
        overscan: 3,
        visualRowCount: 100,
        rowHeights: heights,
        scrollTop,
      });
      const truth = trueTops(heights, base.gap);
      const placed = placeRows(heights, base.gap, r);
      expect(placed.extent).toBe(truth.extent);
      expect(r.rowsExtent).toBe(truth.extent);
      expect(placed.tops).toEqual(truth.tops.slice(r.startVisual, r.endVisual));
      expect(r.uniform).toBe(false);
    },
  );

  it("window 는 viewport 에 걸친 행을 모두 포함한다 (overscan 0)", () => {
    const heights = Array.from({ length: 100 }, (_, i) => (i % 2 ? 50 : 32));
    const scrollTop = 1234;
    const r = resolveCollectionRowOffsets({
      ...base,
      visualRowCount: 100,
      rowHeights: heights,
      scrollTop,
    });
    const truth = trueTops(heights, base.gap);
    const visibleTop = scrollTop - base.leadingExtent;
    const visibleBottom = visibleTop + base.viewportHeight;
    const expected = heights
      .map((h, j) => ({ j, top: truth.tops[j], bottom: truth.tops[j] + h }))
      .filter((row) => row.bottom > visibleTop && row.top < visibleBottom)
      .map((row) => row.j);
    expect(r.startVisual).toBe(expected[0]);
    expect(r.endVisual).toBe(expected[expected.length - 1] + 1);
  });

  it("목록 값이 전부 같으면 균일 경로와 같은 결과", () => {
    const list = resolveCollectionRowOffsets({
      ...base,
      overscan: 6,
      visualRowCount: 50,
      rowHeights: Array(50).fill(44),
      scrollTop: 700,
    });
    const uniform = resolveCollectionRowOffsets({
      ...base,
      overscan: 6,
      visualRowCount: 50,
      rowHeights: 44,
      scrollTop: 700,
    });
    expect(list).toEqual(uniform);
  });

  it("끝까지 스크롤하면 마지막 행이 window 에 있고 trail spacer 는 0", () => {
    const heights = Array.from({ length: 100 }, (_, i) => (i % 2 ? 50 : 32));
    const probe = resolveCollectionRowOffsets({
      ...base,
      visualRowCount: 100,
      rowHeights: heights,
      scrollTop: 0,
    });
    const r = resolveCollectionRowOffsets({
      ...base,
      visualRowCount: 100,
      rowHeights: heights,
      scrollTop: probe.maxScrollTop,
    });
    expect(r.endVisual).toBe(100);
    expect(r.trailSpacer).toBe(0);
    // 마지막 행 하단 = viewport 하단 − trailingExtent
    const truth = trueTops(heights, base.gap);
    const lastBottomInOwner =
      base.leadingExtent + truth.tops[99] + heights[99] - probe.maxScrollTop;
    expect(lastBottomInOwner).toBe(base.viewportHeight - base.trailingExtent);
  });

  it("행 0 개면 spacer 없음", () => {
    const r = resolveCollectionRowOffsets({
      ...base,
      visualRowCount: 0,
      rowHeights: [],
      scrollTop: 0,
    });
    expect(r).toMatchObject({ startVisual: 0, endVisual: 0, rowsExtent: 0 });
  });
});

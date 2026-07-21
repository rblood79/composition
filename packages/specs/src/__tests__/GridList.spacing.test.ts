/**
 * resolveGridListSpacingMetric 검증: Layer B 위에 GridList-specific 확장
 * (numCols / cardPadding* / cardBorderRadius / descGap) 합성 + style 우선 +
 * grid/stack 분기 + item metric fontSize 분기 (>14/>12/else) 정합성.
 */

import { describe, it, expect } from "vitest";
// ADR-912 단계5 step4 경량 이관 (2026-06-17): GridList.spec 물리 삭제 → resolveGridListSpacingMetric
//   은 collectionItemMetrics 로 이관됨.
import { resolveGridListSpacingMetric } from "../renderers/utils/collectionItemMetrics";

describe("resolveGridListSpacingMetric — defaults", () => {
  it("style 미지정 + layout 미지정 → defaults (gap 12, fontSize 14, numCols 1 stack)", () => {
    const m = resolveGridListSpacingMetric({});
    expect(m.rowGap).toBe(12);
    expect(m.columnGap).toBe(12);
    expect(m.fontSize).toBe(14);
    expect(m.numCols).toBe(1);
    expect(m.paddingTop).toBe(0);
    expect(m.paddingRight).toBe(0);
    expect(m.paddingBottom).toBe(0);
    expect(m.paddingLeft).toBe(0);
    expect(m.borderWidth).toBe(0);
  });

  it("fontSize 14 → resolveGridListItemMetric medium 분기 (paddingX 16, paddingY 12, radius 8, descGap 2)", () => {
    const m = resolveGridListSpacingMetric({});
    expect(m.cardPaddingX).toBe(16);
    expect(m.cardPaddingY).toBe(12);
    expect(m.cardBorderRadius).toBe(8);
    // descGap = --spacing-2xs = 2 (2026-07-22 parity sweep, 과거 4 는 CSS gap 2 와 불일치)
    expect(m.descGap).toBe(2);
  });
});

describe("resolveGridListSpacingMetric — style override", () => {
  it("style.gap 단독 → row/columnGap 동시 적용", () => {
    const m = resolveGridListSpacingMetric({ style: { gap: 20 } });
    expect(m.rowGap).toBe(20);
    expect(m.columnGap).toBe(20);
  });

  it("style.padding shorthand → 4-way 동일 적용", () => {
    const m = resolveGridListSpacingMetric({
      style: { padding: 16, gap: 8 },
    });
    expect(m.paddingTop).toBe(16);
    expect(m.paddingRight).toBe(16);
    expect(m.paddingBottom).toBe(16);
    expect(m.paddingLeft).toBe(16);
    expect(m.rowGap).toBe(8);
    expect(m.columnGap).toBe(8);
  });

  it("style.padding shorthand + paddingLeft longhand → longhand 가 left override, 나머지 shorthand 유지", () => {
    const m = resolveGridListSpacingMetric({
      style: { padding: 8, paddingLeft: 24 },
    });
    expect(m.paddingTop).toBe(8);
    expect(m.paddingRight).toBe(8);
    expect(m.paddingBottom).toBe(8);
    expect(m.paddingLeft).toBe(24);
  });

  it("style.fontSize 명시 → resolveGridListItemMetric 분기 재진입 (fontSize 18 → large 카드)", () => {
    const m = resolveGridListSpacingMetric({ style: { fontSize: 18 } });
    expect(m.fontSize).toBe(18);
    expect(m.cardPaddingX).toBe(20);
    expect(m.cardPaddingY).toBe(16);
    expect(m.cardBorderRadius).toBe(12);
    // descGap 은 size 무관 2 (--spacing-2xs 고정) — large 카드도 2
    expect(m.descGap).toBe(2);
  });

  it("style.borderWidth 명시 → 그대로 반영", () => {
    const m = resolveGridListSpacingMetric({ style: { borderWidth: 2 } });
    expect(m.borderWidth).toBe(2);
  });
});

describe("resolveGridListSpacingMetric — layout/columns", () => {
  it("layout=grid + columns=3 → numCols 3", () => {
    const m = resolveGridListSpacingMetric({
      layout: "grid",
      columns: 3,
    });
    expect(m.numCols).toBe(3);
  });

  it("layout=grid + columns 미지정 → defaults 2", () => {
    const m = resolveGridListSpacingMetric({ layout: "grid" });
    expect(m.numCols).toBe(2);
  });

  it("layout=grid + columns=0 → 1 로 clamp", () => {
    const m = resolveGridListSpacingMetric({ layout: "grid", columns: 0 });
    expect(m.numCols).toBe(1);
  });

  it("layout=stack + columns=5 → numCols 1 강제 (stack 무시)", () => {
    const m = resolveGridListSpacingMetric({ layout: "stack", columns: 5 });
    expect(m.numCols).toBe(1);
  });
});

describe("resolveGridListSpacingMetric — defaults override", () => {
  it("defaultGap=4 → row/columnGap 4 (style.gap 미지정 시)", () => {
    const m = resolveGridListSpacingMetric({ defaultGap: 4 });
    expect(m.rowGap).toBe(4);
    expect(m.columnGap).toBe(4);
  });

  it("defaultGap 무시: style.gap 우선", () => {
    const m = resolveGridListSpacingMetric({
      defaultGap: 4,
      style: { gap: 24 },
    });
    expect(m.rowGap).toBe(24);
    expect(m.columnGap).toBe(24);
  });

  it("defaultFontSize=12 → fontSize 12 (style.fontSize 미지정), small 카드 분기", () => {
    const m = resolveGridListSpacingMetric({ defaultFontSize: 12 });
    expect(m.fontSize).toBe(12);
    expect(m.cardPaddingX).toBe(12);
    expect(m.cardPaddingY).toBe(10);
    expect(m.cardBorderRadius).toBe(8);
    // descGap 은 size 무관 2 (--spacing-2xs 고정)
    expect(m.descGap).toBe(2);
  });
});

describe("resolveGridListSpacingMetric — string px parsing", () => {
  it('style.padding="16px" → numeric 16 4-way', () => {
    const m = resolveGridListSpacingMetric({ style: { padding: "16px" } });
    expect(m.paddingTop).toBe(16);
    expect(m.paddingRight).toBe(16);
    expect(m.paddingBottom).toBe(16);
    expect(m.paddingLeft).toBe(16);
  });

  it('style.gap="20px" → row/columnGap 20', () => {
    const m = resolveGridListSpacingMetric({ style: { gap: "20px" } });
    expect(m.rowGap).toBe(20);
    expect(m.columnGap).toBe(20);
  });
});

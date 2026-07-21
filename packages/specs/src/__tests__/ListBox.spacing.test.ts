/**
 * resolveListBoxSpacingMetric 검증: Layer B 위에 ListBox-specific 확장
 * (itemPaddingX / itemHeight / headerHeight / sectionTopPad) 합성 + style 우선 +
 * gap shorthand/longhand 전개 + padding 4-way 전개 정합성.
 *
 * Layer D contract: `ListBoxSpec.render.shapes` 와 utils.ts `calculateContentHeight`
 * ListBox 분기가 본 resolver 를 단일 심볼로 공유 — style.gap/rowGap/columnGap/padding*
 * 편집이 Skia + Layout 양쪽에 동시 반영되는지 확증.
 */

import { describe, it, expect } from "vitest";
// ADR-912 단계5 step4 (2026-06-17): resolveListBoxSpacingMetric 이 ListBox.spec → collectionItemMetrics
//   이관(GridList.spacing.test.ts 선례). ListBox.spec 물리 삭제 대비 직접 경로 전환.
import { resolveListBoxSpacingMetric } from "../renderers/utils/collectionItemMetrics";

describe("resolveListBoxSpacingMetric — defaults", () => {
  it("style 미지정 → defaults (padding 4, gap 2, fontSize 14, borderWidth 1)", () => {
    const m = resolveListBoxSpacingMetric({});
    expect(m.paddingTop).toBe(4);
    expect(m.paddingRight).toBe(4);
    expect(m.paddingBottom).toBe(4);
    expect(m.paddingLeft).toBe(4);
    expect(m.rowGap).toBe(2);
    expect(m.columnGap).toBe(2);
    expect(m.fontSize).toBe(14);
    expect(m.borderWidth).toBe(1);
  });

  it("fontSize 14 → itemMetric sm 분기 (paddingY=4, Text line box 1.5×14=21 → itemHeight=29)", () => {
    const m = resolveListBoxSpacingMetric({});
    // 2026-07-21: label/description Text leaf line box = getTextLineHeight(1.5×fs) →
    //   14 → 21(origin 실 Text 자식·CSS line-height 1.5 동일). 과거 getLabelLineHeight(14)=20
    //   (typography 토큰)으로 28 이던 것을 origin/CSS 정합상 29 로 정정.
    expect(m.itemHeight).toBe(29); // paddingY(4) * 2 + lineHeight(21)
    expect(m.itemPaddingX).toBe(12); // ListBoxItemSpec.sizes.md.paddingX
  });

  it("fontSize 14 → header metric (headerHeight=25, headerFontSize=12, sectionTopPad=7)", () => {
    const m = resolveListBoxSpacingMetric({});
    expect(m.headerHeight).toBe(Math.round(14 * 1.75));
    expect(m.headerFontSize).toBe(Math.round(14 * 0.85));
    expect(m.sectionTopPad).toBe(Math.round(14 * 0.5));
  });

  it("caller defaultPaddingX/Y override → resolveContainerSpacing defaults 반영", () => {
    const m = resolveListBoxSpacingMetric({
      defaultPaddingX: 8,
      defaultPaddingY: 12,
      defaultGap: 6,
      defaultFontSize: 16,
    });
    expect(m.paddingLeft).toBe(8);
    expect(m.paddingRight).toBe(8);
    expect(m.paddingTop).toBe(12);
    expect(m.paddingBottom).toBe(12);
    expect(m.rowGap).toBe(6);
    expect(m.columnGap).toBe(6);
    expect(m.fontSize).toBe(16);
  });
});

describe("resolveListBoxSpacingMetric — gap style override", () => {
  it("style.gap shorthand → rowGap + columnGap 동시 적용", () => {
    const m = resolveListBoxSpacingMetric({ style: { gap: 10 } });
    expect(m.rowGap).toBe(10);
    expect(m.columnGap).toBe(10);
  });

  it("style.rowGap longhand → rowGap 만 override (columnGap fallback)", () => {
    const m = resolveListBoxSpacingMetric({ style: { rowGap: 16 } });
    expect(m.rowGap).toBe(16);
    expect(m.columnGap).toBe(2); // default
  });

  it("style.columnGap longhand → columnGap 만 override (rowGap fallback)", () => {
    const m = resolveListBoxSpacingMetric({ style: { columnGap: 12 } });
    expect(m.rowGap).toBe(2); // default
    expect(m.columnGap).toBe(12);
  });

  it("style.rowGap + style.columnGap 동시 → 각자 적용", () => {
    const m = resolveListBoxSpacingMetric({
      style: { rowGap: 8, columnGap: 20 },
    });
    expect(m.rowGap).toBe(8);
    expect(m.columnGap).toBe(20);
  });

  it("gap 문자열 '14px' → 14", () => {
    const m = resolveListBoxSpacingMetric({ style: { gap: "14px" } });
    expect(m.rowGap).toBe(14);
    expect(m.columnGap).toBe(14);
  });
});

describe("resolveListBoxSpacingMetric — padding style override", () => {
  it("style.padding shorthand → 4-way 동일 적용", () => {
    const m = resolveListBoxSpacingMetric({ style: { padding: 16 } });
    expect(m.paddingTop).toBe(16);
    expect(m.paddingRight).toBe(16);
    expect(m.paddingBottom).toBe(16);
    expect(m.paddingLeft).toBe(16);
  });

  it("style.paddingTop 단독 → top 만 override, 나머지 defaults", () => {
    const m = resolveListBoxSpacingMetric({ style: { paddingTop: 20 } });
    expect(m.paddingTop).toBe(20);
    expect(m.paddingRight).toBe(0); // longhand 하나라도 존재 → 나머지 0 (Layer B 정책)
    expect(m.paddingBottom).toBe(0);
    expect(m.paddingLeft).toBe(0);
  });

  it("padding 4-way longhand 전체 → 각자 값 반영", () => {
    const m = resolveListBoxSpacingMetric({
      style: {
        paddingTop: 10,
        paddingRight: 14,
        paddingBottom: 6,
        paddingLeft: 12,
      },
    });
    expect(m.paddingTop).toBe(10);
    expect(m.paddingRight).toBe(14);
    expect(m.paddingBottom).toBe(6);
    expect(m.paddingLeft).toBe(12);
  });
});

describe("resolveListBoxSpacingMetric — fontSize 분기", () => {
  it("fontSize 12 → Text line box 1.5×12=18, itemHeight 26", () => {
    const m = resolveListBoxSpacingMetric({ defaultFontSize: 12 });
    expect(m.itemHeight).toBe(26); // paddingY(4) * 2 + lineHeight(18=1.5×12)
  });

  it("fontSize 16 → itemMetric base (lineHeight 24, itemHeight 32)", () => {
    const m = resolveListBoxSpacingMetric({ defaultFontSize: 16 });
    expect(m.itemHeight).toBe(32);
  });

  it("fontSize 18 → Text line box 1.5×18=27, itemHeight 35", () => {
    const m = resolveListBoxSpacingMetric({ defaultFontSize: 18 });
    // 과거 getLabelLineHeight(18)=28(text-lg 토큰)으로 36 이던 것을 origin/CSS(1.5×18=27) 정합상 35.
    expect(m.itemHeight).toBe(35);
  });

  it("style.fontSize 18 → fontSize 18 + 비례 header metric", () => {
    const m = resolveListBoxSpacingMetric({ style: { fontSize: 18 } });
    expect(m.fontSize).toBe(18);
    expect(m.headerHeight).toBe(Math.round(18 * 1.75));
    expect(m.sectionTopPad).toBe(Math.round(18 * 0.5));
  });
});

describe("resolveListBoxSpacingMetric — description-aware item height (ADR-147)", () => {
  // render.shapes description 행 높이 = paddingY*2 + lineHeight + gap + lineHeight.
  //   ListBox 컨테이너가 description 항목을 잘리지 않게 수용하려면 동일 공식 필요.
  it("fontSize 14 → itemHeightWithDescription = 4*2 + 21 + 2 + 21 = 52", () => {
    const m = resolveListBoxSpacingMetric({});
    // resolveListBoxItemMetric 은 label/description 동일 fontSize(14→21) → 8+21+2+21=52.
    expect(m.itemHeightWithDescription).toBe(52);
    expect(m.itemHeight).toBe(29); // label-only (회귀 확인)
  });

  it("fontSize 16 → itemHeightWithDescription = 4*2 + 24 + 2 + 24 = 58", () => {
    const m = resolveListBoxSpacingMetric({ defaultFontSize: 16 });
    expect(m.itemHeightWithDescription).toBe(58);
  });
});

describe("resolveListBoxSpacingMetric — borderWidth", () => {
  it("default borderWidth 1", () => {
    const m = resolveListBoxSpacingMetric({});
    expect(m.borderWidth).toBe(1);
  });

  it("style.borderWidth 2 → 2 반영", () => {
    const m = resolveListBoxSpacingMetric({ style: { borderWidth: 2 } });
    expect(m.borderWidth).toBe(2);
  });

  it("style.borderWidth '3px' 문자열 → 3", () => {
    const m = resolveListBoxSpacingMetric({ style: { borderWidth: "3px" } });
    expect(m.borderWidth).toBe(3);
  });
});

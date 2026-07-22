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

  it("container fontSize 14 → itemHeight 32 (label react-aria-Text 16 → line box 24)", () => {
    const m = resolveListBoxSpacingMetric({});
    // 2026-07-22 라이브 실측: label 은 container/item fontSize 미상속 (react-aria-Text 기본 16) →
    //   getTextLineHeight(16)=24 → itemHeight pad4*2+24=32 (과거 29 는 label 14 기준 stale).
    expect(m.itemHeight).toBe(32); // paddingY(4) * 2 + label line box(24)
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
  it("container fontSize 12 이어도 itemHeight 32 (label 미상속, react-aria-Text 16)", () => {
    const m = resolveListBoxSpacingMetric({ defaultFontSize: 12 });
    // label 은 container fontSize 미상속 → 항상 react-aria-Text 16 → line box 24 → itemHeight 32.
    expect(m.itemHeight).toBe(32); // paddingY(4) * 2 + label line box(24)
  });

  it("container fontSize 16 → itemHeight 32 (label react-aria-Text 16 = container 우연 일치)", () => {
    const m = resolveListBoxSpacingMetric({ defaultFontSize: 16 });
    expect(m.itemHeight).toBe(32);
  });

  it("container fontSize 무관 — itemHeight 32 (label react-aria-Text 16 고정)", () => {
    const m = resolveListBoxSpacingMetric({ defaultFontSize: 18 });
    // label 은 container/item fontSize 미상속 (react-aria-Text 기본 16 — 라이브 실측 2026-07-22) →
    //   getTextLineHeight(16)=24 → itemHeight pad4*2+24=32. container fontSize 18 이어도 불변.
    //   명시 slot label size 는 row resolver 가 per-item 반영 (aggregate 는 기본 크기 컨테이너용).
    expect(m.itemHeight).toBe(32);
  });

  it("style.fontSize 18 → fontSize 18 + 비례 header metric", () => {
    const m = resolveListBoxSpacingMetric({ style: { fontSize: 18 } });
    expect(m.fontSize).toBe(18);
    expect(m.headerHeight).toBe(Math.round(18 * 1.75));
    expect(m.sectionTopPad).toBe(Math.round(18 * 0.5));
  });
});

describe("resolveListBoxSpacingMetric — description-aware item height (ADR-147)", () => {
  // description 행 = paddingY*2 + label(24) + gap + desc(16). label 은 react-aria-Text 16(1.5×),
  //   description 은 CSS [slot=desc] line-height 1.333× → 12→16 (라이브 실측 2026-07-22).
  //   row resolver(resolveListBoxItemRowHeightFromStyle) 기본값과 동일 — ADR-147 계약 성립.
  it("itemHeightWithDescription = 4*2 + 24 + 2 + 16 = 50 (label 16 / desc 12)", () => {
    const m = resolveListBoxSpacingMetric({});
    expect(m.itemHeightWithDescription).toBe(50);
    expect(m.itemHeight).toBe(32); // label-only (회귀 확인)
  });

  it("container fontSize 16 이어도 itemHeightWithDescription 50 불변 (label 미상속)", () => {
    const m = resolveListBoxSpacingMetric({ defaultFontSize: 16 });
    expect(m.itemHeightWithDescription).toBe(50);
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

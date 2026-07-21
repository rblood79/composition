/**
 * ADR-907 Phase 3 Wave C-1 — calculateContentHeight GridList 분기 contract.
 *
 * Wave B 에서 `calculateContentHeight` GridList 분기가 `resolveGridListSpacingMetric`
 * 단일 경로로 전환됐다. 본 테스트는:
 *  (a) baseline: 4-item stack, 기본 style → deterministic height
 *  (b) style.gap 편집 → height 변화량이 `(entryCount - 1) * Δgap` 과 일치
 *  (c) style.padding 편집 → height 변화량이 `2 * padding` 과 일치 (4-way symmetric)
 *  (d) style.padding shorthand + paddingTop longhand override → top override 반영
 *  (e) style.fontSize 편집 → resolveGridListItemMetric 분기 재진입 반영
 *  (f) layout=grid + columns=2 → row wrap 반영
 *  (g) **3-경로 metric 동일성**: `calculateContentHeight` 가 내부적으로 사용하는 값이
 *      `resolveGridListSpacingMetric` 직접 호출 결과와 byte-equal (Skia/Layout 대칭 확증)
 */

import { describe, expect, it } from "vitest";
import { resolveGridListSpacingMetric } from "@composition/specs";
import { calculateContentHeight } from "../utils";
import type { Element } from "../../../../../../types/core/store.types";

type GridListItem = { id: string; label: string; description?: string };

function makeGridList(
  props: {
    layout?: "stack" | "grid";
    columns?: number;
    items?: GridListItem[];
    style?: Record<string, unknown>;
  } = {},
): Element {
  return {
    id: "gl-1",
    type: "GridList",
    props: {
      layout: props.layout ?? "stack",
      columns: props.columns,
      items: props.items ?? [
        { id: "i1", label: "Item 1", description: "Description" },
        { id: "i2", label: "Item 2", description: "Description" },
        { id: "i3", label: "Item 3", description: "Description" },
        { id: "i4", label: "Item 4", description: "Description" },
      ],
      style: props.style,
    },
    childrenIds: [],
  } as Element;
}

// 기본 item card height 공식 — resolveGridListItemMetric(14) 분기 기준
//   cardPaddingY=12. label/description 은 react-aria-Text 기본 16 (컨테이너 fontSize 미상속),
//   GridList slot 은 line-height override 없어 line box = getTextLineHeight(16)=24. descGap=2
//   (--spacing-2xs). cardHeight = 12*2 + 24 + (24 + 2) = 74 (2026-07-22 collection-item parity
//   sweep — 라이브 getSharedLayoutMap origin=76 = 74 content+padding + border 2 정합. 과거 64 는
//   base 14/desc 12·getLabelLineHeight·descGap 4 가정으로 CSS/origin 대비 -10 오차였다).
const BASELINE_CARD_H = 74;

describe("calculateContentHeight — GridList stack baseline", () => {
  it("4-item stack / no style → 4*74 + 3*12 = 332", () => {
    const h = calculateContentHeight(makeGridList());
    expect(h).toBe(4 * BASELINE_CARD_H + 3 * 12);
  });

  it("style.gap=20 → height += 3 * (20 - 12) = 24", () => {
    const base = calculateContentHeight(makeGridList());
    const edited = calculateContentHeight(makeGridList({ style: { gap: 20 } }));
    expect(edited - base).toBe(3 * (20 - 12));
  });

  it("style.padding=10 shorthand → height += 2 * 10 = 20", () => {
    const base = calculateContentHeight(makeGridList());
    const edited = calculateContentHeight(
      makeGridList({ style: { padding: 10 } }),
    );
    expect(edited - base).toBe(2 * 10);
  });

  it("style.padding=10 + paddingTop=30 → paddingTop override, bottom 그대로", () => {
    const base = calculateContentHeight(makeGridList());
    const edited = calculateContentHeight(
      makeGridList({ style: { padding: 10, paddingTop: 30 } }),
    );
    // paddingTop(30) + paddingBottom(10) = 40 추가
    expect(edited - base).toBe(30 + 10);
  });

  it("style.borderWidth=2 → height += 2 * 2 = 4", () => {
    const base = calculateContentHeight(makeGridList());
    const edited = calculateContentHeight(
      makeGridList({ style: { borderWidth: 2 } }),
    );
    expect(edited - base).toBe(4);
  });

  it("style.fontSize=18 → large 카드 분기 (paddingY 16), label/desc 는 16 고정 (react-aria-Text)", () => {
    const h = calculateContentHeight(makeGridList({ style: { fontSize: 18 } }));
    // label/description 은 컨테이너 fontSize(18) 를 상속하지 않고 react-aria-Text 기본 16 →
    //   line box 24 (getTextLineHeight(16)). fontSize>14 는 padding(16)·borderRadius 만 키운다.
    // cardHeight = 16*2 + 24 + (24 + 2) = 82. innerHeight = 4*82 + 3*12 = 364 (gap default 12)
    expect(h).toBe(4 * 82 + 3 * 12);
  });
});

describe("calculateContentHeight — GridList grid layout", () => {
  it("layout=grid / columns=2 / 4 items → 2 rows × cardH + 1 gap", () => {
    const h = calculateContentHeight(
      makeGridList({ layout: "grid", columns: 2 }),
    );
    // 2 rows × 74 + 1 gap × 12 = 160
    expect(h).toBe(2 * BASELINE_CARD_H + 12);
  });

  it("layout=grid / columns=3 / 4 items → 2 rows (3+1) × cardH + 1 gap", () => {
    const h = calculateContentHeight(
      makeGridList({ layout: "grid", columns: 3 }),
    );
    // row1: 3 items (max cardH=74), row2: 1 item (74) → 2*74 + 1*12 = 160
    expect(h).toBe(2 * BASELINE_CARD_H + 12);
  });
});

describe("calculateContentHeight — 3-경로 metric 대칭 (Skia/Layout)", () => {
  it("resolveGridListSpacingMetric 직접 호출 결과와 layout 계산이 일관", () => {
    const style = { gap: 24, padding: 8 };
    const metric = resolveGridListSpacingMetric({
      style,
      layout: "stack",
      columns: 2,
      defaultGap: 12,
      defaultFontSize: 14,
    });
    // Layout 이 사용하는 값 확인
    expect(metric.rowGap).toBe(24);
    expect(metric.paddingTop).toBe(8);
    expect(metric.paddingBottom).toBe(8);
    expect(metric.fontSize).toBe(14);
    expect(metric.cardPaddingY).toBe(12);
    expect(metric.descGap).toBe(2);

    // calculateContentHeight 결과가 동일 metric 공식 사용 확증
    const h = calculateContentHeight(makeGridList({ style }));
    // innerHeight = 4*74 + 3*24 = 368, + padding 8*2 = 16 → 384
    expect(h).toBe(
      4 * BASELINE_CARD_H +
        3 * metric.rowGap +
        metric.paddingTop +
        metric.paddingBottom,
    );
  });
});

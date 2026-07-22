// ADR-160 Phase 4 — differential 계약 테스트: layout(M1) 행 높이 == escape(paint) 행 높이.
//
// M1(resolveListBoxItemRowHeightFromStyle / calculateContentHeight)과 escape(listbox_item /
// gridlist_card)가 **동일 SSOT `resolveCollectionRowMetric`** 을 호출하므로, 같은 입력에 대해
// 같은 행 높이를 산출해야 한다. 두 경로를 각각 호출해 직접 대조한다 — 어느 한쪽이 SSOT 를 벗어나면
// 이 테스트가 실패한다(회귀 가드).
//
// 측정기는 폭-불문 mock 을 주입해 **geometry parity** 를 격리한다(§2.1 발견 1 icon/check maxWidth
// residual 은 wrap 폭에만 영향 — mock 이 폭을 무시하므로 높이 parity 는 icon/check 유무와 무관).
// escape 높이 추출: ListBox 는 selected check y(=rowHeight/2), GridList 는 card-bg height(=cardHeight).
import { describe, it, expect, afterEach } from "vitest";

import {
  getSkiaPrimitive,
  setSpecWrappedTextHeightMeasurer,
} from "@composition/specs";
import type { SizeSpec } from "@composition/specs";

import {
  resolveListBoxItemRowHeightFromStyle,
  calculateContentHeight,
} from "../utils";

const listBoxSize: SizeSpec = {
  height: 0,
  paddingX: 12,
  paddingY: 4,
  fontSize: 14 as never,
  gap: 2,
  iconSize: 16,
  borderRadius: 4 as never,
  borderWidth: 0,
};
const gridSize: SizeSpec = {
  height: 0,
  paddingX: 16,
  paddingY: 12,
  fontSize: 14 as never,
  gap: 2,
  iconSize: 16,
  borderRadius: 8 as never,
  borderWidth: 1,
};

const listBoxDraw = getSkiaPrimitive("listbox_item")!;
const gridDraw = getSkiaPrimitive("gridlist_card")!;

type AnyShape = {
  type?: string;
  id?: string;
  iconName?: string;
  y?: number;
  height?: number;
};

// escape ListBox 행 높이 = selected check y × 2 (check y = rowHeight/2, skiaPrimitives 계약).
function escapeListBoxRowHeight(shapes: unknown): number {
  const check = (shapes as AnyShape[]).find(
    (s) => s.type === "icon_font" && s.iconName === "check",
  );
  if (!check || typeof check.y !== "number")
    throw new Error("check shape 없음 (isSelected 필요)");
  return check.y * 2;
}
// escape GridList 카드 높이 = card-bg height (flat-props 는 number, shell 은 "auto").
function escapeGridCardHeight(shapes: unknown): number {
  const bg = (shapes as AnyShape[]).find((s) => s.id === "card-bg");
  if (!bg || typeof bg.height !== "number")
    throw new Error("card-bg height 가 number 아님");
  return bg.height;
}

describe("ADR-160 differential — M1 layout 높이 == escape paint 높이", () => {
  afterEach(() => setSpecWrappedTextHeightMeasurer(null));

  it("ListBox 단일 줄 2-entry: M1 rowHeight === escape check y×2", () => {
    // 측정기 미주입 → 단일 줄. 넓은 폭 → wrap 없음(icon/check reserve 무영향).
    const style = {};
    const mHeight = resolveListBoxItemRowHeightFromStyle(style, true, {
      label: 16,
      description: 12,
    });
    const shapes = listBoxDraw({
      props: {
        children: "Short label",
        description: "Short desc",
        isSelected: true,
      },
      size: listBoxSize,
      visual: undefined,
      style: { width: 400 },
    } as Parameters<typeof listBoxDraw>[0]);
    // pad 8 + label 24 + gap 2 + desc 16 = 50
    expect(mHeight).toBe(50);
    expect(mHeight).toBe(escapeListBoxRowHeight(shapes));
  });

  it("ListBox wrap(label 3줄 72): M1 rowHeight === escape check y×2 (selected)", () => {
    setSpecWrappedTextHeightMeasurer((text, _fs, _fw, _ff, _mw, lh) =>
      text === "Wrapping label" ? 72 : (lh ?? 16),
    );
    const style = {};
    const mHeight = resolveListBoxItemRowHeightFromStyle(
      style,
      true,
      { label: 16, description: 12 },
      {
        label: "Wrapping label",
        description: "Short desc",
        availableWidth: 400,
      },
    );
    const shapes = listBoxDraw({
      props: {
        children: "Wrapping label",
        description: "Short desc",
        isSelected: true,
      },
      size: listBoxSize,
      visual: undefined,
      style: { width: 400 },
    } as Parameters<typeof listBoxDraw>[0]);
    // pad 8 + label 72 + gap 2 + desc 16 = 98
    expect(mHeight).toBe(98);
    expect(mHeight).toBe(escapeListBoxRowHeight(shapes));
  });

  it("GridList wrap(label 40): M1 contentHeight === escape cardHeight − 2×cardPaddingY", () => {
    setSpecWrappedTextHeightMeasurer((text, _fs, _fw, _ff, _mw, lh) =>
      text === "Card label" ? 40 : (lh ?? 24),
    );
    const element = {
      type: "gridlistitem",
      props: { children: "Card label", description: "Card desc", style: {} },
    } as unknown as Parameters<typeof calculateContentHeight>[0];
    // content-box (padding 제외): label 40 + descGap 2 + desc 24 = 66
    const mContent = calculateContentHeight(element, 200);
    const shapes = gridDraw({
      props: { children: "Card label", description: "Card desc" },
      size: gridSize,
      visual: undefined,
      style: { width: 200 },
    } as Parameters<typeof gridDraw>[0]);
    expect(mContent).toBe(66);
    // escape cardHeight = cardPaddingY(12)×2 + content(66) = 90
    expect(escapeGridCardHeight(shapes)).toBe(90);
    // content-box parity: cardHeight − 상하 padding = M1 content
    expect(mContent).toBe(escapeGridCardHeight(shapes) - 12 * 2);
  });
});

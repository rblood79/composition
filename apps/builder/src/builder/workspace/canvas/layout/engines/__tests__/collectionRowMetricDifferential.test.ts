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
import type { CatalogResolvedPaint, SizeSpec } from "@composition/specs";

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
const TEST_PAINT: CatalogResolvedPaint = {
  backgroundAlpha: 1,
  staticTrackWash: false,
  hasVisibleBoxPaint: false,
  hasOpaqueCatalogBackground: false,
};

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
      paint: TEST_PAINT,
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
      paint: TEST_PAINT,
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
      paint: TEST_PAINT,
      style: { width: 200 },
    } as Parameters<typeof gridDraw>[0]);
    expect(mContent).toBe(66);
    // escape cardHeight = cardPaddingY(12)×2 + content(66) = 90
    expect(escapeGridCardHeight(shapes)).toBe(90);
    // content-box parity: cardHeight − 상하 padding = M1 content
    expect(mContent).toBe(escapeGridCardHeight(shapes) - 12 * 2);
  });
});

// ADR-160 후속(2026-07-23) — icon/check-aware inset + GridList descGap 봉쇄 검증.
//
// 위 describe 는 폭-불문 mock 으로 geometry parity 만 격리했다(§2.1 발견 1 residual 은 폭에만 영향).
// 본 describe 는 **폭-민감 측정기**를 주입해, icon+selected 행에서 M1 이 escape 와 동일한 wrap
// maxWidth(= W − textX − paddingRight − rightReserve)를 산출하는지 검증한다. inset 미적용(구 M1)이면
// maxWidth 가 더 넓어(W−padL−padR) label wrap 줄 수가 적게 나와 행이 escape 보다 짧다 — 그 갭이 봉쇄됐다.
describe("ADR-160 후속 — icon/check inset + descGap SSOT parity", () => {
  afterEach(() => setSpecWrappedTextHeightMeasurer(null));

  // 폭에 반비례해 줄 수를 산정하는 측정기(문자폭 = fontSize×0.6). maxWidth 가 작을수록 줄 수↑ 높이↑.
  const widthSensitive = (
    text: string,
    fs: number,
    _fw: number | string,
    _ff: string,
    maxWidth: number,
    lh?: number,
  ): number => {
    const lineHeight = lh ?? Math.round(fs * 1.5);
    if (!text) return lineHeight;
    const charW = fs * 0.6;
    const perLine = Math.max(1, Math.floor(maxWidth / charW));
    const lines = Math.max(1, Math.ceil(text.length / perLine));
    return lines * lineHeight;
  };

  it("ListBox icon+selected wrap: M1(inset) === escape, inset 미적용은 더 짧음", () => {
    setSpecWrappedTextHeightMeasurer(widthSensitive);
    const W = 160;
    const label = "Wrapping collection row label"; // 29자
    const description = "Short desc";
    // escape: icon("star") + isSelected → textX=34(12+16+6), rightReserve=22(16+6). maxWidth=160−34−12−22=92.
    const shapes = listBoxDraw({
      props: {
        children: label,
        description,
        isSelected: true,
        icon: "star",
      },
      size: listBoxSize,
      visual: undefined,
      paint: TEST_PAINT,
      style: { width: W },
    } as Parameters<typeof listBoxDraw>[0]);
    const escapeH = escapeListBoxRowHeight(shapes);

    // M1 with inset(escape 와 동일 컨텍스트) — 봉쇄된 경로.
    const m1WithInset = resolveListBoxItemRowHeightFromStyle(
      {},
      true,
      { label: 16, description: 12 },
      { label, description, availableWidth: W },
      { hasIcon: true, iconSize: 16, showCheck: true, slotInset: 12 },
    );
    // M1 without inset(구 동작) — maxWidth 더 넓음(160−12−12=136) → label 줄 수↓ → 더 짧음.
    const m1NoInset = resolveListBoxItemRowHeightFromStyle(
      {},
      true,
      { label: 16, description: 12 },
      { label, description, availableWidth: W },
    );

    // 봉쇄: M1(inset) == escape.
    expect(m1WithInset).toBe(escapeH);
    // 회귀 가드: inset 미적용은 escape 보다 엄격히 짧다(icon/check 예약분만큼 wrap 이 덜 됨).
    expect(m1NoInset).toBeLessThan(escapeH);
  });

  it("GridList within-card gap: M1 은 style.gap(20)을 무시하고 descGap(2) 사용 = escape", () => {
    setSpecWrappedTextHeightMeasurer((text, _fs, _fw, _ff, _mw, lh) =>
      text === "Card label" ? 40 : (lh ?? 24),
    );
    // style.gap=20 을 주어도 within-card label↔desc gap 은 resolveGridListItemMetric.descGap(2) 고정.
    const element = {
      type: "gridlistitem",
      props: {
        children: "Card label",
        description: "Card desc",
        style: { gap: 20 },
      },
    } as unknown as Parameters<typeof calculateContentHeight>[0];
    // content-box: label 40 + descGap 2 + desc 24 = 66 (gap 20 무시).
    const mContent = calculateContentHeight(element, 200);
    const shapes = gridDraw({
      props: { children: "Card label", description: "Card desc" },
      size: gridSize,
      visual: undefined,
      paint: TEST_PAINT,
      style: { width: 200, gap: 20 },
    } as Parameters<typeof gridDraw>[0]);
    expect(mContent).toBe(66);
    expect(mContent).toBe(escapeGridCardHeight(shapes) - 12 * 2);
  });
});

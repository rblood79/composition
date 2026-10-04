import { describe, expect, it, afterEach } from "vitest";

import { getSkiaPrimitive } from "./catalogPaintFixture";
import {
  setSpecWrappedTextHeightMeasurer,
  measureSpecWrappedTextHeight,
} from "../utils/measureText";
import type { Shape, SizeSpec } from "../../types";

/**
 * gridlist_card escape — wrap 블록 높이 기반 스택 offset (2026-07-22 collection-item parity sweep).
 *
 * ListBoxItem 과 동일한 "단일 줄 가정" 3계층 문제(layout 공식 / owner enrich / escape paint)가
 * GridList 카드에도 복제돼 있었다. 본 파일은 계층 3(escape paint) 회귀 게이트 — label 이 wrap
 * (멀티라인)될 때 description 이 label 아래 줄 위에 겹치지 않도록, 스택 offset·카드 높이·text
 * maxWidth 가 주입 측정기(builder = paint 동일 CanvasKit 엔진)의 블록 높이를 소비하는지 검증.
 * gridlist_card 텍스트는 top-anchored(baseline 미지정)라 y=블록 top 직접 (listbox_item 의 middle
 * 대비 단순). 미주입 시 단일 줄 fallback = 기존 동작(BC).
 */

// GridListItem rule.sizes.md 미러 (paddingY 12, gap 2). label/description 기본 fontSize 16
//   (react-aria-Text 기본, GridList slot override 없음) → getTextLineHeight(16)=24.
const sizeMd: SizeSpec = {
  height: 0,
  paddingX: 16,
  paddingY: 12,
  fontSize: "{typography.text-sm}" as never,
  borderRadius: "{radius.lg}" as never,
  gap: 2,
  borderWidth: 1,
};

const draw = getSkiaPrimitive("gridlist_card")!;

type AnyShape = {
  type?: string;
  text?: string;
  x?: number;
  y?: number;
  height?: number;
  maxWidth?: number;
  lineHeight?: number;
};

function texts(shapes: Shape[] | null): AnyShape[] {
  return ((shapes ?? []) as AnyShape[]).filter((s) => s.type === "text");
}

const LABEL_LH = 24; // getTextLineHeight(16)
const DESC_LH = 24;
const PAD_Y = 12;
const DESC_GAP = 2;

const flatProps = {
  children: "긴 라벨 텍스트입니다",
  description: "긴 설명 텍스트입니다",
};

describe("gridlist_card — wrap 블록 높이 기반 스택 offset", () => {
  afterEach(() => setSpecWrappedTextHeightMeasurer(null));

  it("미주입(fallback) — description y = paddingY + label 1줄 + gap (top-anchored, BC)", () => {
    const t = texts(
      draw({
        props: flatProps,
        size: sizeMd,
        visual: undefined,
        style: { width: 300 },
      } as Parameters<typeof draw>[0]),
    );
    expect(t[0]?.y).toBe(PAD_Y); // label top
    expect(t[1]?.y).toBe(PAD_Y + LABEL_LH + DESC_GAP); // 38
  });

  it("주입 측정기가 label 3줄(72) 반환 → description y 가 블록 높이 뒤로 이동", () => {
    setSpecWrappedTextHeightMeasurer((text, _fs, _fw, _ff, _mw, lineHeight) =>
      text === flatProps.children ? 72 : (lineHeight ?? 24),
    );
    const t = texts(
      draw({
        props: flatProps,
        size: sizeMd,
        visual: undefined,
        style: { width: 300 },
      } as Parameters<typeof draw>[0]),
    );
    expect(t[0]?.y).toBe(PAD_Y); // label top 불변
    expect(t[1]?.y).toBe(PAD_Y + 72 + DESC_GAP); // 86 — 단일 줄 24 아님
  });

  it("card-bg 높이 = paddingY*2 + wrap 블록 합 (단일 줄 아님)", () => {
    setSpecWrappedTextHeightMeasurer((text, _fs, _fw, _ff, _mw, lineHeight) =>
      text === flatProps.children ? 72 : (lineHeight ?? 24),
    );
    const shapes = draw({
      props: flatProps,
      size: sizeMd,
      visual: undefined,
      style: { width: 300 },
    } as Parameters<typeof draw>[0]);
    const cardBg = (
      (shapes ?? []) as Array<{ id?: string; height?: number }>
    ).find((s) => s.id === "card-bg");
    // 12*2 + (72 + 2 + 24) = 122
    expect(cardBg?.height).toBe(122);
  });

  it("text shape 가 maxWidth(카드 폭 − 좌우 padding) + lineHeight 명시", () => {
    const t = texts(
      draw({
        props: flatProps,
        size: sizeMd,
        visual: undefined,
        style: { width: 300 },
      } as Parameters<typeof draw>[0]),
    );
    // 300 − 16*2 = 268
    expect(t[0]?.maxWidth).toBe(268);
    expect(t[0]?.lineHeight).toBe(LABEL_LH);
    expect(t[1]?.maxWidth).toBe(268);
    expect(t[1]?.lineHeight).toBe(DESC_LH);
  });

  it("style.width 부재(number 아님) → fallback 200 폭 기반 maxWidth", () => {
    const t = texts(
      draw({
        props: flatProps,
        size: sizeMd,
        visual: undefined,
        style: { width: "100%" },
      } as Parameters<typeof draw>[0]),
    );
    // 200 − 16*2 = 168
    expect(t[0]?.maxWidth).toBe(168);
  });

  it("measureSpecWrappedTextHeight — 미주입/빈 텍스트/무효 폭 → null", () => {
    expect(measureSpecWrappedTextHeight("x", 16, 600, "Inter", 100)).toBeNull();
    setSpecWrappedTextHeightMeasurer(() => 48);
    expect(measureSpecWrappedTextHeight("", 16, 600, "Inter", 100)).toBeNull();
    expect(measureSpecWrappedTextHeight("x", 16, 600, "Inter", 0)).toBeNull();
    expect(measureSpecWrappedTextHeight("x", 16, 600, "Inter", 100)).toBe(48);
  });
});

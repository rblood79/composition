import { describe, expect, it } from "vitest";

import {
  buildCatalogShapes,
  resolveSelectionSlot,
} from "../buildCatalogShapes";
import { getSkiaPrimitive, getSkiaPrimitiveMode } from "../skiaPrimitives";
import type { ComponentVisualRule } from "../utils/resolveComponentVisual";
import type { Shape, SizeSpec } from "../../types";

/**
 * design-data 감사 §1-2 축② — 행 맨 앞 selection checkbox (2026-08-21).
 *
 * DOM Tree 행 실측(md, padding-left 8 / gap 2):
 *   highlight → chevron x=8, label x=30
 *   checkbox  → checkbox x=8, chevron x=30, label x=52   (= +22 = box 20 + gap 2)
 *
 * 체크박스는 leading 슬롯(icon/avatar)과 **배타가 아니라 가산**이므로, 폭 예약을
 * text(buildCatalogShapes)와 chevron(leading_icon)이 **같은 helper** 로 더해야
 * "체크박스는 그렸는데 라벨이 그 위에 겹친다" 가 나지 않는다.
 */

const size = {
  height: 32,
  paddingX: 8,
  paddingY: 4,
  iconSize: 16,
  fontSize: 16,
  lineHeight: 24,
  borderRadius: 0,
} as unknown as SizeSpec;

const visual = {
  fill: { default: { base: "{color.transparent}" } },
  text: "{color.neutral}",
  leadingIcon: {
    name: "chevron-right",
    gap: 6,
    color: "{color.neutral-subdued}",
  },
  selectionCheckbox: {
    size: 20,
    gap: 2,
    fill: "{color.base}",
    border: "{color.border}",
    selectedFill: "{color.accent}",
    checkColor: "{color.on-accent}",
  },
} as unknown as ComponentVisualRule;

const shapesOf = (props: Record<string, unknown>) =>
  buildCatalogShapes(visual, props, size) as Array<
    Shape & { type: string; x?: number }
  >;

const textX = (props: Record<string, unknown>): number =>
  shapesOf(props).find((s) => s.type === "text")!.x as number;

const iconX = (props: Record<string, unknown>): number => {
  const draw = getSkiaPrimitive("leading_icon")!;
  const out = draw({
    props,
    size,
    visual,
    style: undefined,
  } as never) as Array<{
    x: number;
  }>;
  // icon_font 의 x 는 **중심** — 좌측 경계로 환산해 DOM 과 비교한다.
  return out[0].x - 16 / 2;
};

describe("selection checkbox 슬롯 — 가산 폭", () => {
  it("showProp 이 true 일 때만 슬롯이 선다", () => {
    expect(resolveSelectionSlot(visual, {})).toBeNull();
    expect(
      resolveSelectionSlot(visual, { _showSelectionCheckbox: false }),
    ).toBeNull();
    expect(
      resolveSelectionSlot(visual, { _showSelectionCheckbox: true }),
    ).toMatchObject({ size: 20, gap: 2, width: 22, isSelected: false });
    // 채널 미정의 컴포넌트는 신호가 있어도 무반응 (회귀 0)
    expect(
      resolveSelectionSlot({} as ComponentVisualRule, {
        _showSelectionCheckbox: true,
      }),
    ).toBeNull();
  });

  it("text 와 chevron 이 **같은 값**만큼 함께 밀린다 (DOM 실측 8/30/52)", () => {
    const off = { children: "Node A" };
    const on = { children: "Node A", _showSelectionCheckbox: true };

    // highlight: chevron 8, label 8+16+6 = 30
    expect(iconX(off)).toBe(8);
    expect(textX(off)).toBe(30);

    // checkbox: chevron 8+22 = 30, label 30+22 = 52
    expect(iconX(on)).toBe(30);
    expect(textX(on)).toBe(52);
  });

  it("primitive 는 box+border 를 그리고, 선택 시 체크 2선을 더한다", () => {
    const draw = getSkiaPrimitive("selection_checkbox")!;
    const base = { props: { _showSelectionCheckbox: true }, size, visual };

    const unchecked = draw({ ...base, style: undefined } as never) as Array<{
      type: string;
      x?: number;
      y?: number;
      fill?: string;
    }>;
    expect(unchecked.map((s) => s.type)).toEqual(["roundRect", "border"]);
    // 세로 중앙: (32 - 20) / 2 = 6, 가로 = paddingX
    expect(unchecked[0]).toMatchObject({ x: 8, y: 6, fill: "{color.base}" });

    const checked = draw({
      ...base,
      props: { _showSelectionCheckbox: true, isSelected: true },
      style: undefined,
    } as never) as Array<{ type: string; fill?: string; stroke?: string }>;
    expect(checked.map((s) => s.type)).toEqual([
      "roundRect",
      "border",
      "line",
      "line",
    ]);
    expect(checked[0].fill).toBe("{color.accent}");
    expect(checked[2].stroke).toBe("{color.on-accent}");

    // 신호 없으면 미생성 (append 라 base box+text 는 그대로 남는다)
    expect(
      draw({ props: {}, size, visual, style: undefined } as never),
    ).toHaveLength(0);
  });

  it("selection_checkbox 는 append — base box+text 를 대체하지 않는다", () => {
    expect(getSkiaPrimitiveMode("selection_checkbox")).toBe("append");
  });
});

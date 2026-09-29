import { describe, expect, it } from "vitest";

import { getSkiaPrimitive } from "./catalogPaintFixture";
import type { ComponentVisualRule } from "../utils/resolveComponentVisual";
import type { SizeSpec } from "../../types";

/**
 * breadcrumb_crumb — 현재 조각 (`_isLast`, RAC data-current) 의 label 굵기는 catalog
 * `Breadcrumb.variants.default.currentTextWeight` 다 (사용자 결정 2026-09-29, 700). 종전 600 하드코딩.
 */
const size: SizeSpec = {
  height: 24,
  fontSize: "{typography.text-base}" as never,
  borderRadius: "{radius.none}" as never,
};
const draw = getSkiaPrimitive("breadcrumb_crumb")!;
const labelWeight = (props: Record<string, unknown>, visual?: object) => {
  const shapes = draw({
    props: { children: "Home", size: "M", ...props },
    size,
    visual: visual as ComponentVisualRule | undefined,
    paint: {} as never,
    style: undefined,
  }) as Array<{ type?: string; text?: string; fontWeight?: number }>;
  return shapes.find((shape) => shape.type === "text" && shape.text === "Home")
    ?.fontWeight;
};

describe("breadcrumb_crumb current weight", () => {
  it("현재 조각은 visual.currentTextWeight 를 쓴다", () => {
    expect(labelWeight({ _isLast: true }, { currentTextWeight: 700 })).toBe(700);
  });
  it("현재가 아닌 조각은 400 그대로", () => {
    expect(labelWeight({ _isLast: false }, { currentTextWeight: 700 })).toBe(
      400,
    );
  });
});

/**
 * 2026-09-29 (사용자 결정) — 구분자 = Icon. 조합 자식 [label Text, 구분자 Icon] 조각은 자식이 그리고
 * (`_hasChildren` → 투명), 자식 없는 조각 (데이터 행 · legacy plain) 은 label 뒤 gap · catalog 기본 Icon.
 */
describe("breadcrumb_crumb separator icon", () => {
  const iconSize: SizeSpec = { ...size, iconSize: 18, gap: 4 } as SizeSpec;
  const shapesOf = (props: Record<string, unknown>) =>
    draw({
      props: { children: "Home", size: "L", ...props },
      size: iconSize,
      visual: {
        trailingIcon: { name: "chevron-right", color: "{color.neutral-subdued}" },
      } as unknown as ComponentVisualRule,
      paint: {} as never,
      style: undefined,
    }) as Array<Record<string, unknown>>;

  it("조합 자식이 있으면 아무것도 그리지 않는다 (자식 Text · Icon 이 그린다)", () => {
    expect(shapesOf({ _hasChildren: true })).toEqual([]);
  });

  it("자식 없는 비-마지막 조각: label 뒤 gap 을 두고 catalog Icon (iconSize) 을 그린다 — '›' 글자 없음", () => {
    const shapes = shapesOf({ _isLast: false });
    const label = shapes.find((s) => s.type === "text")!;
    const icon = shapes.find((s) => s.type === "icon_font")!;
    expect(shapes.some((s) => s.text === "›")).toBe(false);
    expect(icon).toMatchObject({
      iconName: "chevron-right",
      fontSize: 18,
      fill: "{color.neutral-subdued}",
    });
    const labelWidth = (label.maxWidth as number) - (label.fontSize as number);
    expect(icon.x).toBeCloseTo(labelWidth + 4 + 9, 5);
  });

  it("데이터 행 `_separatorIcon`: null 이면 구분자 없음 · 이름이면 그 Icon", () => {
    expect(
      shapesOf({ _separatorIcon: null }).some((s) => s.type === "icon_font"),
    ).toBe(false);
    expect(
      shapesOf({ _separatorIcon: "slash" }).find((s) => s.type === "icon_font"),
    ).toMatchObject({ iconName: "slash" });
  });

  it("마지막 조각은 구분자를 그리지 않는다", () => {
    expect(shapesOf({ _isLast: true }).some((s) => s.type === "icon_font")).toBe(
      false,
    );
  });
});

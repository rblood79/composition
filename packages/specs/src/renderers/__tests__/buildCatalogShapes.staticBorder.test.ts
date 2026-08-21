import { describe, expect, it } from "vitest";

import { buildCatalogShapes } from "../buildCatalogShapes";
import type { ComponentVisualRule } from "../utils/resolveComponentVisual";
import type { Shape, SizeSpec } from "../../types";

/**
 * design-data 감사 §1-2 축③ (2026-08-21) — staticColor 가 테두리를 만들어내는 조건.
 *
 * ToggleButtonGroup 에 staticColor 를 채택하면서(그룹→자식 상속 채널) 그룹 노드 자신도
 * `staticColor` prop 을 갖게 된다. 그룹의 변형 색은 fill/border 모두 transparent 이고
 * `sizes[*]` 에 borderWidth 채널이 없어 DOM 은 테두리를 그리지 않는데, Skia 는
 * `size.borderWidth ?? 1` fallback 탓에 static 색 사각형을 그릴 수 있었다 → 새 비대칭.
 *
 * 계약: static 이 테두리를 대체하는 것은 **border-width 채널을 가진 컴포넌트** 또는
 * **불투명 border 색을 가진 컴포넌트** 뿐이다 (컴포넌트 식별 아님 — 데이터 분기).
 */

const sizeWithBorder = {
  height: 32,
  paddingX: 12,
  paddingY: 0,
  borderWidth: 1,
  fontSize: "{typography.text-base}",
  borderRadius: "{radius.md}",
} as unknown as SizeSpec;

const sizeNoBorderChannel = {
  height: 0,
  fontSize: "{typography.text-base}",
  borderRadius: "{radius.lg}",
} as unknown as SizeSpec;

/** ToggleButton 형: 배경 opaque + border 채널 transparent + borderWidth 1. */
const toggleButtonVisual = {
  fill: { default: { base: "{color.neutral-subtle}" } },
  text: "{color.neutral}",
  border: "{color.transparent}",
} as unknown as ComponentVisualRule;

/** ToggleButtonGroup 형: 배경/테두리 모두 transparent + borderWidth 채널 없음. */
const groupVisual = {
  fill: { default: { base: "{color.transparent}" } },
  text: "{color.neutral}",
  border: "{color.transparent}",
} as unknown as ComponentVisualRule;

const borderOf = (shapes: Shape[]) =>
  shapes.find((s) => (s as { type?: string }).type === "border") as
    { color?: unknown } | undefined;

describe("staticColor × 테두리 대체 조건 (§1-2 축③)", () => {
  it("borderWidth 채널 보유(ToggleButton 형) → static 테두리 적용 (기존 대칭 유지)", () => {
    const shapes = buildCatalogShapes(
      toggleButtonVisual,
      { staticColor: "black", children: "A" },
      sizeWithBorder,
    ) as Shape[];
    expect(borderOf(shapes)?.color).toBe("#000000");
  });

  it("borderWidth 채널 없음 + transparent border(그룹 형) → static 테두리 미적용", () => {
    const shapes = buildCatalogShapes(
      groupVisual,
      { staticColor: "black", _hasChildren: true },
      sizeNoBorderChannel,
    ) as Shape[];
    expect(borderOf(shapes)?.color).not.toBe("#000000");
  });

  it("사용자가 borderWidth 를 지정하면 그룹 형도 static 테두리 대상", () => {
    const shapes = buildCatalogShapes(
      groupVisual,
      {
        staticColor: "white",
        _hasChildren: true,
        style: { borderWidth: 2 },
      },
      sizeNoBorderChannel,
    ) as Shape[];
    expect(borderOf(shapes)?.color).toBe("#ffffff");
  });
});

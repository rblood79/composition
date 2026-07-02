import { describe, expect, it } from "vitest";

import { buildCatalogShapes } from "../buildCatalogShapes";
import type { ComponentVisualRule } from "../utils/resolveComponentVisual";
import type { Shape, SizeSpec, TokenRef } from "../../types";

/**
 * Tag remove X(trailing_icon) glyph 크기 계약 — CSS(14px 고정) ↔ Skia 대칭 (2026-07-02).
 *
 * TagGroup `allowsRemoving` chip 우측 remove X 는 buildCatalogShapes trailingIcon 채널이
 *   `size.iconSize`(catalog Tag rule = 전 size 14) 를 glyph fontSize 로 사용해 그린다.
 *   CSS(DOM)는 `<X size={14}>` 로 모든 size 14px 고정 — 본 렌더 계약이 `size.iconSize` 를
 *   glyph fontSize 로 그대로 사용해야 catalog 데이터(14)가 Skia 에 도달해 CSS 와 대칭이 된다.
 *   회귀(예: `round(fontSize×0.75)` fallback 을 iconSize 있을 때도 적용) 시 md 11px 로 다시 작아짐.
 *
 * showProp(allowsRemoving) 게이트: false 면 trailing icon 미그림(chip=box+text 만).
 */

// Tag default variant 미러 (componentRulesTable.Tag.variants.default).
const tagVisual: ComponentVisualRule = {
  fill: {
    default: {
      base: "{color.layer-1}" as TokenRef,
      hover: "{color.layer-1}" as TokenRef,
      pressed: "{color.layer-1}" as TokenRef,
    },
  },
  text: "{color.neutral}" as TokenRef,
  textHover: undefined,
  textWeight: undefined,
  fontFamily: undefined,
  border: "{color.border}" as TokenRef,
  borderHover: undefined,
  borderStyle: undefined,
  fillBar: undefined,
  outlineText: undefined,
  outlineBorder: undefined,
  subtleText: undefined,
  selectedText: undefined,
  selectedBorder: undefined,
  emphasizedSelectedText: undefined,
  emphasizedSelectedBorder: undefined,
  leadingIcon: undefined,
  trailingIcon: {
    name: "x",
    gap: 2,
    color: "{color.neutral}" as TokenRef,
    showProp: "allowsRemoving",
  },
};

/** Tag rule sizes.md 미러 (iconSize 14 통일 후). */
const sizeMd: SizeSpec = {
  fontSize: 14,
  lineHeight: 20,
  borderRadius: 6,
  height: 28,
  paddingX: 12,
  paddingY: 4,
  iconSize: 14,
} as unknown as SizeSpec;

const findIcon = (shapes: Shape[]) =>
  shapes.find((s) => s.type === "icon_font" && s.iconName === "x") as
    | Shape
    | undefined;

describe("buildCatalogShapes — Tag remove X trailing icon 크기(size.iconSize)", () => {
  it("allowsRemoving=true 이면 remove X glyph fontSize = size.iconSize (14, CSS 14 대칭)", () => {
    const shapes = buildCatalogShapes(
      tagVisual,
      { children: "New Tag", allowsRemoving: true, _containerWidth: 82 },
      sizeMd,
      "default",
    );
    const icon = findIcon(shapes);
    expect(icon, "remove X icon_font shape 없음").toBeDefined();
    expect(icon!.fontSize).toBe(14);
  });

  it("size.iconSize 를 그대로 사용 (fontSize×0.75 fallback 아님 — 회귀 시 md 11 로 작아짐)", () => {
    // iconSize 12 를 주면 12 로 그린다(고정 상수 아님, catalog 데이터 read-through 증명).
    const size12 = { ...sizeMd, iconSize: 12 } as unknown as SizeSpec;
    const shapes = buildCatalogShapes(
      tagVisual,
      { children: "New Tag", allowsRemoving: true, _containerWidth: 82 },
      size12,
      "default",
    );
    expect(findIcon(shapes)!.fontSize).toBe(12);
  });

  it("allowsRemoving=false(showProp 미충족) 이면 remove X 미그림", () => {
    const shapes = buildCatalogShapes(
      tagVisual,
      { children: "New Tag", _containerWidth: 82 },
      sizeMd,
      "default",
    );
    expect(findIcon(shapes)).toBeUndefined();
  });
});

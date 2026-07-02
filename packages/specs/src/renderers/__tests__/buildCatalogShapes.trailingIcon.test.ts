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

describe("buildCatalogShapes — Tag remove X trailing icon 우측 위치(paddingY 여백)", () => {
  // 정본(CSS `.react-aria-Tag[data-allows-removing] padding-right: xs`(=paddingY 4) + layout SSOT
  //   resolveTagWrapLayout chipPaddingRight=paddingY): X 우측 여백 = paddingY, X 중심 =
  //   containerWidth - paddingY - iconSize/2. 구 `size.paddingX`(12) 사용은 X 를 안쪽으로 당겨
  //   label 침범(붙어 보임). 회귀 시 paddingX 로 되돌아가면 iconCx 가 8px 작아져 FAIL.
  it("_containerWidth 있으면 X 중심 = containerWidth - paddingY - iconSize/2 (우측 여백 paddingY)", () => {
    const cw = 94; // md "New Tag" allowsRemoving chip 실측 폭 근사
    const shapes = buildCatalogShapes(
      tagVisual,
      { children: "New Tag", allowsRemoving: true, _containerWidth: cw },
      sizeMd,
      "default",
    );
    const icon = findIcon(shapes)!;
    // paddingY=4, iconSize=14 → cx = 94 - 4 - 7 = 83. (구 paddingX=12 였다면 75 로 8px 안쪽.)
    expect(icon.x).toBe(cw - sizeMd.paddingY - 14 / 2);
    // X 우측 끝(cx + iconSize/2) 과 chip 우측(cw) 사이 여백 = paddingY (상하 여백과 대칭).
    const rightMargin = cw - (icon.x + 14 / 2);
    expect(rightMargin).toBe(sizeMd.paddingY);
  });

  it("우측 여백 소스 = paddingY (paddingX 아님) — 두 값 다를 때 paddingY 채택", () => {
    // paddingX 20 / paddingY 4 로 크게 벌려, paddingX 를 쓰면 cx 가 16px 안쪽으로 어긋남을 고정.
    const skewed = {
      ...sizeMd,
      paddingX: 20,
      paddingY: 4,
    } as unknown as SizeSpec;
    const cw = 100;
    const shapes = buildCatalogShapes(
      tagVisual,
      { children: "New Tag", allowsRemoving: true, _containerWidth: cw },
      skewed,
      "default",
    );
    // paddingY(4) 채택 → cx = 100 - 4 - 7 = 89. paddingX(20) 였다면 73.
    expect(findIcon(shapes)!.x).toBe(cw - 4 - 14 / 2);
  });

  it("사용자 명시 style.paddingRight 는 존중 (우측 여백 override)", () => {
    const cw = 100;
    const shapes = buildCatalogShapes(
      tagVisual,
      {
        children: "New Tag",
        allowsRemoving: true,
        _containerWidth: cw,
        style: { paddingRight: "10px" },
      },
      sizeMd,
      "default",
    );
    expect(findIcon(shapes)!.x).toBe(cw - 10 - 14 / 2);
  });
});

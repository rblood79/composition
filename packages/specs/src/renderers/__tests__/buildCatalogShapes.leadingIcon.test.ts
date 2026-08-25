import { describe, expect, it } from "vitest";

import { buildCatalogShapes } from "./catalogPaintFixture";
import { getSkiaPrimitive, getSkiaPrimitiveMode } from "./catalogPaintFixture";
import type { ComponentVisualRule } from "../utils/resolveComponentVisual";
import type { Shape, SizeSpec, TokenRef } from "../../types";

/**
 * ADR-912 (B+icon) — leading icon generic append 채널 실측 (DisclosureHeader proof slice).
 *
 * leading icon + text 복합(DisclosureHeader: chevron-right + title)을 컴포넌트별 if 없이
 * (1) `leading_icon` skiaPrimitive(append 모드)가 좌측 chevron 을 그리고
 * (2) buildCatalogShapes 가 `visual.leadingIcon` 존재 시 text 를 `iconSize + gap` 우측 shift + left align
 * 으로 재현하는지 검증. icon offset/iconName 은 rule metadata(visual.leadingIcon)로만 분기(ADR-142 §3).
 */

// leading icon 있는 minimal ComponentVisualRule (builder ruleVariantToVisual 산출 형태 미러).
const visualWithLeadingIcon: ComponentVisualRule = {
  fill: {
    default: {
      base: "{color.transparent}" as TokenRef,
      hover: "{color.transparent}" as TokenRef,
      pressed: "{color.transparent}" as TokenRef,
    },
  },
  text: "{color.neutral}" as TokenRef,
  textHover: undefined,
  textWeight: undefined,
  fontFamily: undefined,
  border: undefined,
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
  leadingIcon: {
    name: "chevron-right",
    gap: 6,
    color: "{color.neutral-subdued}" as TokenRef,
  },
};

// leading icon 없는 동일 visual (대조군).
const visualNoLeadingIcon: ComponentVisualRule = {
  ...visualWithLeadingIcon,
  leadingIcon: undefined,
};

// DisclosureHeader rule sizes.md 미러 (componentRulesTable.DisclosureHeader.sizes.md).
//   iconSize 18 = DOM chevron 실측 정본 (2026-07-02): trigger Button 기본 --icon-size 18px
//   (Button.css:40)이 Disclosure size 반응 값을 덮음 → 전 size 18 고정. 구 15 → 18.
const sizeMd: SizeSpec = {
  fontSize: 14,
  borderRadius: 0,
  height: 30,
  paddingX: 12,
  iconSize: 18,
} as unknown as SizeSpec;

describe("skiaPrimitive 'leading_icon' — DisclosureHeader chevron (append 모드)", () => {
  const draw = getSkiaPrimitive("leading_icon")!;

  it("append 모드로 등록 (base box+text 위 합성, replace 아님)", () => {
    expect(getSkiaPrimitiveMode("leading_icon")).toBe("append");
  });

  it("visual.leadingIcon 있으면 좌측 chevron 단일 icon_font shape", () => {
    const shapes = draw({
      props: {},
      size: sizeMd,
      visual: visualWithLeadingIcon,
      style: undefined,
    })!;
    expect(shapes).toHaveLength(1);
    expect(shapes[0].type).toBe("icon_font");
    expect(shapes[0].iconName).toBe("chevron-right");
    // 좌측 배치: x = paddingX(12) + iconSize(18)/2 = 21. icon_font(중앙 고정)와 달리 leading.
    expect(shapes[0].x).toBe(12 + 18 / 2);
    // y = height(30)/2 = 15 (box 수직 중앙, base text baseline:middle 정렬).
    expect(shapes[0].y).toBe(15);
    expect(shapes[0].fontSize).toBe(18);
    expect(shapes[0].fill).toBe("{color.neutral-subdued}");
  });

  it("visual.leadingIcon 없으면 빈 배열 (일반 box+text 미적용)", () => {
    const shapes = draw({
      props: {},
      size: sizeMd,
      visual: visualNoLeadingIcon,
      style: undefined,
    });
    expect(shapes).toEqual([]);
  });

  it("style.color override 가 leadingIcon.color 보다 우선", () => {
    const shapes = draw({
      props: {},
      size: sizeMd,
      visual: visualWithLeadingIcon,
      style: { color: "{color.accent}" },
    })!;
    expect(shapes[0].fill).toBe("{color.accent}");
  });
});

describe("buildCatalogShapes — leading icon text x-shift + left align", () => {
  it("visual.leadingIcon 있으면 text x 를 iconSize + gap 만큼 우측 shift", () => {
    const shapes = buildCatalogShapes(
      visualWithLeadingIcon,
      { children: "Section Title" },
      sizeMd,
      "default",
    );
    const text = shapes.find((s) => s.type === "text") as Shape;
    expect(text).toBeDefined();
    // x = paddingX(12) + iconSize(18) + gap(6) = 36. buildCatalogShapes text shift(iconSize+gap) 동형.
    expect(text.x).toBe(12 + 18 + 6);
    // leading icon 동반 text 는 항상 left align (box 기본 center 아님 — spec parity).
    expect(text.align).toBe("left");
  });

  it("visual.leadingIcon 없으면 text x = paddingX (shift 0)", () => {
    const shapes = buildCatalogShapes(
      visualNoLeadingIcon,
      { children: "Section Title" },
      sizeMd,
      "default",
    );
    const text = shapes.find((s) => s.type === "text") as Shape;
    expect(text.x).toBe(12);
  });

  it("base box+text 는 text shape 보유 (leading_icon append 와 합성 시 chevron + text 완성)", () => {
    const base = buildCatalogShapes(
      visualWithLeadingIcon,
      { children: "Section Title" },
      sizeMd,
      "default",
    );
    const icon = getSkiaPrimitive("leading_icon")!({
      props: {},
      size: sizeMd,
      visual: visualWithLeadingIcon,
      style: undefined,
    })!;
    // dispatch append 합성 결과 = base(box+text) + icon(chevron). chevron + title 동시 존재.
    const composed = [...base, ...icon];
    expect(composed.some((s) => s.type === "text")).toBe(true);
    expect(
      composed.some(
        (s) => s.type === "icon_font" && s.iconName === "chevron-right",
      ),
    ).toBe(true);
  });
});

describe("DisclosureHeader parity — generic(box+text + leading_icon) chevron/text 좌표", () => {
  it("chevron x/fontSize 와 text x 가 iconSize(18) 기준 정합", () => {
    // rule md: iconSize=18(DOM Button 기본 --icon-size), paddingX=12, gap=6, height=30.
    //   chevron x = 12 + 18/2 = 21 / text x = 12 + 18 + 6 = 36.
    const icon = getSkiaPrimitive("leading_icon")!({
      props: {},
      size: sizeMd,
      visual: visualWithLeadingIcon,
      style: undefined,
    })!;
    const base = buildCatalogShapes(
      visualWithLeadingIcon,
      { children: "Section" },
      sizeMd,
      "default",
    );
    const text = base.find((s) => s.type === "text") as Shape;
    expect(icon[0].x).toBe(21);
    expect(icon[0].fontSize).toBe(18);
    expect(text.x).toBe(36);
  });
});

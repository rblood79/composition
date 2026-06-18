import { describe, expect, it } from "vitest";

import { buildCatalogShapes } from "../buildCatalogShapes";
import type { ComponentVisualRule } from "../utils/resolveComponentVisual";
import type { SizeSpec, TokenRef } from "../../types";

/**
 * 회귀 방지 — input field value/placeholder text 좌측 정렬 (2026-06-18).
 *
 * Input/SelectValue/TextField 류 field leaf 는 box(height>0 + opaque bg/border, 또는 variant
 * 없는 shell)라 `isInlineText=false` → 과거 기본 center 로 오정렬됐다(사용자 보고 2026-06-18 버그).
 * DOM `<input>`/`.react-aria-SelectValue`(starter Select.css `text-align: start`)는 좌측 정렬이
 * parity. `props.placeholder != null` 데이터 신호로 left override — placeholder 는 정확히 input
 * field 군 binding 만 accepts(Button/Badge/Tag 등 center box 는 미보유 → 오염 0). ADR-142 §3
 * 데이터 분기(컴포넌트 식별 if 아님).
 */

// opaque box visual (Input 류 — fill {color.layer-2} + border {color.border}).
const opaqueBoxVisual: ComponentVisualRule = {
  fill: {
    default: {
      base: "{color.layer-2}" as TokenRef,
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
  trailingIcon: undefined,
  textAlign: undefined,
};

// box size (height>0 → isInlineText=false).
const sizeMd: SizeSpec = {
  fontSize: 14,
  borderRadius: 6,
  height: 30,
  paddingX: 12,
} as unknown as SizeSpec;

const textShape = (
  visual: ComponentVisualRule | undefined,
  props: Record<string, unknown>,
) => buildCatalogShapes(visual, props, sizeMd).find((s) => s.type === "text");

describe("buildCatalogShapes — input field placeholder 좌측 정렬 (회귀 방지)", () => {
  it("opaque box + placeholder → text left (Input/SelectValue parity)", () => {
    const t = textShape(opaqueBoxVisual, { placeholder: "Enter value..." });
    expect(t?.align).toBe("left");
  });

  it("opaque box + value 만(placeholder 없음) → text center 유지 (box 기본)", () => {
    // placeholder 신호가 없으면 box 기본 center — 비-field box 회귀 0 확증.
    const t = textShape(opaqueBoxVisual, { label: "Click Me" });
    expect(t?.align).toBe("center");
  });

  it("visual=undefined(variants:{} shell, TextField 류) + placeholder → text left", () => {
    // TextField 는 variants:{} 라 resolveSkiaVisualRule 가 undefined 반환 → visual.textAlign
    // 경로로는 못 잡힘. placeholder 데이터 신호가 단일 진입점임을 확증.
    const t = textShape(undefined, {
      label: "Text Field",
      placeholder: "Enter value...",
    });
    expect(t?.align).toBe("left");
  });

  it("style.textAlign 사용자 명시가 placeholder 신호보다 우선", () => {
    const t = textShape(opaqueBoxVisual, {
      placeholder: "Enter value...",
      style: { textAlign: "right" },
    });
    expect(t?.align).toBe("right");
  });

  it("visual.textAlign(rule 명시)이 placeholder 없는 box 의 기본 center override", () => {
    // rule 이 명시적으로 textAlign 을 주면 placeholder 와 무관하게 적용(미래 확장 경로).
    const t = textShape(
      { ...opaqueBoxVisual, textAlign: "left" },
      { label: "X" },
    );
    expect(t?.align).toBe("left");
  });
});

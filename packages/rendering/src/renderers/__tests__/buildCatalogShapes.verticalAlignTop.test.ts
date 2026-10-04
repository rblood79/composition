import { describe, expect, it } from "vitest";

import { buildCatalogShapes } from "./catalogPaintFixture";
import type { ComponentVisualRule } from "../utils/resolveComponentVisual";
import type { SizeSpec, TokenRef } from "../../types";

/**
 * `style.verticalAlign: "top"` → box 텍스트를 상자 위 (paddingY) 에 둔다 (ADR-923 Phase 5 후속
 * 착수 2, 2026-09-03). TextArea 의 Input 자식은 rows 줄 상자 (md 3줄 = 70) 인데 catalog 텍스트
 * shape 가 `y:0 · baseline middle` 고정이라 placeholder 가 상자 중앙에 놓였다 — DOM `<textarea>`
 * 는 위. Skia sub-part 투영이 이 style 을 넣고, Style 패널 "Vertical Align: top" 도 같은 경로.
 * textAlign 의 "사용자 명시 style 우선" 과 같은 데이터 분기 (컴포넌트 식별 if 아님).
 */

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

const sizeMd: SizeSpec = {
  fontSize: 14,
  borderRadius: 6,
  height: 30,
  paddingX: 12,
  paddingY: 4,
} as unknown as SizeSpec;

const textShape = (props: Record<string, unknown>) =>
  buildCatalogShapes(
    opaqueBoxVisual,
    props,
    sizeMd,
    "default",
    undefined,
    "Input",
  ).find((s) => s.type === "text");

describe("buildCatalogShapes — style.verticalAlign top → 텍스트 y = paddingY · baseline top", () => {
  it("verticalAlign top → y 4 (paddingY) · baseline top", () => {
    const t = textShape({
      placeholder: "Enter text...",
      style: { verticalAlign: "top" },
    });
    expect(t?.y).toBe(4);
    expect(t?.baseline).toBe("top");
  });

  it("미지정 → 기존 중앙 (y 0 · baseline middle) 유지 — 한 줄 Input", () => {
    const t = textShape({ placeholder: "Enter text..." });
    expect(t?.y).toBe(0);
    expect(t?.baseline).toBe("middle");
  });

  it("verticalAlign middle 명시 → 중앙 유지", () => {
    const t = textShape({
      placeholder: "Enter text...",
      style: { verticalAlign: "middle" },
    });
    expect(t?.baseline).toBe("middle");
  });
});

import { describe, expect, it } from "vitest";

import { buildCatalogShapes } from "./catalogPaintFixture";
import type { ComponentVisualRule } from "../utils/resolveComponentVisual";
import type { SizeSpec, TokenRef } from "../../types";

/**
 * ADR-027 후속 8 (2026-09-20, 사용자 live) — 위에 붙는 텍스트의 y 는 사용자 padding-top 이다.
 * 종전엔 `verticalAlign: top` 이어도 rule size.paddingY 만 읽어 Text 에 padding-top 24 를 줘도 Skia 는
 * 0 이었다 (DOM 은 padding-top 만큼 내려간다). inline leaf (Text) 도 같다 — 인라인 border 가 더는
 * box archetype 이 아니라 (후속 7) 위 기준으로 그리므로 padding-top 을 직접 실어야 한다.
 */
const textLeafVisual: ComponentVisualRule = {
  fill: { default: { base: "{color.transparent}" as TokenRef }, alpha: 0 },
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
  leadingIcon: undefined,
  trailingIcon: undefined,
  textAlign: undefined,
};
const inlineSize: SizeSpec = {
  fontSize: 16,
  lineHeight: 24,
  height: 0,
} as unknown as SizeSpec;
const boxVisual: ComponentVisualRule = {
  ...textLeafVisual,
  fill: { default: { base: "{color.accent}" as TokenRef } },
};
const boxSize: SizeSpec = {
  fontSize: 14,
  height: 30,
  paddingX: 12,
  paddingY: 5,
} as unknown as SizeSpec;

const textShape = (
  visual: ComponentVisualRule,
  size: SizeSpec,
  style: Record<string, unknown>,
  nodeType: string,
) =>
  buildCatalogShapes(
    visual,
    { children: "T", style },
    size,
    "default",
    undefined,
    nodeType,
  ).find((s) => s.type === "text");

describe("buildCatalogShapes — 위에 붙는 텍스트의 y = 사용자 padding-top", () => {
  it("inline Text + paddingTop 24 (+ 인라인 border) → y 24 · baseline top", () => {
    const t = textShape(
      textLeafVisual,
      inlineSize,
      { paddingTop: "24px", borderWidth: 1, borderColor: "#C20E0E" },
      "Text",
    );
    expect(t).toMatchObject({ y: 24, baseline: "top" });
  });

  it("inline Text 미지정 → y 0 (종전)", () => {
    expect(textShape(textLeafVisual, inlineSize, {}, "Text")).toMatchObject({
      y: 0,
      baseline: "top",
    });
  });

  it("box (Button) verticalAlign top: 사용자 paddingTop > rule paddingY", () => {
    expect(
      textShape(
        boxVisual,
        boxSize,
        { verticalAlign: "top", paddingTop: "10px" },
        "Button",
      ),
    ).toMatchObject({ y: 10, baseline: "top" });
    expect(
      textShape(boxVisual, boxSize, { verticalAlign: "top" }, "Button"),
    ).toMatchObject({ y: 5, baseline: "top" });
  });

  it("box 기본 (middle) 은 y 0 그대로", () => {
    expect(
      textShape(boxVisual, boxSize, { paddingTop: "10px" }, "Button"),
    ).toMatchObject({ y: 0, baseline: "middle" });
  });
});

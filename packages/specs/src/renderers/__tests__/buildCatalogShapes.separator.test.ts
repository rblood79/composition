import { describe, expect, it } from "vitest";

import type { ComponentVisualRule } from "../utils/resolveComponentVisual";
import type { SizeSpec, TokenRef } from "../../types";
import { getSkiaPrimitive } from "../skiaPrimitives";

/**
 * ADR-142 family ① — Separator(divider) catalog-only 검증 (ADR-912 box+text leaf 군, 2026-06-11).
 *
 * **정본**: Separator 는 box+text 가 아닌 비-DOM-trivial primitive →
 * `skiaPrimitive: "divider"` draw module 이 그린다(buildCatalogShapes 가 아님).
 *
 * Separator.spec.ts 삭제(ADR-912) 로 legacy render.shapes parity oracle 소멸.
 * 인라인 fixture visual/size 로 divider draw fn 의 catalog-only 동작을 직접 검증.
 */

// Separator divider 의 선색 — legacy variant별 border 토큰 그대로 미러.
const SEPARATOR_COLORS: Record<string, TokenRef> = {
  default: "{color.border}" as TokenRef,
  solid: "{color.border}" as TokenRef,
  dashed: "{color.border}" as TokenRef,
  dotted: "{color.border}" as TokenRef,
  accent: "{color.accent}" as TokenRef,
  neutral: "{color.neutral}" as TokenRef,
  surface: "{color.base}" as TokenRef,
};

function makeVisual(variant: string): ComponentVisualRule {
  return {
    fill: undefined,
    text: undefined,
    textHover: undefined,
    textWeight: undefined,
    fontFamily: undefined,
    border: SEPARATOR_COLORS[variant] ?? ("{color.border}" as TokenRef),
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
}

const SIZE_THICKNESS: Record<string, number> = { sm: 1, md: 1, lg: 2 };

function makeSize(sizeKey: string): SizeSpec {
  return { height: SIZE_THICKNESS[sizeKey] ?? 1 } as unknown as SizeSpec;
}

describe("skiaPrimitive 'divider' — Separator catalog-only 검증 (ADR-912, 2026-06-11)", () => {
  const draw = getSkiaPrimitive("divider")!;

  it("draw 함수가 등록되어 있다", () => {
    expect(draw).toBeDefined();
  });

  it("선은 단일 rect(fill=선색) — bg/border 모델 아님", () => {
    const shapes = draw({
      props: { variant: "default", orientation: "horizontal" },
      size: makeSize("md"),
      visual: makeVisual("default"),
      style: undefined,
    })!;
    expect(shapes).toHaveLength(1);
    expect(shapes[0].type).toBe("rect");
    expect(shapes[0].fill).toBe("{color.border}");
    expect(shapes.some((s) => s.type === "roundRect")).toBe(false);
    expect(shapes.some((s) => s.type === "border")).toBe(false);
  });

  it("vertical orientation — width=thickness, height=auto", () => {
    const shapes = draw({
      props: { variant: "default", orientation: "vertical" },
      size: makeSize("sm"),
      visual: makeVisual("default"),
      style: undefined,
    })!;
    expect(shapes[0].type).toBe("rect");
    expect(typeof shapes[0].width).toBe("number");
  });

  it("horizontal orientation — height=thickness", () => {
    const shapes = draw({
      props: { variant: "default", orientation: "horizontal" },
      size: makeSize("lg"),
      visual: makeVisual("default"),
      style: undefined,
    })!;
    expect(shapes[0].type).toBe("rect");
    expect(shapes[0].height).toBe(2);
  });

  it("accent variant — fill={color.accent}", () => {
    const shapes = draw({
      props: { variant: "accent", orientation: "horizontal" },
      size: makeSize("md"),
      visual: makeVisual("accent"),
      style: undefined,
    })!;
    expect(shapes[0].fill).toBe("{color.accent}");
  });

  it("neutral variant — fill={color.neutral}", () => {
    const shapes = draw({
      props: { variant: "neutral", orientation: "horizontal" },
      size: makeSize("md"),
      visual: makeVisual("neutral"),
      style: undefined,
    })!;
    expect(shapes[0].fill).toBe("{color.neutral}");
  });

  it("style.borderColor 가 visual.border 보다 우선", () => {
    const shapes = draw({
      props: { variant: "default", orientation: "horizontal" },
      size: makeSize("md"),
      visual: makeVisual("default"),
      style: { borderColor: "#ff0000" },
    })!;
    expect(shapes[0].fill).toBe("#ff0000");
  });
});

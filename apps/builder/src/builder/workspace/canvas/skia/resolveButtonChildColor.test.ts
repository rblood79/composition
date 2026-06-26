/**
 * Button 조합 자식 color 상속 — fillStyle 분기 회귀 테스트 (2026-06-27).
 *
 * `<Button fillStyle="outline"><Icon/><Text/></Button>` 일 때 자식 Icon/Text 는 부모 Button 의
 * outline 텍스트 색(`outlineText`)을 상속해야 한다. 누락 시 Skia 가 default `visual.text`
 * (예: accent → {color.on-accent} = 흰색)를 상속해 투명/밝은 배경 위에서 사라졌다
 * (CSS Preview 는 `--button-text` outline override 로 정상 → Skia↔CSS 발산).
 *
 * resolveButtonChildColor 는 buildCatalogShapes.textColor 와 동일 우선순위로
 *   selected → outline → subtle → text 를 따라간다. 본 테스트는 그 분기를 고정한다.
 *
 * 실행: pnpm vitest resolveButtonChildColor
 */

import { describe, expect, it } from "vitest";
import { resolveButtonChildColor } from "./buildSpecNodeData";
import type { CanvasSceneNode } from "../scene/canvasSceneNode";

function node(
  id: string,
  type: string,
  props: Record<string, unknown>,
  parent_id?: string,
): CanvasSceneNode {
  return { id, type, props, parent_id } as CanvasSceneNode;
}

function setup(parentProps: Record<string, unknown>) {
  const parent = node("btn", "Button", parentProps);
  const textChild = node("tx", "Text", { children: "Label" }, "btn");
  const iconChild = node("ic", "Icon", { iconName: "star" }, "btn");
  const elementsMap = new Map<string, CanvasSceneNode>([
    ["btn", parent],
    ["tx", textChild],
    ["ic", iconChild],
  ]);
  return { textChild, iconChild, elementsMap };
}

describe("resolveButtonChildColor — fillStyle 분기", () => {
  it("fill(default) accent → on-accent (흰색 계열) 상속", () => {
    const { textChild, elementsMap } = setup({ variant: "accent" });
    expect(resolveButtonChildColor(textChild, elementsMap)).toBe(
      "{color.on-accent}",
    );
  });

  it("outline accent → outlineText({color.accent}) 상속 (text 가 아님)", () => {
    const { textChild, iconChild, elementsMap } = setup({
      variant: "accent",
      fillStyle: "outline",
    });
    expect(resolveButtonChildColor(textChild, elementsMap)).toBe(
      "{color.accent}",
    );
    // Icon 도 동일 상속 (SVG currentColor 대칭).
    expect(resolveButtonChildColor(iconChild, elementsMap)).toBe(
      "{color.accent}",
    );
  });

  it("outline negative → outlineText({color.negative})", () => {
    const { textChild, elementsMap } = setup({
      variant: "negative",
      fillStyle: "outline",
    });
    expect(resolveButtonChildColor(textChild, elementsMap)).toBe(
      "{color.negative}",
    );
  });

  it("outline primary → outlineText({color.neutral})", () => {
    const { textChild, elementsMap } = setup({
      variant: "primary",
      fillStyle: "outline",
    });
    expect(resolveButtonChildColor(textChild, elementsMap)).toBe(
      "{color.neutral}",
    );
  });

  it("outline accent ≠ default fill 의 흰색 — 투명 배경 위 가시성 보장", () => {
    const { textChild, elementsMap } = setup({
      variant: "accent",
      fillStyle: "outline",
    });
    const outline = resolveButtonChildColor(textChild, elementsMap);
    expect(outline).not.toBe("{color.on-accent}"); // 흰색 상속 배제
  });

  it("부모가 button-base 아니면 null (standalone leaf 영향 없음)", () => {
    const parent = node("frm", "frame", { fillStyle: "outline" });
    const textChild = node("tx", "Text", { children: "x" }, "frm");
    const elementsMap = new Map<string, CanvasSceneNode>([
      ["frm", parent],
      ["tx", textChild],
    ]);
    expect(resolveButtonChildColor(textChild, elementsMap)).toBeNull();
  });

  it("자식이 inherit 대상(Text/Icon/Label) 아니면 null", () => {
    const parent = node("btn", "Button", { fillStyle: "outline" });
    const other = node("o", "Image", {}, "btn");
    const elementsMap = new Map<string, CanvasSceneNode>([
      ["btn", parent],
      ["o", other],
    ]);
    expect(resolveButtonChildColor(other, elementsMap)).toBeNull();
  });
});

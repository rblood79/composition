import { describe, expect, it } from "vitest";

import { buildCatalogShapes } from "./catalogPaintFixture";
import type { ComponentVisualRule } from "../utils/resolveComponentVisual";
import type { SizeSpec, TokenRef } from "../../types";

/**
 * 회귀 방지 — inline text leaf(Text/Heading/Label 등)에 **사용자 배경색**을 줘도 텍스트가
 * center/middle 로 정렬되지 않는다 (2026-07-21 사용자 보고).
 *
 * 근본 원인: `isInlineText` box 판정이 `bgColor`(L182 에서 `style.backgroundColor`(fills 채널)를
 * 흡수)를 opaque box 신호로 써서, Text 에 배경을 추가하면 `hasOpaqueBg=true → isInlineText=false`
 * → align center / baseline middle 로 오정렬됐다. DOM `<span>` 에 background 를 줘도 inline flow
 * 라 text-align left / top 을 유지하므로 Skia 도 동일해야 D3 parity. box archetype(Button/Badge)은
 * **rule 변형 fill(stateBg opaque)** 또는 border 로 식별되어 center/middle 이 보존된다.
 */

// inline text leaf visual (catalog Text 동형 — fill 전 상태 transparent, border 없음).
const textLeafVisual: ComponentVisualRule = {
  fill: {
    default: {
      base: "{color.transparent}" as TokenRef,
      hover: "{color.transparent}" as TokenRef,
      pressed: "{color.transparent}" as TokenRef,
    },
  },
  text: "{color.neutral}" as TokenRef,
  textHover: undefined,
  textWeight: 400,
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

// opaque rule-fill box archetype (Badge 동형 — rule 변형 fill 이 opaque, height 0 content-fit).
const opaqueRuleBoxVisual: ComponentVisualRule = {
  ...textLeafVisual,
  fill: {
    default: {
      base: "{color.accent}" as TokenRef,
      hover: "{color.accent}" as TokenRef,
      pressed: "{color.accent}" as TokenRef,
    },
  },
};

// inline text leaf size (height 0 = content-fit typography leaf).
const sizeTextLeaf: SizeSpec = {
  fontSize: 16,
  borderRadius: 0,
  height: 0,
} as unknown as SizeSpec;

const textShape = (
  visual: ComponentVisualRule | undefined,
  props: Record<string, unknown>,
) =>
  buildCatalogShapes(visual, props, sizeTextLeaf).find(
    (s) => s.type === "text",
  );

describe("buildCatalogShapes — text leaf 배경 추가 시 inline 정렬 유지 (회귀 방지)", () => {
  it("text leaf + 사용자 backgroundColor → align left (box center 아님)", () => {
    const t = textShape(textLeafVisual, {
      children: "Hello",
      style: { backgroundColor: "#FF0000" },
    });
    expect(t?.align).toBe("left");
  });

  it("text leaf + 사용자 backgroundColor → baseline top (box middle 아님)", () => {
    const t = textShape(textLeafVisual, {
      children: "Hello",
      style: { backgroundColor: "#FF0000" },
    });
    expect(t?.baseline).toBe("top");
  });

  it("text leaf 배경 없음 → align left / baseline top (회귀 0)", () => {
    const t = textShape(textLeafVisual, { children: "Hello" });
    expect(t?.align).toBe("left");
    expect(t?.baseline).toBe("top");
  });

  it("opaque rule-fill box(height 0, Badge 동형) → center 유지", () => {
    // rule 변형 fill 이 opaque → hasOpaqueBg=true → box 정렬 보존 (배경 유무 무관).
    const t = textShape(opaqueRuleBoxVisual, { children: "Badge" });
    expect(t?.align).toBe("center");
  });

  it("사용자 style.textAlign 명시는 inline 기본보다 우선 (center 요청 존중)", () => {
    const t = textShape(textLeafVisual, {
      children: "Hello",
      style: { backgroundColor: "#FF0000", textAlign: "center" },
    });
    expect(t?.align).toBe("center");
  });
});

import { describe, expect, it } from "vitest";

import type { ComponentVisualRule } from "../utils/resolveComponentVisual";
import type { SizeSpec, TokenRef } from "../../types";
import { buildCatalogShapes } from "./catalogPaintFixture";

/**
 * ADR-923 r14m2 → r15m1 — buildCatalogShapes 의 텍스트 원천은 타입별 계약 (`utils/textSource.ts`,
 * Preview · 레이아웃과 같은 단일 지점) 에 위임한다. round 14 의 단일 순서 `label || children || text ||
 * placeholder` 를 모든 타입에 적용하던 것은 Preview 의 children 우선 타입 (Text/Button/Column) 과
 * 갈렸고, AI `create_element` 의 열린 props 가 그 차이에 도달했다 (`{children: "Text", label: "AI
 * Label"}` → Skia "AI Label" / Preview "Text"). 여기서는 Skia 가 계약을 그대로 소비하는지 (nodeType
 * 별 순서 · 문자열화) 를 고정한다.
 */
function makeVisual(): ComponentVisualRule {
  return {
    fill: { default: { base: "{color.accent}" as TokenRef } },
    text: "{color.on-accent}" as TokenRef,
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
}

const SIZE = {
  height: 24,
  fontSize: 12,
  borderRadius: 4,
  paddingX: 6,
  paddingY: 2,
} as unknown as SizeSpec;

function textOf(
  props: Record<string, unknown>,
  nodeType?: string,
): string | undefined {
  const shape = buildCatalogShapes(
    makeVisual(),
    props,
    SIZE,
    "default",
    undefined,
    nodeType,
  ).find((s) => s.type === "text");
  return shape ? (shape as { text?: string }).text : undefined;
}

describe("ADR-923 r15m1 — buildCatalogShapes 텍스트 원천 = 타입별 계약", () => {
  it("AI Text `{children: 'Text', label: 'AI Label'}` → 'Text' (Preview · 레이아웃과 동일)", () => {
    expect(textOf({ children: "Text", label: "AI Label" }, "Text")).toBe(
      "Text",
    );
    expect(textOf({ children: "Button", label: "Go" }, "Button")).toBe(
      "Button",
    );
    expect(textOf({ children: "Name", label: "AI" }, "Column")).toBe("Name");
    // 계약 밖 키만 있으면 text shape 없음 — Preview 도 children 을 읽지 않는다.
    expect(textOf({ label: "AI" }, "Button")).toBeUndefined();
  });
  it("ListBoxItem/GridListItem/Menu 만 label → children", () => {
    expect(textOf({ label: "L", children: "C" }, "ListBoxItem")).toBe("L");
    expect(textOf({ label: "L", children: "C" }, "GridListItem")).toBe("L");
    expect(textOf({ label: "Menu", children: "Menu" }, "Menu")).toBe("Menu");
    expect(textOf({ children: "C" }, "ListBoxItem")).toBe("C");
  });
  it("텍스트 leaf: Pencil import writer (`text` 만) 은 그려지고, children 이 stale text 를 이긴다", () => {
    expect(textOf({ text: "Hello" }, "Text")).toBe("Hello");
    expect(textOf({ children: "edited", text: "pencil" }, "Heading")).toBe(
      "edited",
    );
    expect(textOf({ children: "", text: "T" }, "Paragraph")).toBe("T");
    // 기본 군은 text 를 읽지 않는다.
    expect(textOf({ children: "", text: "T" }, "Badge")).toBeUndefined();
  });
  it("field leaf: placeholder (값이 비었을 때 DOM 이 보이는 텍스트)", () => {
    expect(textOf({ placeholder: "P" }, "SelectValue")).toBe("P");
    expect(textOf({ placeholder: "P", children: "C" }, "Input")).toBe("P");
    // 기본 군은 placeholder 를 읽지 않는다.
    expect(textOf({ placeholder: "P" }, "Button")).toBeUndefined();
  });
  it("nodeType 미전달 (기본 군) 은 children 만", () => {
    expect(textOf({ label: "L", children: "C", text: "T" })).toBe("C");
    expect(textOf({ text: "T", placeholder: "P" })).toBeUndefined();
  });
  it("문자열화는 계약 공통 (배열은 string/number 이어붙임 — Preview 가 그리는 결과와 동일); object 는 내용 아님", () => {
    expect(textOf({ children: ["a", "b"] }, "Text")).toBe("ab");
    expect(textOf({ children: { type: "span" }, text: "T" }, "Text")).toBe("T");
    expect(textOf({ children: 0 }, "Text")).toBe("0");
  });
  it("내용이 없으면 text shape 없음", () => {
    expect(textOf({ children: "" }, "Text")).toBeUndefined();
    expect(textOf({}, "Text")).toBeUndefined();
  });
});

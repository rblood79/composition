import { describe, it, expect } from "vitest";

import { resolveLabelEditTarget } from "../../../../utils/hierarchicalSelection";

type MinimalElement = {
  id: string;
  type: string;
  parent_id?: string | null;
  props?: Record<string, unknown> | null;
};

/**
 * 회귀 방지 — icon 추가된 Button/ToggleButton(RSP composite) 더블클릭 시 label 편집
 * 대상을 자식 Text element 로 해석 (2026-06-29).
 *
 * **버그**: icon 이 추가된 Button/ToggleButton 은 RSP composite(자식 Icon+Text element 보유,
 *   children prop = "")인데, handleElementDoubleClick 이 TEXT_EDITABLE_TAGS 체크에서
 *   Button/ToggleButton 을 그대로 startEdit 대상으로 삼아 button 자체의 빈 children("")을
 *   편집하려 한다 → 잘못된 빈 label 에디트 상태. icon 없는 button(children prop 에 텍스트)은
 *   정상이지만, icon 추가 시 텍스트가 자식 Text element 로 이관돼 깨진다.
 *
 * **수정**: button/togglebutton 이 자식 Text element 를 가지면 그 자식 Text id 를 편집 대상으로
 *   해석(사용자 결정 — icon 없는 button 과 동일한 label 편집 경험, 대상만 자식 Text).
 *   자식 Text 가 없으면(leaf, children prop) resolvedTarget 그대로 반환(기존 동작 보존).
 */

function node(
  id: string,
  type: string,
  props: Record<string, unknown> = {},
): MinimalElement {
  return { id, type, props };
}

describe("resolveLabelEditTarget — icon button 더블클릭 label 편집 대상 (2026-06-29)", () => {
  it("icon Button(자식 Icon+Text) → 자식 Text id 반환", () => {
    const btn = node("btn", "Button", { children: "" });
    const icon = node("ic", "Icon", { iconName: "a-arrow-down" });
    const text = node("tx", "Text", { children: "Button" });
    const childrenMap = new Map<string, MinimalElement[]>([
      ["btn", [icon, text]],
    ]);
    expect(resolveLabelEditTarget("btn", btn, childrenMap)).toBe("tx");
  });

  it("icon ToggleButton(자식 Icon+Text) → 자식 Text id 반환", () => {
    const tb = node("tb", "ToggleButton", { children: "" });
    const icon = node("ic", "Icon", { iconName: "a-arrow-down" });
    const text = node("tx", "Text", { children: "Toggle 1" });
    const childrenMap = new Map<string, MinimalElement[]>([
      ["tb", [icon, text]],
    ]);
    expect(resolveLabelEditTarget("tb", tb, childrenMap)).toBe("tx");
  });

  it("icon 없는 leaf Button(children prop, 자식 없음) → resolvedTarget 그대로", () => {
    const btn = node("btn", "Button", { children: "Action 1" });
    const childrenMap = new Map<string, MinimalElement[]>();
    expect(resolveLabelEditTarget("btn", btn, childrenMap)).toBe("btn");
  });

  it("Text element 자체 → resolvedTarget 그대로 (이미 텍스트 leaf)", () => {
    const text = node("tx", "Text", { children: "hello" });
    const childrenMap = new Map<string, MinimalElement[]>();
    expect(resolveLabelEditTarget("tx", text, childrenMap)).toBe("tx");
  });

  it("자식에 Text 없고 Icon 만 (icon-only button) → resolvedTarget 그대로", () => {
    const btn = node("btn", "Button", { children: "" });
    const icon = node("ic", "Icon", { iconName: "a-arrow-down" });
    const childrenMap = new Map<string, MinimalElement[]>([
      ["btn", [icon]],
    ]);
    expect(resolveLabelEditTarget("btn", btn, childrenMap)).toBe("btn");
  });

  it("삭제된 Text 자식은 건너뛴다", () => {
    const btn = node("btn", "Button", { children: "" });
    const icon = node("ic", "Icon", {});
    const deletedText = node("tx0", "Text", { deleted: true });
    const text = node("tx1", "Text", { children: "Button" });
    const childrenMap = new Map<string, MinimalElement[]>([
      ["btn", [icon, deletedText, text]],
    ]);
    expect(resolveLabelEditTarget("btn", btn, childrenMap)).toBe("tx1");
  });
});

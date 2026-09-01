import { describe, expect, it } from "vitest";

import {
  resolveTextSourceKey,
  resolveTextSourceText,
  textFromValue,
  textSourceOrder,
} from "../textSource";

/**
 * ADR-923 Phase 3 r15m1 — 노드 텍스트 원천 계약 (Preview · Skia · 레이아웃 공용 단일 지점).
 *
 * writer 인벤토리로 도출한 타입별 순서와, AI `create_element`/`update_element` 의 열린 props 가
 * 만드는 조합에서 세 표면이 같은 텍스트를 읽는지 고정한다. round 14 까지 Skia 는 모든 타입에
 * `label` 을 먼저 읽어 AI Text `{children: "Text", label: "AI Label"}` 을 "AI Label" 로, Preview ·
 * 레이아웃은 "Text" 로 읽었다.
 */
describe("ADR-923 r15m1 — textSourceOrder (타입별 writer 인벤토리)", () => {
  it("기본 군은 children 만 (Button/Badge/Link/Tag/MenuItem/Column/TreeItem/DisclosureHeader/Div)", () => {
    for (const t of [
      "Button",
      "Badge",
      "Link",
      "Tag",
      "MenuItem",
      "Column",
      "TreeItem",
      "DisclosureHeader",
      "Div",
      "box",
      undefined,
    ]) {
      expect(textSourceOrder(t)).toEqual(["children"]);
    }
  });
  it("텍스트 leaf 7종 + FieldError 는 children → text (Pencil import · legacy text writer)", () => {
    for (const t of [
      "Text",
      "Heading",
      "Paragraph",
      "Label",
      "Description",
      "Kbd",
      "Code",
      "FieldError",
      "text",
      "fielderror",
    ]) {
      expect(textSourceOrder(t)).toEqual(["children", "text"]);
    }
  });
  it("ListBoxItem/GridListItem/Menu 는 label → children (Menu factory label+children · collection 데이터 label)", () => {
    for (const t of ["ListBoxItem", "GridListItem", "Menu", "listboxitem"]) {
      expect(textSourceOrder(t)).toEqual(["label", "children"]);
    }
  });
  it("field leaf 는 placeholder (factory placeholder writer; 값이 비었을 때 DOM 이 보이는 텍스트)", () => {
    for (const t of [
      "Input",
      "TextArea",
      "TextField",
      "SearchField",
      "NumberField",
      "ColorField",
      "Select",
      "SelectValue",
      "ComboBox",
    ]) {
      expect(textSourceOrder(t)).toEqual(["placeholder"]);
    }
  });
});

describe("ADR-923 r15m1 — resolveTextSourceText (AI 열린 props 도달 케이스)", () => {
  it("AI create_element Text `{label}` → 저장 `{children: 'Text', label: 'AI Label'}` 은 세 표면 모두 'Text'", () => {
    const props = { children: "Text", label: "AI Label" };
    expect(resolveTextSourceText("Text", props)).toBe("Text");
    expect(resolveTextSourceKey("Text", props)).toBe("children");
  });
  it("AI update_element Button `{label}` / Column `{label}` / TreeItem `{title}` 은 children 을 읽는다", () => {
    expect(
      resolveTextSourceText("Button", { children: "Button", label: "Go" }),
    ).toBe("Button");
    expect(
      resolveTextSourceText("Column", { children: "Name", label: "AI" }),
    ).toBe("Name");
    expect(
      resolveTextSourceText("TreeItem", { children: "Node 1", title: "T" }),
    ).toBe("Node 1");
    // 계약 밖 키만 있으면 내용 없음 — Preview 폴백 (`|| "Column"` 등) 은 렌더러 몫.
    expect(resolveTextSourceText("Column", { label: "AI" })).toBe("");
    expect(resolveTextSourceKey("Column", { label: "AI" })).toBeUndefined();
  });
  it("ListBoxItem 은 label 이 children 을 이긴다 (collection 데이터 SSOT)", () => {
    expect(
      resolveTextSourceText("ListBoxItem", { label: "L", children: "C" }),
    ).toBe("L");
    expect(resolveTextSourceText("ListBoxItem", { children: "C" })).toBe("C");
  });
  it("텍스트 leaf: children 이 stale text 를 이기고, 빈 children 은 text 로 떨어진다 (Pencil writer)", () => {
    expect(
      resolveTextSourceText("Text", { children: "edited", text: "pencil" }),
    ).toBe("edited");
    expect(resolveTextSourceText("Text", { children: "", text: "t" })).toBe(
      "t",
    );
    expect(resolveTextSourceText("Text", { text: "t", label: "l" })).toBe("t");
    // 기본 군은 text 를 읽지 않는다 — AI 가 Badge 에 text 를 써도 세 표면 모두 내용 없음.
    expect(resolveTextSourceText("Badge", { children: "", text: "X" })).toBe(
      "",
    );
  });
  it("field leaf: placeholder 만 (children/label 은 DOM input 이 그리지 않는다)", () => {
    expect(
      resolveTextSourceText("Input", { placeholder: "P", children: "C" }),
    ).toBe("P");
    expect(resolveTextSourceText("SelectValue", { placeholder: "P" })).toBe(
      "P",
    );
    expect(resolveTextSourceText("Input", { label: "L" })).toBe("");
  });
  it("props 없음 → 내용 없음", () => {
    expect(resolveTextSourceText("Text", undefined)).toBe("");
    expect(resolveTextSourceKey("Text", undefined)).toBeUndefined();
  });
});

describe("ADR-923 r15m1 — textFromValue (React renderable 문자열화, 세 표면 공통)", () => {
  it("string/number 그대로, 0 은 내용", () => {
    expect(textFromValue("a")).toBe("a");
    expect(textFromValue(0)).toBe("0");
    expect(textFromValue(12)).toBe("12");
  });
  it("배열은 string/number 항목만 이어붙임 (React 가 ['a','b'] 를 'ab' 로 그린다; 쉼표 없음)", () => {
    expect(textFromValue(["a", "b"])).toBe("ab");
    expect(textFromValue([" ", " "])).toBe("  ");
    expect(textFromValue(["a", 1, { x: 1 }, null, true])).toBe("a1");
  });
  it("object/boolean/null/undefined 는 내용 없음", () => {
    expect(textFromValue({ type: "span" })).toBe("");
    expect(textFromValue(true)).toBe("");
    expect(textFromValue(null)).toBe("");
    expect(textFromValue(undefined)).toBe("");
  });
});

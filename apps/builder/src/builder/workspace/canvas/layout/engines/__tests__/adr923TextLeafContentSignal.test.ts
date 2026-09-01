import { describe, expect, it } from "vitest";

import { resolveTextLeafContent, textLeafRendersContent } from "../utils";

/**
 * ADR-923 Phase 3 r11h1/r12l3 — 텍스트 leaf 의 내용 추출과 line box 신호.
 * 내용은 React renderable 규칙 (string/number 그대로, 배열은 string/number 만 이어붙임,
 * object/boolean 은 없음) — `String([" ", " "])` 의 쉼표나 "[object Object]" 가 내용으로
 * 잡혀 line box 를 만들면 안 된다. 신호는 white-space 처리 후 남는 내용 (CSS Text 3 §4.1.1).
 */
describe("ADR-923 r12l3 — resolveTextLeafContent", () => {
  it("배열 children 은 string/number 항목만 이어붙인다 (쉼표 없음)", () => {
    expect(resolveTextLeafContent({ children: [" ", " "] })).toBe("  ");
    expect(resolveTextLeafContent({ children: ["a", 1, { x: 1 }, null] })).toBe("a1");
    expect(textLeafRendersContent(resolveTextLeafContent({ children: [" ", " "] }), undefined)).toBe(false);
  });
  it("object / boolean children 은 내용이 아니다", () => {
    expect(resolveTextLeafContent({ children: { type: "span" } })).toBe("");
    expect(resolveTextLeafContent({ children: true })).toBe("");
    expect(textLeafRendersContent(resolveTextLeafContent({ children: { type: "span" } }), "normal")).toBe(false);
  });
  it("number 0 은 내용", () => {
    expect(resolveTextLeafContent({ children: 0 })).toBe("0");
    expect(textLeafRendersContent("0", undefined)).toBe(true);
  });
  it("원천 우선순위 children → text → label → title, 첫 정의값 (빈 문자열도 정의값)", () => {
    expect(resolveTextLeafContent({ text: "t", label: "l" })).toBe("t");
    expect(resolveTextLeafContent({ children: "", label: "l" })).toBe("");
    expect(resolveTextLeafContent({ title: "T" })).toBe("T");
    expect(resolveTextLeafContent(undefined)).toBe("");
  });
});

describe("ADR-923 r11h1 — textLeafRendersContent (white-space 처리 후 내용)", () => {
  it("normal/nowrap: 공백·탭·개행만이면 line box 없음, nbsp·U+3000 은 내용", () => {
    expect(textLeafRendersContent(" \t\n\r", undefined)).toBe(false);
    expect(textLeafRendersContent("  ", "nowrap")).toBe(false);
    expect(textLeafRendersContent("\u00A0", "normal")).toBe(true);
    expect(textLeafRendersContent("\u3000", "normal")).toBe(true);
  });
  it("pre-line: 공백·탭은 collapsible, segment break 는 보존", () => {
    expect(textLeafRendersContent(" \t ", "pre-line")).toBe(false);
    expect(textLeafRendersContent("\n", "pre-line")).toBe(true);
  });
  it("pre / pre-wrap / break-spaces: 전부 보존 — 대소문자·공백 무관", () => {
    expect(textLeafRendersContent(" ", "pre")).toBe(true);
    expect(textLeafRendersContent(" ", " PRE ")).toBe(true);
    expect(textLeafRendersContent(" ", "pre-wrap")).toBe(true);
    expect(textLeafRendersContent(" ", "break-spaces")).toBe(true);
  });
});

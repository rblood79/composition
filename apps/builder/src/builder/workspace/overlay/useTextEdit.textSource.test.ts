import { describe, expect, it } from "vitest";

import {
  resolveTextSourceKey,
  resolveTextSourceText,
} from "@composition/specs";

import { extractText, getTextPropKey } from "./useTextEdit";

/**
 * ADR-923 r16 (2026-09-01) — 캔버스 더블클릭 텍스트 편집 (overlay) 의 읽기·쓰기 키가 렌더 표면과 같은
 * 타입별 텍스트 원천 계약에 위임되는지. round 16 까지 overlay 는 자체 순서 (`value || defaultValue ||
 * children || text || label`) 라 AI 가 계약 밖 키 (`label`/`value`) 만 쓴 요소에서 캔버스·Preview 에
 * 없는 글자가 편집창에 뜨고, 확정 시 그 키에 다시 써 계속 보이지 않았다.
 */
describe("useTextEdit — 편집 텍스트·쓰기 키 = 텍스트 원천 계약", () => {
  it("AI 가 Button 에 label 만 쓴 요소: 편집창은 비어 있고 (렌더와 동일) 쓰기 키는 children", () => {
    const props = { label: "Go" };
    expect(extractText("Button", props)).toBe(
      resolveTextSourceText("Button", props),
    );
    expect(extractText("Button", props)).toBe("");
    expect(getTextPropKey("Button", props)).toBe("children");
  });
  it("Text `{children: 'Text', label: 'AI Label'}` → 'Text' / children; value 는 텍스트 leaf 원천이 아니다", () => {
    const props = { children: "Text", label: "AI Label", value: "V" };
    expect(extractText("Text", props)).toBe("Text");
    expect(getTextPropKey("Text", props)).toBe("children");
  });
  it("Pencil import Heading `{text}` → 편집 시작 'pencil', 쓰기 키는 계약이 읽는 text (children 비면 그대로 text 가 표시 원천)", () => {
    const props = { text: "pencil" };
    expect(extractText("Heading", props)).toBe("pencil");
    expect(getTextPropKey("Heading", props)).toBe(
      resolveTextSourceKey("Heading", props),
    );
    expect(getTextPropKey("Heading", props)).toBe("text");
  });
  it("배열 children 은 계약 문자열화 ('ab'), object children 은 빈 편집창", () => {
    expect(extractText("Text", { children: ["a", "b"] })).toBe("ab");
    expect(extractText("Text", { children: { type: "span" } })).toBe("");
    expect(getTextPropKey("Text", {})).toBe("children");
  });
  it("입력 계열은 value 편집 유지 (TEXT_EDITABLE_TAGS 밖 — 의미 보존)", () => {
    expect(extractText("TextField", { value: "v", placeholder: "p" })).toBe(
      "v",
    );
    expect(getTextPropKey("TextField", { placeholder: "p" })).toBe("value");
  });
});

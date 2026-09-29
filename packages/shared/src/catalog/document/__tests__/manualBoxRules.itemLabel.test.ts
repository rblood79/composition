import { describe, expect, it } from "vitest";
import { manualBoxRule } from "../manualBoxRules";

/**
 * ADR-248 Phase 3 (② Preview 추종): Tab · Tag 안 label Text 는 항목 글자를 상속한다 — 손 CSS
 * `.react-aria-Tab/Tag .react-aria-Text.react-aria-Text { font-size/weight/line-height: inherit }`.
 * typed part rule 이 Text rule 기본값 (16 / 1.5) 대신 항목 size 의 글자를 준다.
 */
const labelFont = (type: string, size: string) =>
  manualBoxRule(type)?.parts?.find(
    (part) => part.childType === "Text" && part.size === size,
  )?.visual;

describe("item label font parts", () => {
  it("Tab md: 14px · root 1.5 · 500", () => {
    expect(labelFont("Tab", "md")).toEqual({
      fontSize: 14,
      lineHeight: 1.5,
      fontWeight: 500,
    });
  });
  it("Tag md: 14px · 20px 줄 · 400", () => {
    expect(labelFont("Tag", "md")).toEqual({
      fontSize: 14,
      lineHeight: 20 / 14,
      fontWeight: 400,
    });
  });
});

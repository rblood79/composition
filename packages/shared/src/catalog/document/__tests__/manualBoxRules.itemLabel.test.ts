import { describe, expect, it } from "vitest";
import { manualBoxRule } from "../manualBoxRules";

/**
 * ADR-248 Phase 3 (② Preview 추종): Tab · Tag 안 label Text 는 항목 글자를 상속한다 — 손 CSS
 * `.react-aria-Tab/Tag .react-aria-Text.react-aria-Text { font-size/weight/line-height: inherit }`.
 * typed part rule 이 Text rule 기본값 (16 / 1.5) 대신 항목 size 의 글자를 준다. ADR-295 Phase 2: 글자 크기는
 * 토큰 참조로 남긴다 (library 가 토큰 값으로 — DOM 이 그 토큰의 기기 변수를 쓴다).
 */
const labelFont = (type: string, size: string) =>
  manualBoxRule(type)?.parts?.find(
    (part) => part.childType === "Text" && part.size === size,
  )?.visual;

describe("item label font parts", () => {
  it("Tab md: 14px · root 1.5 · 500", () => {
    expect(labelFont("Tab", "M")).toEqual({
      fontSize: "{typography.text-sm}",
      lineHeight: 1.5,
      fontWeight: 500,
    });
  });
  // (ADR-295 Phase 3: the S2 line-height formula — 14 → 18.)
  it("Tag md: 14px · 18px 줄 · 400", () => {
    expect(labelFont("Tag", "M")).toEqual({
      fontSize: "{typography.text-sm}",
      lineHeight: 18 / 14,
      fontWeight: 400,
    });
  });
});

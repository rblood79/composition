/**
 * ADR-205 Phase 4 — 인라인 fontSize 표기별 해소.
 *
 * 원복 RED 근거 (live 실측 2026-09-05, 실제 빌더 Playwright):
 *   저장 `"23px"` → Skia `text.fontSize = 16` / DOM `23px`  ❌
 *   저장 `23`     → Skia 23 / DOM 23                        ✅
 *   저장 `"16px"` → Skia 16 / DOM 16                        ✅ (16 = fallback 이라 우연히 일치)
 *
 * Styles 패널은 px **문자열**을 쓴다 (`normalizeStyleValue` 가 숫자를 `${n}px` 로 만든다,
 * `useStyleValues` 기본값도 `"16px"`). 즉 사용자가 폰트 크기를 바꾸면 Preview 만 따라갔다.
 */
import { describe, it, expect } from "vitest";
import { resolveSpecFontSize } from "../resolveSpecFontSize";

describe("resolveSpecFontSize", () => {
  it("px 문자열을 해석한다 — 패널이 저장하는 형태", () => {
    expect(resolveSpecFontSize("23px", 16)).toBe(23);
  });

  it("단위 없는 숫자 문자열도 해석한다 (레이아웃 parseNumericValue 와 같은 규칙)", () => {
    expect(resolveSpecFontSize("23", 16)).toBe(23);
  });

  it("숫자는 그대로", () => {
    expect(resolveSpecFontSize(23, 16)).toBe(23);
  });

  it("TokenRef 는 토큰 해소 경로를 유지한다", () => {
    expect(resolveSpecFontSize("{typography.text-md}", 99)).not.toBe(99);
  });

  it("상대 단위는 fallback — 해소 지점이 폰트 컨텍스트를 모른다", () => {
    expect(resolveSpecFontSize("2em", 16)).toBe(16);
    expect(resolveSpecFontSize("150%", 16)).toBe(16);
    expect(resolveSpecFontSize("1.5rem", 16)).toBe(16);
  });

  it("미지정·빈 문자열·해석 불가는 fallback", () => {
    expect(resolveSpecFontSize(undefined, 16)).toBe(16);
    expect(resolveSpecFontSize("", 16)).toBe(16);
    expect(resolveSpecFontSize("inherit", 16)).toBe(16);
  });
});

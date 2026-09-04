import { describe, expect, it } from "vitest";

import { resolveTextRenderStyle } from "./textRenderStyle";

describe("resolveTextRenderStyle — ADR-205 텍스트 시각 축 seam", () => {
  it("인라인 style 이 최우선이다", () => {
    const r = resolveTextRenderStyle(
      { letterSpacing: "2px" },
      { letterSpacing: 5 },
    );
    expect(r.letterSpacing).toBe(2);
    expect(r.letterSpacingSource).toBe("inline");
  });

  it("인라인이 없으면 computed(상속) 값을 쓴다", () => {
    const r = resolveTextRenderStyle(undefined, { letterSpacing: 5 });
    expect(r.letterSpacing).toBe(5);
    expect(r.letterSpacingSource).toBe("computed");
  });

  it("둘 다 없으면 CSS 초기값 0", () => {
    const r = resolveTextRenderStyle(undefined, undefined);
    expect(r.letterSpacing).toBe(0);
    expect(r.letterSpacingSource).toBe("initial");
  });

  it("숫자 인라인도 px 로 읽는다", () => {
    expect(resolveTextRenderStyle({ letterSpacing: -0.5 }).letterSpacing).toBe(
      -0.5,
    );
  });

  it("미지원 단위(rem/em/%/calc)는 인라인으로 치지 않는다 — 폭 leg 의 기존 규칙 유지", () => {
    for (const value of ["0.1em", "5%", "calc(1px + 1px)", "1rem"]) {
      const r = resolveTextRenderStyle(
        { letterSpacing: value },
        { letterSpacing: 3 },
      );
      expect(r.letterSpacing, value).toBe(3);
      expect(r.letterSpacingSource, value).toBe("computed");
    }
  });

  it("computed 가 0 이어도 initial 이 아니라 computed 로 판정한다 (source 는 채널 표시)", () => {
    const r = resolveTextRenderStyle(undefined, { letterSpacing: 0 });
    expect(r.letterSpacing).toBe(0);
    expect(r.letterSpacingSource).toBe("computed");
  });
});

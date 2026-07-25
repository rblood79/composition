import { describe, it, expect } from "vitest";
import {
  lightShadows,
  darkShadows,
  getShadowToken,
  parseShadow,
} from "../shadows";
import type { ShadowTokens } from "../../types/token.types";

/**
 * Box-shadow 프리셋 값 계약 + inset 파싱.
 *
 * 사용자 요청(2026-07-23): inset 프리셋 blur 4→8px, color rgba(0,0,0,0.05)→0.16.
 * inset 프리셋은 Skia 에서 renderInnerBoxShadows(nodeRendererBorders)가 box RRect
 * 지오메트리로 직접 그리며(effects.ts 는 inner drop-shadow skip), 그 입력이 되는
 * parseShadow(styleConverter parseOneShadow 도 동형)의 inset:true / blur / alpha 를 잠근다.
 */
describe("shadows — inset 프리셋 값 계약", () => {
  it("inset 프리셋 = 'inset 0 2px 8px 0 rgba(0, 0, 0, 0.16)'", () => {
    expect(lightShadows.inset).toBe("inset 0 2px 8px 0 rgba(0, 0, 0, 0.16)");
  });

  it("parseShadow(inset) → inset:true, offsetY 2, blur 8, alpha 0.16", () => {
    const [s] = parseShadow(lightShadows.inset);
    expect(s.inset).toBe(true);
    expect(s.offsetX).toBe(0);
    expect(s.offsetY).toBe(2);
    expect(s.blur).toBe(8);
    expect(s.alpha).toBe(0.16);
  });

  it("outer 프리셋(lg)은 inset:false (회귀 가드)", () => {
    const parsed = parseShadow(lightShadows.lg);
    expect(parsed.every((s) => s.inset === false)).toBe(true);
  });
});

/**
 * ADR-166 Phase 1 — Adobe Spectrum 2 기반 3단계 스케일 + theme 이원화.
 *
 * 구 스케일은 Tailwind 수치(sm/md/lg/xl)였고 TS map 이 flat 이라 theme 무반응이었다.
 * 그 결과 `{shadow.md}` 가 CSS 축(`--shadow-md`, light/dark 상이)과 Skia 축에서
 * 서로 다른 값을 의미했다. 아래 계약이 그 재발을 잠근다.
 */
describe("shadows — ADR-166 Spectrum 2 스케일 계약", () => {
  const OUTER: (keyof ShadowTokens)[] = ["sm", "md", "lg"];

  it("3단계 outer + none + inset — xl / focus-ring 제거됨", () => {
    expect(Object.keys(lightShadows).sort()).toEqual(
      ["inset", "lg", "md", "none", "sm"].sort(),
    );
    expect(Object.keys(darkShadows).sort()).toEqual(
      Object.keys(lightShadows).sort(),
    );
    expect(lightShadows).not.toHaveProperty("xl");
    expect(lightShadows).not.toHaveProperty("focus-ring");
  });

  it("outer 3단계는 Spectrum 3레이어 레시피 (ambient + transition + key)", () => {
    for (const name of OUTER) {
      expect(parseShadow(lightShadows[name]), `light ${name}`).toHaveLength(3);
      expect(parseShadow(darkShadows[name]), `dark ${name}`).toHaveLength(3);
    }
  });

  it("Spectrum 출처 기하 — sm=emphasized / md=elevated / lg=dragged", () => {
    const geo = (v: string) =>
      parseShadow(v).map((s) => [s.offsetY, s.blur] as const);
    expect(geo(lightShadows.sm)).toEqual([
      [2, 8],
      [1, 4],
      [0, 1],
    ]);
    expect(geo(lightShadows.md)).toEqual([
      [4, 12],
      [2, 6],
      [0, 2],
    ]);
    expect(geo(lightShadows.lg)).toEqual([
      [12, 16],
      [6, 8],
      [0, 6],
    ]);
  });

  it("dark = light 전 레이어 alpha ×3 (Spectrum 규칙), 기하는 동일", () => {
    for (const name of [...OUTER, "inset"] as (keyof ShadowTokens)[]) {
      const l = parseShadow(lightShadows[name]);
      const d = parseShadow(darkShadows[name]);
      expect(d, `${name} 레이어 수`).toHaveLength(l.length);
      l.forEach((ls, i) => {
        expect(d[i].alpha, `${name}[${i}] alpha`).toBeCloseTo(ls.alpha * 3, 5);
        expect(d[i].offsetY, `${name}[${i}] offsetY`).toBe(ls.offsetY);
        expect(d[i].blur, `${name}[${i}] blur`).toBe(ls.blur);
      });
    }
  });

  it("theme 별 값이 실제로 다르다 (구 flat map 회귀 가드)", () => {
    for (const name of OUTER) {
      expect(darkShadows[name], name).not.toBe(lightShadows[name]);
    }
    // none 은 theme 불변
    expect(darkShadows.none).toBe(lightShadows.none);
  });

  it("getShadowToken 이 theme 분기 (기본값 light)", () => {
    expect(getShadowToken("md")).toBe(lightShadows.md);
    expect(getShadowToken("md", "light")).toBe(lightShadows.md);
    expect(getShadowToken("md", "dark")).toBe(darkShadows.md);
  });

  /**
   * 정적 가드 — 토큰 map 값에 var() / color-mix() 금지.
   *
   * ADR-166 Decision 근거 2 의 기계 집행: "값 언어가 TokenRef 로 수렴하면 var/color-mix 가
   * Skia 파서에 도달하지 않는다". 구 `focus-ring` 이 `0 0 0 2px var(--accent)` 로 이 단언의
   * 반례였고(실사용 0건), Phase 1 에서 제거됐다. 재도입 시 Skia 그림자가 불투명 검정으로
   * 낙하한다 (styleConverter parseOneShadow 색 정규식이 var(/color-mix( 미매칭 → 기본값).
   */
  it("토큰 값에 var( / color-mix( 미포함 (Skia 파서 계약)", () => {
    for (const [name, value] of [
      ...Object.entries(lightShadows),
      ...Object.entries(darkShadows),
    ]) {
      expect(value, `${name} — var() 포함`).not.toMatch(/var\(/);
      expect(value, `${name} — color-mix() 포함`).not.toMatch(/color-mix\(/);
    }
  });
});

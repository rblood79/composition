/**
 * ADR-082 Gate G1: `cssVarToTokenRef` 역변환 parser unit test.
 *
 * 목적: `tokenToCSSVar()` 와 `cssVarToTokenRef()` 왕복 매핑 일관성 검증.
 * Composite Spec 의 `composition.gap = "var(--spacing-xs)"` 같은 CSS string 을
 * Style Panel consumer (specPresetResolver) 가 TokenRef 로 역변환 → resolveToken()
 * → 숫자 값 공급 체인의 첫 관문.
 */

import { describe, expect, it } from "vitest";
import {
  tokenToCSSVar,
  cssVarToTokenRef,
  resolveToken,
} from "../tokenResolver";
import { spacing } from "../../../primitives/spacing";
import { radius } from "../../../primitives/radius";
import { typography } from "../../../primitives/typography";
import { lightShadows } from "../../../primitives/shadows";
import type { TokenRef } from "../../../types/token.types";

describe("ADR-082 G1 — cssVarToTokenRef 역변환 parser", () => {
  describe("왕복 매핑 일관성 (spacing/radius/typography/shadow)", () => {
    it("spacing tokens: tokenToCSSVar(cssVarToTokenRef(x)) === x", () => {
      for (const name of Object.keys(spacing)) {
        const cssVar = `var(--spacing-${name})`;
        const token = cssVarToTokenRef(cssVar);
        expect(token, `name=${name}`).toBe(`{spacing.${name}}`);
        expect(tokenToCSSVar(token!)).toBe(cssVar);
      }
    });

    it("radius tokens: 왕복 일치", () => {
      for (const name of Object.keys(radius)) {
        const cssVar = `var(--radius-${name})`;
        const token = cssVarToTokenRef(cssVar);
        expect(token, `name=${name}`).toBe(`{radius.${name}}`);
        expect(tokenToCSSVar(token!)).toBe(cssVar);
      }
    });

    it("typography tokens: 왕복 일치 (text-md 제외)", () => {
      // text-md 는 tokenToCSSVar 에서 text-base 로 매핑되는 특례 (CSS 변수 미정의).
      // text-md 자체는 resolveToken 이 숫자로 해석하지만 CSS 변환 시 text-base 로 리라우트됨.
      // 역변환은 var(--text-base) → {typography.text-base} 로 돌아오므로 text-md 는 제외.
      for (const name of Object.keys(typography)) {
        if (name === "text-md") continue;
        const cssVar = `var(--${name})`;
        const token = cssVarToTokenRef(cssVar);
        expect(token, `name=${name}`).toBe(`{typography.${name}}`);
        expect(tokenToCSSVar(token!)).toBe(cssVar);
      }
    });

    it("typography text-md 특례: text-base 로 수렴", () => {
      expect(tokenToCSSVar("{typography.text-md}" as TokenRef)).toBe(
        "var(--text-base)",
      );
      // 역변환은 text-base 로 반환 (text-md 식별자 정보 소실)
      const back = cssVarToTokenRef("var(--text-base)");
      expect(back).toBe("{typography.text-base}");
    });

    it("shadow tokens: 왕복 일치", () => {
      for (const name of Object.keys(lightShadows)) {
        const cssVar = `var(--shadow-${name})`;
        const token = cssVarToTokenRef(cssVar);
        expect(token, `name=${name}`).toBe(`{shadow.${name}}`);
        expect(tokenToCSSVar(token!)).toBe(cssVar);
      }
    });
  });

  describe("color tokens — 단순 var(--xxx) 매핑만 역변환 지원", () => {
    it("semantic 색상 역변환 (accent/neutral/base/raised/border 등)", () => {
      // COLOR_TOKEN_TO_CSS 에서 단순 var() 형식만 역변환 가능
      expect(cssVarToTokenRef("var(--accent)")).toBe("{color.accent}");
      expect(cssVarToTokenRef("var(--fg)")).toBe("{color.neutral}");
      expect(cssVarToTokenRef("var(--bg)")).toBe("{color.base}");
      expect(cssVarToTokenRef("var(--bg-raised)")).toBe("{color.raised}");
      expect(cssVarToTokenRef("var(--bg-overlay)")).toBe("{color.layer-1}");
      expect(cssVarToTokenRef("var(--bg-inset)")).toBe("{color.layer-2}");
      expect(cssVarToTokenRef("var(--border)")).toBe("{color.border}");
      expect(cssVarToTokenRef("var(--negative)")).toBe("{color.negative}");
    });

    it("복합 색상 표현 (color-mix, oklch) 은 역변환 불가 — null", () => {
      // COLOR_TOKEN_TO_CSS 에서 color-mix(...) / oklch(...) 값은 역방향 Map 에 등록 안 됨
      expect(
        cssVarToTokenRef("color-mix(in srgb, var(--accent) 85%, black)"),
      ).toBeNull();
      expect(cssVarToTokenRef("oklch(0.45 0.2 284)")).toBeNull();
    });
  });

  describe("미등록 CSS var — null 반환 (silent fail)", () => {
    it("사용자 정의 var 은 null", () => {
      expect(cssVarToTokenRef("var(--btn-radius)")).toBeNull();
      expect(cssVarToTokenRef("var(--custom-unknown)")).toBeNull();
      expect(cssVarToTokenRef("var(--label-font-size)")).toBeNull();
    });

    it("CSS 값이 아닌 문자열 — null", () => {
      expect(cssVarToTokenRef("10px")).toBeNull();
      expect(cssVarToTokenRef("#FFFFFF")).toBeNull();
      expect(cssVarToTokenRef("{spacing.xs}")).toBeNull();
      expect(cssVarToTokenRef("")).toBeNull();
    });

    it("비문자열 입력 — null (방어)", () => {
      // @ts-expect-error — 런타임 방어 확인
      expect(cssVarToTokenRef(42)).toBeNull();
      // @ts-expect-error — 런타임 방어 확인
      expect(cssVarToTokenRef(null)).toBeNull();
      // @ts-expect-error — 런타임 방어 확인
      expect(cssVarToTokenRef(undefined)).toBeNull();
    });
  });

  describe("체인 통합 — cssVarToTokenRef → resolveToken", () => {
    it("var(--spacing-xs) → {spacing.xs} → 4", () => {
      const token = cssVarToTokenRef("var(--spacing-xs)");
      expect(token).toBe("{spacing.xs}");
      expect(resolveToken(token!)).toBe(4);
    });

    it("var(--spacing-2xs) → {spacing.2xs} → 2", () => {
      const token = cssVarToTokenRef("var(--spacing-2xs)");
      expect(token).toBe("{spacing.2xs}");
      expect(resolveToken(token!)).toBe(2);
    });

    it("var(--radius-lg) → {radius.lg} → 8", () => {
      const token = cssVarToTokenRef("var(--radius-lg)");
      expect(token).toBe("{radius.lg}");
      expect(resolveToken(token!)).toBe(8);
    });

    it("var(--text-sm) → {typography.text-sm} → 14", () => {
      const token = cssVarToTokenRef("var(--text-sm)");
      expect(token).toBe("{typography.text-sm}");
      expect(resolveToken(token!)).toBe(14);
    });
  });
});

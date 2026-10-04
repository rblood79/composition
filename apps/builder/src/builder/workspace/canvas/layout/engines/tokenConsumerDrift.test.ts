/**
 * ADR-081 Gate G2: token consumer drift cross-reference.
 *
 * primitives(spacing/radius/typography) 값이 변경되면 소비자 경로 3종이 자동 감지.
 * 각 consumer 별로 snapshot 고정하여 primitives 값 drift 발생 시 test 실패 + 실패
 * 메시지에 drift 위치(token · 소비자 · 기대 · 실제) 명시.
 *
 * 소비자 경로 (ADR-081 Context):
 * - **C1 (매핑 회귀)**: `tokenToCSSVar()` — `{spacing.xs}` → `"var(--spacing-xs)"` 문자열.
 *   primitive 숫자값 변경과 독립 (map prefix/name 규칙 변경만 감지).
 * - **C2 (값 drift)**: `resolveToken()` — `{spacing.xs}` → 숫자 4. primitives 값 변경 감지.
 * - **C3 (값 drift)**: `resolveContainerStylesFallback()` — ADR-080 P1 helper 반환 resolved 숫자.
 *   ListBox containerStyles TokenRef(`{spacing.xs}`, `{spacing.2xs}`) → 숫자 값.
 *
 * C4 scope 제외: `useContainerStyleDefault` 는 display/flexDirection/alignItems/
 * justifyContent 4종만 읽고 resolved 숫자 TokenRef 경로 없음. 향후 hook 확장 시 포함.
 *
 * G3 실증 시나리오: `spacing.xs` 를 4→6 으로 임시 변경 → C2/C3 snapshot outdated FAIL,
 * C1 은 PASS 유지 (매핑 규칙은 값과 독립). 실증 후 원복하여 snapshot 일치 복원.
 */

import { describe, expect, it } from "vitest";
import { resolveToken, tokenToCSSVar } from "@composition/rendering";
import { spacing, radius, typography } from "@composition/rendering";
import type { TokenRef } from "@composition/rendering";
import { resolveContainerStylesFallback } from "./implicitStyles";

describe("ADR-081 G2 — token consumer drift cross-reference", () => {
  describe("C1 — tokenToCSSVar 매핑 회귀 (CSS var 문자열)", () => {
    it("spacing tokens → var(--spacing-*) 매핑", () => {
      const mapped = Object.fromEntries(
        Object.keys(spacing).map((name) => [
          name,
          tokenToCSSVar(`{spacing.${name}}` as TokenRef),
        ]),
      );
      expect(mapped).toMatchSnapshot();
    });

    it("radius tokens → var(--radius-*) 매핑", () => {
      const mapped = Object.fromEntries(
        Object.keys(radius).map((name) => [
          name,
          tokenToCSSVar(`{radius.${name}}` as TokenRef),
        ]),
      );
      expect(mapped).toMatchSnapshot();
    });

    it("typography tokens → var(--text-*) 매핑 (text-md → text-base 예외 포함)", () => {
      const mapped = Object.fromEntries(
        Object.keys(typography).map((name) => [
          name,
          tokenToCSSVar(`{typography.${name}}` as TokenRef),
        ]),
      );
      expect(mapped).toMatchSnapshot();
    });
  });

  describe("C2 — resolveToken 값 drift (Skia 렌더 경로 소비)", () => {
    it("spacing resolved values", () => {
      const resolved = Object.fromEntries(
        Object.keys(spacing).map((name) => [
          name,
          resolveToken(`{spacing.${name}}` as TokenRef),
        ]),
      );
      expect(resolved).toMatchSnapshot();
    });

    it("radius resolved values", () => {
      const resolved = Object.fromEntries(
        Object.keys(radius).map((name) => [
          name,
          resolveToken(`{radius.${name}}` as TokenRef),
        ]),
      );
      expect(resolved).toMatchSnapshot();
    });

    it("typography resolved values (fontSize + line-height)", () => {
      const resolved = Object.fromEntries(
        Object.keys(typography).map((name) => [
          name,
          resolveToken(`{typography.${name}}` as TokenRef),
        ]),
      );
      expect(resolved).toMatchSnapshot();
    });
  });

  describe("C3 — resolveContainerStylesFallback 값 drift (Layout engine, ADR-080)", () => {
    it("listbox empty parentStyle → resolved 4속성 snapshot", () => {
      const fb = resolveContainerStylesFallback("listbox", {});
      expect(fb).toMatchSnapshot();
    });

    it("listbox.gap === spacing.2xs (primitives 직접 비교)", () => {
      const fb = resolveContainerStylesFallback("listbox", {});
      expect(fb.gap, "C3 drift: listbox.gap !== spacing.2xs").toBe(
        spacing["2xs"],
      );
    });

    it("listbox.padding === spacing.xs (primitives 직접 비교)", () => {
      const fb = resolveContainerStylesFallback("listbox", {});
      expect(fb.padding, "C3 drift: listbox.padding !== spacing.xs").toBe(
        spacing.xs,
      );
    });
  });
});

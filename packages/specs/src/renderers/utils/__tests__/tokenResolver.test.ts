import { describe, it, expect } from "vitest";
import { tokenToCSSVar, resolveToken } from "../tokenResolver";

describe("tokenResolver — surface elevation", () => {
  it("{color.raised} maps to var(--bg-raised)", () => {
    expect(tokenToCSSVar("{color.raised}")).toBe("var(--bg-raised)");
  });

  it("{color.base} maps to var(--bg) (baseline)", () => {
    expect(tokenToCSSVar("{color.base}")).toBe("var(--bg)");
  });

  it("{color.layer-1} maps to var(--bg-overlay) (baseline)", () => {
    expect(tokenToCSSVar("{color.layer-1}")).toBe("var(--bg-overlay)");
  });
});

describe("tokenResolver — spacing 2xs primitive", () => {
  it("{spacing.2xs} resolves to 2 (px)", () => {
    expect(resolveToken("{spacing.2xs}")).toBe(2);
  });

  it("{spacing.2xs} maps to var(--spacing-2xs)", () => {
    expect(tokenToCSSVar("{spacing.2xs}")).toBe("var(--spacing-2xs)");
  });

  it("{spacing.xs} still resolves to 4 (baseline unaffected)", () => {
    expect(resolveToken("{spacing.xs}")).toBe(4);
  });
});

/**
 * ADR-913 slice 5 (2026-06-19) — radius xs/2xl primitive 누락 회귀 게이트.
 *
 * **갭**: shared-tokens.css 가 `--radius-xs:0.125rem`(2px) / `--radius-2xl:1rem`(16px) 를
 * 정의하고 catalog COMPONENT_RULES_TABLE 가 `{radius.xs}` 10회 / `{radius.2xl}` 3회
 * (Dialog lg/xl + Form + ComboBox/DatePicker/Table/Tree/Breadcrumbs 등) 참조하는데,
 * primitives `radius` 객체 + `RadiusTokens` 타입에 두 키가 없어 → resolveToken 이
 * undefined 반환 → specShapeConverter `parseFloat(String(undefined))||0` = 0px.
 * DOM 은 16px/2px 모서리, Skia 는 0px → D3 symmetric(Skia↔CSS) 위반.
 *
 * **fix**: radius.ts 에 xs:2 / 2xl:16 추가(shared-tokens.css 값 1:1) + RadiusTokens
 * 인터페이스에 두 키 추가(RadiusTokenRef 템플릿이 {radius.xs}/{radius.2xl} 를 type-valid 화).
 * 3xl/4xl 은 CSS 정의는 있으나 catalog 미사용 → 추가 안 함(0 drift). 토큰 *정의* 불변,
 * 신규 키만 추가 = R2 re-scale 없음.
 */
describe("tokenResolver — radius xs/2xl primitive (ADR-913 slice 5 — Skia↔CSS 대칭)", () => {
  it("{radius.xs} resolves to 2 (px) — was undefined→0px in Skia", () => {
    expect(resolveToken("{radius.xs}")).toBe(2);
  });

  it("{radius.2xl} resolves to 16 (px) — was undefined→0px in Skia", () => {
    expect(resolveToken("{radius.2xl}")).toBe(16);
  });

  it("{radius.xs} maps to var(--radius-xs) (shared-tokens.css 0.125rem=2px)", () => {
    expect(tokenToCSSVar("{radius.xs}")).toBe("var(--radius-xs)");
  });

  it("{radius.2xl} maps to var(--radius-2xl) (shared-tokens.css 1rem=16px)", () => {
    expect(tokenToCSSVar("{radius.2xl}")).toBe("var(--radius-2xl)");
  });

  it("기존 radius 키 baseline 불변 (sm=4/md=6/lg=8/xl=12)", () => {
    expect(resolveToken("{radius.sm}")).toBe(4);
    expect(resolveToken("{radius.md}")).toBe(6);
    expect(resolveToken("{radius.lg}")).toBe(8);
    expect(resolveToken("{radius.xl}")).toBe(12);
  });
});

import { describe, expect, it } from "vitest";

import { resolveFillTokens } from "../../../utils/fillTokens";
import type { VariantSpec } from "../../../types";
import type { ComponentSpec } from "../../../types";
import {
  resolveComponentVisual,
  variantToVisual,
} from "../resolveComponentVisual";

/**
 * ADR-142 G2(b) A — resolveComponentVisual 어댑터 계약.
 *
 * buildCatalogShapes(Skia) + CSSGenerator(DOM)가 spec.variants 를 직접 읽던 것을 본 어댑터로
 * 수렴. B 단계 swap 후에도 ComponentVisualRule 필드 집합 = VariantSpec 색상 필드 전수여야
 * DOM↔Skia 대칭이 보존된다. 누락 시 본 테스트가 감지.
 *
 * Button.spec.ts 삭제(ADR-912 box+text leaf 군, 2026-06-11) 로 ButtonSpec import 소멸.
 * 인라인 fixture spec(fillFixtureSpec) 으로 교체 — resolveComponentVisual 함수 동작 검증 보존.
 */

// 인라인 fixture spec — ButtonSpec 대체 (variants/defaultVariant/fill 최소 구조).
// buildCatalogShapes.test.ts 의 fillFixtureSpec 패턴과 동일.
const fixtureVariant = {
  fill: {
    default: {
      base: "{color.accent}",
      hover: "{color.accent-hover}",
      pressed: "{color.accent-pressed}",
    },
    outline: { base: "{color.transparent}" },
    subtle: { base: "{color.accent-subtle}" },
  },
  text: "{color.on-accent}",
  textHover: "{color.on-accent}",
  border: "{color.accent}",
  borderHover: "{color.accent}",
  outlineText: "{color.accent}",
  outlineBorder: "{color.border-hover}",
  subtleText: "{color.accent}",
  selectedText: "{color.on-accent}",
  selectedBorder: "{color.accent}",
  emphasizedSelectedText: "{color.on-accent}",
  emphasizedSelectedBorder: "{color.accent}",
} as unknown as VariantSpec;

const fixtureSpec = {
  defaultVariant: "primary",
  variants: {
    primary: fixtureVariant,
    secondary: {
      fill: { default: { base: "{color.neutral-subtle}" } },
      text: "{color.neutral}",
      border: "{color.border}",
    } as unknown as VariantSpec,
    negative: {
      fill: { default: { base: "{color.negative}" } },
      text: "{color.on-accent}",
      border: "{color.negative}",
    } as unknown as VariantSpec,
  },
} as unknown as ComponentSpec<Record<string, unknown>>;

describe("resolveComponentVisual — VariantSpec 색상 필드 전수 매핑", () => {
  it("VariantSpec 의 모든 색상 필드가 ComponentVisualRule 에 매핑된다 (fill 제외)", () => {
    // VariantSpec 색상 필드 (spec.types.ts VariantSpec) — fill 은 별도 FillTokenSpec.
    const VARIANT_COLOR_KEYS: (keyof VariantSpec)[] = [
      "text",
      "textHover",
      "border",
      "borderHover",
      "outlineText",
      "outlineBorder",
      "subtleText",
      "selectedText",
      "selectedBorder",
      "emphasizedSelectedText",
      "emphasizedSelectedBorder",
    ];
    // 임의 토큰으로 모든 색상 필드 채운 variant
    const variant = {
      fill: { default: { base: "{color.accent}" } },
      text: "{color.neutral}",
      textHover: "{color.neutral-hover}",
      border: "{color.border}",
      borderHover: "{color.border-hover}",
      outlineText: "{color.accent}",
      outlineBorder: "{color.accent}",
      subtleText: "{color.neutral-subdued}",
      selectedText: "{color.on-accent}",
      selectedBorder: "{color.accent}",
      emphasizedSelectedText: "{color.on-accent}",
      emphasizedSelectedBorder: "{color.accent}",
    } as unknown as VariantSpec;

    const visual = variantToVisual(variant);
    for (const key of VARIANT_COLOR_KEYS) {
      expect(visual[key as keyof typeof visual], `${key} 매핑`).toBe(
        variant[key],
      );
    }
    // fill 은 resolveFillTokens 결과와 동일
    expect(visual.fill).toEqual(resolveFillTokens(variant));
  });

  it("fixture defaultVariant 의 visual 이 resolveFillTokens 와 일치", () => {
    const dv = fixtureSpec.defaultVariant;
    const visual = resolveComponentVisual(fixtureSpec, dv);
    expect(visual).toBeDefined();
    const variant = fixtureSpec.variants![dv!] as VariantSpec;
    expect(visual!.fill).toEqual(resolveFillTokens(variant));
    expect(visual!.text).toBe(variant.text);
    expect(visual!.border).toBe(variant.border);
  });

  it("fixture 의 모든 variant 가 resolveComponentVisual 로 resolve 된다", () => {
    for (const name of Object.keys(fixtureSpec.variants!)) {
      const visual = resolveComponentVisual(fixtureSpec, name);
      expect(visual, `variant ${name}`).toBeDefined();
      expect(visual!.fill, `variant ${name} fill`).toBeDefined();
    }
  });

  it("variant 미존재 / variants 없는 spec 은 undefined", () => {
    expect(resolveComponentVisual(fixtureSpec, "nonexistent")).toBeUndefined();
    const noVariantsSpec = {
      ...fixtureSpec,
      variants: undefined,
      defaultVariant: undefined,
    } as typeof fixtureSpec;
    expect(resolveComponentVisual(noVariantsSpec, undefined)).toBeUndefined();
  });
});

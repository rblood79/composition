import { describe, expect, it } from "vitest";

import { ButtonSpec } from "../../../components/Button.spec";
import { resolveFillTokens } from "../../../utils/fillTokens";
import type { VariantSpec } from "../../../types";
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
 */
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

  it("ButtonSpec defaultVariant 의 visual 이 resolveFillTokens 와 일치 (실제 spec parity)", () => {
    const dv = ButtonSpec.defaultVariant;
    const visual = resolveComponentVisual(ButtonSpec, dv);
    expect(visual).toBeDefined();
    const variant = ButtonSpec.variants![dv!] as VariantSpec;
    expect(visual!.fill).toEqual(resolveFillTokens(variant));
    expect(visual!.text).toBe(variant.text);
    expect(visual!.border).toBe(variant.border);
  });

  it("ButtonSpec 의 모든 variant 가 resolveComponentVisual 로 resolve 된다", () => {
    for (const name of Object.keys(ButtonSpec.variants!)) {
      const visual = resolveComponentVisual(ButtonSpec, name);
      expect(visual, `variant ${name}`).toBeDefined();
      expect(visual!.fill, `variant ${name} fill`).toBeDefined();
    }
  });

  it("variant 미존재 / variants 없는 spec 은 undefined", () => {
    expect(resolveComponentVisual(ButtonSpec, "nonexistent")).toBeUndefined();
    const noVariantsSpec = {
      ...ButtonSpec,
      variants: undefined,
      defaultVariant: undefined,
    } as typeof ButtonSpec;
    expect(resolveComponentVisual(noVariantsSpec, undefined)).toBeUndefined();
  });
});

/**
 * ADR-908 Phase 4 — Fill token SSOT accessor 검증
 *
 * Phase 2/3 의 dual-read seam 은 Phase 4 legacy 제거로 단순화됨.
 * `resolveFillTokens()` / `resolveIndicatorFill()` 는 이제 pass-through
 * accessor — VariantSpec / IndicatorModeSpec 의 `fill` 을 그대로 반환한다.
 *
 * 본 테스트는 accessor 의 계약을 고정 (consumer 가 단일 진입점으로 접근)
 * 하여 향후 merge/override 등 확장 시 회귀 방지 목적으로 유지.
 */

import { describe, it, expect } from "vitest";
import {
  resolveFillTokens,
  resolveIndicatorFill,
} from "@composition/rendering/utils/fillTokens";
import type {
  FillStateTokens,
  FillTokenSpec,
  IndicatorModeSpec,
  TokenRef,
  VariantSpec,
} from "@composition/rendering/types/spec.types";

const T = (s: string): TokenRef => s as TokenRef;

describe("resolveFillTokens — VariantSpec SSOT accessor (Phase 4)", () => {
  it("variant.fill 을 그대로 반환 (pass-through)", () => {
    const fill: FillTokenSpec = {
      default: {
        base: T("{color.accent}"),
        hover: T("{color.accent-hover}"),
        pressed: T("{color.accent-pressed}"),
      },
    };
    const variant: VariantSpec = { fill, text: T("{color.on-accent}") };
    expect(resolveFillTokens(variant)).toBe(fill);
  });

  it("partial fill (default.base 만) 도 동일 참조 반환", () => {
    const fill: FillTokenSpec = { default: { base: T("{color.neutral}") } };
    const variant: VariantSpec = { fill, text: T("{color.base}") };
    expect(resolveFillTokens(variant)).toBe(fill);
  });

  it("fill 에 outline/subtle/alpha 확장 모두 반환", () => {
    const fill: FillTokenSpec = {
      default: { base: T("{color.accent}") },
      outline: { base: T("{color.transparent}") },
      subtle: { base: T("{color.neutral-subtle}") },
      alpha: 0.8,
    };
    const variant: VariantSpec = { fill, text: T("{color.neutral}") };
    const resolved = resolveFillTokens(variant);
    expect(resolved.outline?.base).toBe("{color.transparent}");
    expect(resolved.subtle?.base).toBe("{color.neutral-subtle}");
    expect(resolved.alpha).toBe(0.8);
  });
});

describe("resolveIndicatorFill — IndicatorModeSpec SSOT accessor (Phase 4)", () => {
  it("im.fill 을 그대로 반환", () => {
    const fill: FillStateTokens = {
      base: T("{color.layer-1}"),
      pressed: T("{color.layer-2}"),
    };
    const im: IndicatorModeSpec = {
      fill,
      selectedText: T("{color.on-accent}"),
    };
    expect(resolveIndicatorFill(im)).toBe(fill);
  });
});

/**
 * ADR-908 Phase 4 — Fill token SSOT accessor
 *
 * Phase 2/3 의 dual-read seam 이 Phase 4 legacy 제거로 단순화됨. VariantSpec /
 * IndicatorModeSpec 이 `fill` single source 로 통합됐으므로 본 helper 는 지금은
 * pass-through 에 가깝지만, consumer 가 단일 진입점으로 `fill` 에 접근한다는
 * 계약을 유지하기 위해 보존 (향후 merge/override 등 확장 지점).
 *
 * Phase 2 의 `variantSpecToFillTokens()` 및 legacy background 필드 fallback 분기는
 * Phase 4-b 에서 VariantSpec/IndicatorModeSpec 타입 legacy 필드 삭제와 함께 제거됨.
 */

import type {
  FillStateTokens,
  FillTokenSpec,
  IndicatorModeSpec,
  VariantSpec,
} from "../types/spec.types";

/**
 * VariantSpec 의 fill 토큰 반환 (Phase 4 SSOT accessor).
 *
 * Phase 2 의 dual-read seam 은 legacy 제거로 단일 경로만 남음. `variant.fill` 은
 * required 이므로 undefined 가능성 없음.
 */
export function resolveFillTokens(variant: VariantSpec): FillTokenSpec {
  return variant.fill;
}

/**
 * IndicatorModeSpec 의 fill 토큰 반환 (Phase 4 SSOT accessor).
 */
export function resolveIndicatorFill(im: IndicatorModeSpec): FillStateTokens {
  return im.fill;
}

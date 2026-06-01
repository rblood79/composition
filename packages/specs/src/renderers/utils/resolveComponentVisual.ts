/**
 * ADR-142 G2(b) A 단계 — 컴포넌트 시각 규칙 단일 어댑터 seam.
 *
 * **목적**: buildCatalogShapes(Skia)와 CSSGenerator(DOM)가 `spec.variants[name]` 의 색상 필드를
 * **각자 직접** 읽던 것을 본 어댑터 1개로 수렴한다. ADR-142 근본 목적(spec 폐기 → theme/tokens
 * SSOT 이전)의 회귀 안전 계단 — B 단계에서 본 어댑터 **내부**의 data-source 만 `spec.variants` →
 * `resolveComponentRule(type, doc)` rule 테이블로 swap 하면 호출부(2 consumer)는 불변이다.
 *
 * **전환기 (A 단계)**: 내부는 아직 `spec.variants[name]` + `resolveFillTokens(variant)` 를 읽는다.
 * 이는 CSS Preview consumer 가 이미 CSSGenerator(build-time) 뒤에서 spec 을 읽는 것과 동급 —
 * runtime consumer(Skia/Panel)의 spec 직접 접근만 본 어댑터 뒤로 격리하는 것이 A 의 기여.
 *
 * **불변식 (B swap 후에도 유지)**: `ComponentVisualRule` 의 필드 집합 = VariantSpec 의 색상 필드
 * 전수. 필드 추가 시 본 인터페이스 + 매핑 1곳만 수정 → 2 consumer 자동 반영(DOM↔Skia 대칭).
 *
 * 설계: ~/.claude/plans/zippy-wibbling-origami.md §"A 단계"
 */

import type {
  ComponentSpec,
  FillTokenSpec,
  TokenRef,
  VariantSpec,
} from "../../types";
import { resolveFillTokens } from "../../utils/fillTokens";

/**
 * 단일 variant 의 시각 규칙 — fill(2축) + 비-fill 색상(text/border 계열).
 *
 * VariantSpec 의 색상 필드 전수 투영. fill 은 ADR-908 FillTokenSpec(fillStyle×state 2축),
 * 비-fill 은 VariantSpec 직접 필드(ADR-908 §"비-background 색상" 보존).
 */
export interface ComponentVisualRule {
  /** fillStyle × state 2축 배경 토큰 (ADR-908). variant 없으면 undefined. */
  fill: FillTokenSpec | undefined;
  /** 기본 텍스트 색 */
  text: TokenRef | undefined;
  /** hover 텍스트 색 (미지정 시 consumer 가 text fallback) */
  textHover: TokenRef | undefined;
  /** 기본 테두리 색 */
  border: TokenRef | undefined;
  /** hover 테두리 색 */
  borderHover: TokenRef | undefined;
  /** outline fillStyle 텍스트 색 */
  outlineText: TokenRef | undefined;
  /** outline fillStyle 테두리 색 */
  outlineBorder: TokenRef | undefined;
  /** subtle fillStyle 텍스트 색 */
  subtleText: TokenRef | undefined;
  /** selected 상태 텍스트 색 */
  selectedText: TokenRef | undefined;
  /** selected 상태 테두리 색 */
  selectedBorder: TokenRef | undefined;
  /** data-emphasized + data-selected 텍스트 색 */
  emphasizedSelectedText: TokenRef | undefined;
  /** data-emphasized + data-selected 테두리 색 */
  emphasizedSelectedBorder: TokenRef | undefined;
}

/**
 * 컴포넌트 + variant 이름 → 시각 규칙. variant 미존재 시 undefined.
 *
 * variantName 미지정 시 spec.defaultVariant 사용. B 단계에서 본 함수 내부만 rule 테이블 읽기로
 * swap 하고 호출부(buildCatalogShapes / CSSGenerator)는 불변 유지.
 */
export function resolveComponentVisual(
  spec: ComponentSpec<Record<string, unknown>>,
  variantName: string | undefined,
): ComponentVisualRule | undefined {
  const vName = variantName ?? spec.defaultVariant;
  if (!vName || !spec.variants) return undefined;
  const variant = spec.variants[vName] as VariantSpec | undefined;
  if (!variant) return undefined;
  return variantToVisual(variant);
}

/**
 * VariantSpec → ComponentVisualRule 매핑 (CSSGenerator 가 variant 객체를 직접 순회할 때 재사용).
 * `resolveComponentVisual` 과 동일 매핑 — 단일 진입점 유지.
 */
export function variantToVisual(variant: VariantSpec): ComponentVisualRule {
  return {
    fill: resolveFillTokens(variant),
    text: variant.text,
    textHover: variant.textHover,
    border: variant.border,
    borderHover: variant.borderHover,
    outlineText: variant.outlineText,
    outlineBorder: variant.outlineBorder,
    subtleText: variant.subtleText,
    selectedText: variant.selectedText,
    selectedBorder: variant.selectedBorder,
    emphasizedSelectedText: variant.emphasizedSelectedText,
    emphasizedSelectedBorder: variant.emphasizedSelectedBorder,
  };
}

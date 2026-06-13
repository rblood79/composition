/**
 * ADR-142 G2(b) A 단계 — 컴포넌트 시각 규칙 단일 어댑터 seam.
 *
 * ⚠️ **production-dead (ADR-912 1A-(a), 2026-06-03)**: 아래 `resolveComponentVisual` / `variantToVisual`
 *   함수는 더 이상 production 경로에서 호출되지 않는다. 마지막 production 소비자였던 `CSSGenerator.ts:232`
 *   가 ②-6-A 로 정본 table 주입(`_variantSource`)으로 전환했고, Skia 는 이미 별도 `ruleVariantToVisual`
 *   (builder)을 쓴다. 현재 유일 사용처는 **test fixture**(resolveSkiaVisualRule.test.ts 의 spec 추종 검증 +
 *   buildCatalogShapes/composeCatalogShapes/skiaPrimitives test 의 visual 생성). **단계 5 에서 spec 124 +
 *   본 함수 물리 삭제** 예정. `ComponentVisualRule` *타입* 은 buildCatalogShapes/skiaPrimitives 가 계속
 *   import 하므로 **유지**(살아있는 시각 규칙 인터페이스 — 함수만 dead).
 *
 * (역사) ADR-142: buildCatalogShapes(Skia)와 CSSGenerator(DOM)가 `spec.variants[name]` 색상을 각자 직접
 *   읽던 것을 본 어댑터 1개로 수렴. ADR-912 ②-6-A 에서 DOM 이 정본 table 주입으로 전환하며 함수 dead 화.
 *
 * **불변식**: `ComponentVisualRule` 의 필드 집합 = VariantSpec 의 색상 필드 전수. (table 정본의
 *   `ruleVariantToVisual`[builder/generate-css] 도 동일 필드 매핑 — DOM↔Skia 대칭 유지.)
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
  /** 텍스트 굵기 (CSS font-weight 동형, 미지정 시 consumer 가 기본 굵기 fallback) */
  textWeight: number | undefined;
  /** 폰트 패밀리 (CSS font-family 동형 — Code/Kbd mono, 미지정 시 consumer 가 sans fallback) */
  fontFamily: string | undefined;
  /** 기본 테두리 색 */
  border: TokenRef | undefined;
  /** hover 테두리 색 */
  borderHover: TokenRef | undefined;
  /** 테두리 선 스타일 (CSS border-style 동형, 미지정 시 consumer 가 "solid" fallback) */
  borderStyle: "solid" | "dashed" | "dotted" | undefined;
  /**
   * value 채움 색 (progress/meter/slider 의 value_fill_bar/value_fill_arc primitive 색).
   * 미지정 시 escape 가 "{color.accent}" fallback (ADR-912 선행-2).
   */
  fillBar: TokenRef | undefined;
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
  /**
   * leading icon (텍스트 좌측 아이콘 — DisclosureHeader chevron 등, ADR-912 (B+icon)).
   * `leading_icon` skiaPrimitive(append 모드)가 본 필드 name/color 로 chevron 을 그리고,
   * buildCatalogShapes 가 `size.iconSize` 존재 시 text x 를 `iconSize + gap` 만큼 우측 shift.
   * DOM 은 부모 컴포넌트가 self-compose → Skia generic 재현 전용.
   */
  leadingIcon: { name: string; gap?: number; color?: TokenRef } | undefined;
  /**
   * trailing icon (텍스트 우측 아이콘 — CalendarHeader 다음달 chevron 등, ADR-912 (B+icon)).
   * `inline_icon_text` skiaPrimitive(replace 모드)가 본 필드와 leadingIcon + center text 를
   * 함께 그린다(좌 icon + center text + 우 icon = leading_icon 의 좌측 단일 모델과 다른
   * 레이아웃 가정 → 별도 module). 우측 배치는 containerWidth 의존(CONTAINER_DIMENSION_TAGS).
   * DOM 은 부모 컴포넌트가 self-compose(Calendar/RangeCalendar `<header>`) → Skia generic 재현 전용.
   */
  trailingIcon:
    | { name: string; gap?: number; color?: TokenRef; showProp?: string }
    | undefined;
  /**
   * 텍스트 정렬 (CSS text-align 동형, ADR-912 (B+icon)). `inline_icon_text` 가 center text
   * 배치에 사용. 미지정 시 consumer 기본(box=center / inline=left / leading_icon=left).
   * leading+trailing icon 동반 center text(CalendarHeader)는 본 필드 "center" 필수.
   */
  textAlign: "left" | "center" | "right" | undefined;
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
    textWeight: variant.textWeight,
    // transition adapter(spec variant)는 fontFamily 정보 없음 — production 은 rule 경로
    // (ruleVariantToVisual)에서 v.fontFamily 투영. 본 adapter 는 test fixture/CSSGenerator 용.
    fontFamily: undefined,
    border: variant.border,
    borderHover: variant.borderHover,
    borderStyle: variant.borderStyle,
    // production-dead(test fixture 전용) — value-fill 색은 production 의 ruleVariantToVisual 만
    //   rule.fillBar 에서 채운다. VariantSpec 에는 fillBar 필드 없음(spec 삭제 예정) → undefined.
    fillBar: undefined,
    outlineText: variant.outlineText,
    outlineBorder: variant.outlineBorder,
    subtleText: variant.subtleText,
    selectedText: variant.selectedText,
    selectedBorder: variant.selectedBorder,
    emphasizedSelectedText: variant.emphasizedSelectedText,
    emphasizedSelectedBorder: variant.emphasizedSelectedBorder,
    // production-dead(test fixture 전용) — leadingIcon/trailingIcon/textAlign 은 production 의
    //   ruleVariantToVisual 만 rule 에서 채운다. VariantSpec 에는 해당 필드 없음(spec 삭제 예정).
    leadingIcon: undefined,
    trailingIcon: undefined,
    textAlign: undefined,
  };
}

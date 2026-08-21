/**
 * 컴포넌트 시각 규칙 어댑터 — `ComponentVisualRule` 타입(정본) + `variantToVisual` /
 *   `resolveComponentVisual` (**test-only utility**).
 *
 * **`ComponentVisualRule` 타입 = production 정본 (영구 유지)**: buildCatalogShapes / skiaPrimitives /
 *   CSSGenerator / resolveSkiaVisualRule(builder) / generate-css 가 import 하는 살아있는 시각 규칙
 *   인터페이스. DOM(CSSGenerator) ↔ Skia(buildCatalogShapes) 대칭의 데이터 shape 계약.
 *
 * ⚠️ **`resolveComponentVisual` / `variantToVisual` 함수 = test-only (ADR-912 단계5, 2026-06-18)**:
 *   production 경로에서 호출 0. CSSGenerator 는 `_variantSource`(rule table 파생, generate-css 의
 *   `variantSourceFor`) 단독으로 variant 색상을 읽고, Skia 는 builder `ruleVariantToVisual` 를 쓴다.
 *   본 두 함수는 **test fixture 가 spec.variants → ComponentVisualRule 로 변환**하는 데만 쓰인다
 *   (callCatalogShapes / buildCatalogShapes.test / CSSGenerator snapshot·containerStyles test /
 *   resolveComponentVisual.test 의 필드-매핑 계약 검증 + builder resolveSkiaVisualRule.test 의 drift
 *   검증). production `variantSourceFor`(rule 기반) 와 동형 출력을 내는 **대칭 쌍 (spec fixture 기반)** —
 *   test 가 production 과 같은 _variantSource 입력을 합성할 수 있게 하는 정당한 test 자산.
 *
 * **production import 차단**: barrel(`renderers/index.ts` / `src/index.ts`)에서 두 함수의 re-export 를
 *   제거했다(ADR-912 단계5). production 코드가 `@composition/specs` 로 이 함수를 끌어올 경로 없음 —
 *   test 는 직접 경로(`../utils/resolveComponentVisual`)로만 import. (타입 ComponentVisualRule 은
 *   barrel re-export 유지 — production 정본 인터페이스.)
 *
 * **불변식**: `ComponentVisualRule` 의 필드 집합 = VariantSpec 의 색상 필드 전수. (table 정본의
 *   `ruleVariantToVisual`[builder/generate-css] 도 동일 필드 매핑 — DOM↔Skia 대칭 유지.
 *   `resolveComponentVisual.test.ts` 가 본 불변식을 계약으로 검증.)
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
  leadingIcon:
    | { name?: string; nameProp?: string; gap?: number; color?: TokenRef }
    | undefined;
  /**
   * leading avatar (텍스트 좌측 **이미지** 슬롯 — Tag chip 사용자 아바타, 2026-08-21).
   * leadingIcon 과 같은 좌측 슬롯을 공유하며 둘 다 있으면 avatar 우선 — 판정은
   * `resolveLeadingSlot`(buildCatalogShapes) 단일 helper 가 하고, 폭 shift 와
   * `leading_avatar` primitive 가 그 결론을 공유한다.
   */
  leadingAvatar:
    | {
        srcProp?: string;
        src?: string;
        size?: number;
        gap?: number;
        fallbackFill?: TokenRef;
      }
    | undefined;
  /**
   * trailing icon (텍스트 우측 아이콘 — CalendarHeader 다음달 chevron 등, ADR-912 (B+icon)).
   * `inline_icon_text` skiaPrimitive(replace 모드)가 본 필드와 leadingIcon + center text 를
   * 함께 그린다(좌 icon + center text + 우 icon = leading_icon 의 좌측 단일 모델과 다른
   * 레이아웃 가정 → 별도 module). 우측 배치는 containerWidth 의존(CONTAINER_DIMENSION_TAGS).
   * DOM 은 부모 컴포넌트가 self-compose(Calendar/RangeCalendar `<header>`) → Skia generic 재현 전용.
   */
  trailingIcon:
    | {
        name: string;
        gap?: number;
        color?: TokenRef;
        showProp?: string;
        /**
         * 우측 절대배치 시 chip 우측 경계 ~ icon 사이 추가 inset(px). 최종 우측 여백 =
         * `paddingY + insetRight`. Tag remove X 는 CSS `.tag-remove-btn`(padding 2 + chip border 1)
         * 만큼 icon 이 안쪽에 위치 → insetRight=3 으로 CSS 우측 여백(paddingY 4 + 3 = 7)과 대칭.
         * 미지정 시 0(우측 여백 = paddingY 단독).
         */
        insetRight?: number;
      }
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
    // production-dead(test fixture 전용) — leadingIcon/leadingAvatar/trailingIcon/textAlign 은
    //   production 의 ruleVariantToVisual 만 rule 에서 채운다. VariantSpec 에는 해당 필드 없음.
    leadingIcon: undefined,
    leadingAvatar: undefined,
    trailingIcon: undefined,
    textAlign: undefined,
  };
}

/**
 * 컴포넌트 variant 의 비-칠 시각 규칙 — `ComponentVisualRule` (production 계약).
 *
 * buildCatalogShapes / skiaPrimitives / resolveSkiaVisualRule(builder) 가 읽는 variant 의 칠이 아닌 값 (글자 굵기 ·
 * 글꼴 · 테두리 선 모양 · value 채움 색 · 앞뒤 아이콘 · 글자 정렬). 칠 (배경 · 글자 · 테두리와 그 상태) 은 variant 의
 * 조건 트리 하나가 정본이고 (ADR-297), Canvas 는 `resolveCatalogPaint` 가 평가한 `paint` 를, DOM 은 트리를
 * compile 한 생성 CSS 를 받는다 — 이 타입은 칠 칸을 갖지 않는다 (Phase 3i).
 */

import type { TokenRef } from "../../types";

/** 단일 variant 의 비-칠 시각 규칙. */
export interface ComponentVisualRule {
  /** 텍스트 굵기 (CSS font-weight 동형, 미지정 시 consumer 가 기본 굵기 fallback) */
  textWeight: number | undefined;
  /** RAC `data-current` 항목의 텍스트 굵기 (Breadcrumb 현재 조각, 미지정 시 consumer fallback) */
  currentTextWeight: number | undefined;
  /** 폰트 패밀리 (CSS font-family 동형 — Code/Kbd mono, 미지정 시 consumer 가 sans fallback) */
  fontFamily: string | undefined;
  /** 테두리 선 스타일 (CSS border-style 동형, 미지정 시 consumer 가 "solid" fallback) */
  borderStyle: "solid" | "dashed" | "dotted" | undefined;
  /**
   * value 채움 색 (progress/meter/slider 의 value_fill_bar/value_fill_arc primitive 색).
   * 미지정 시 escape 가 "{color.accent}" fallback (ADR-912 선행-2).
   */
  fillBar: TokenRef | undefined;
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

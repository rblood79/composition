/**
 * State Types
 *
 * 컴포넌트 상태 및 상태별 스타일 정의
 *
 * @packageDocumentation
 */

import type { ShadowTokenRef, TokenRef } from "./token.types";

/**
 * 상태별 스타일 정의
 *
 * [역할 분리]
 * - VariantSpec: variant별 "색상" 정의 (background, text, border)
 * - StateStyles: 상태별 "효과" 정의 (transform, shadow, opacity 등)
 *
 * 두 가지가 합성되어 최종 스타일이 결정됩니다.
 */
export interface StateStyles {
  /** hover 상태 효과 (VariantSpec.backgroundHover와 합성) */
  hover?: StateEffect;

  /** pressed 상태 효과 (VariantSpec.backgroundPressed와 합성) */
  pressed?: StateEffect;

  /** focused 상태 효과 */
  focused?: StateEffect;

  /** disabled 상태 효과 */
  disabled?: StateEffect;

  /** focus-visible 상태 효과 (키보드 포커스) */
  focusVisible?: StateEffect;
}

/**
 * 상태 효과
 *
 * [색상 필드 정책 — ADR-070]
 * - `background` / `text` / `border`는 **hover / disabled 상태에만** CSSGenerator가 emit.
 *   pressed / focused / focusVisible의 색상 필드는 현재 silently ignored.
 * - `selected` 색상은 StateEffect에 정의하지 **않는다** — VariantSpec.selectedBackground/
 *   selectedText/selectedBorder 단일 소스를 사용 (SSOT 분산 회피).
 * - 색상 미정의 spec은 emit 0 (no-op). 기존 107개 CSS 파일 snapshot diff = 0 보장.
 */
export interface StateEffect {
  /** 변형 */
  transform?: string;

  /** 그림자 (CSS box-shadow 형식 또는 토큰 참조 {shadow.md}) */
  boxShadow?: string | ShadowTokenRef;

  /** 투명도 (0-1) */
  opacity?: number;

  /** 스케일 (1 = 100%) */
  scale?: number;

  /**
   * 배경 색상 TokenRef (ADR-070)
   *
   * hover / disabled에서만 emit. 그 외 상태는 VariantSpec.fill.default.* 토큰 사용
   * (ADR-908 Phase 4: legacy background* → FillTokenSpec SSOT 통합).
   */
  background?: TokenRef;

  /**
   * 텍스트 색상 TokenRef (ADR-070)
   *
   * hover / disabled에서만 emit.
   */
  text?: TokenRef;

  /**
   * 테두리 색상 TokenRef (ADR-070)
   *
   * hover / disabled에서만 emit.
   */
  border?: TokenRef;

  /**
   * Focus ring TokenRef (ADR-061)
   *
   * `{focus.ring.default}` | `{focus.ring.inset}` 형태.
   * CSSGenerator가 TokenRef를 해석하여 outline + outlineOffset CSS 속성을 자동 생성한다.
   */
  focusRing?: TokenRef;

  /** 커서 */
  cursor?: string;

  /** 트랜지션 (기본값 사용 시 생략) */
  transition?: string;

  /** 포인터 이벤트 */
  pointerEvents?: "none" | "auto";
}

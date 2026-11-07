/**
 * Token Types
 *
 * 토큰 참조 타입 및 토큰 카테고리 정의
 * Component Spec에서 사용하는 디자인 토큰 시스템
 *
 * @packageDocumentation
 */

import type { SPECTRUM_LIGHT_COLORS } from "../primitives/generated/spectrumThemeColors";

/**
 * 토큰 참조 문자열
 * 예: '{color.accent}', '{spacing.md}', '{radius.lg}'
 */
export type TokenRef = `{${string}}`;

/**
 * 타입 안전한 토큰 참조 (권장)
 * 컴파일 타임에 유효한 토큰만 허용
 */
export type ColorTokenRef = `{color.${keyof ColorTokens}}`;
export type SpacingTokenRef = `{spacing.${keyof SpacingTokens}}`;
export type TypographyTokenRef = `{typography.${keyof TypographyTokens}}`;
export type RadiusTokenRef = `{radius.${keyof RadiusTokens}}`;
export type ShadowTokenRef = `{shadow.${keyof ShadowTokens}}`;
/** ADR-227 Phase 3 — border 폭 토큰 `{border.width.none|thin|thick}` (3-segment: category `border`, name `width.<k>`). */
export type BorderWidthTokenRef = `{border.width.${keyof BorderWidthTokens}}`;

/**
 * 모든 유효한 토큰 참조 유니온
 */
export type StrictTokenRef =
  | ColorTokenRef
  | SpacingTokenRef
  | TypographyTokenRef
  | RadiusTokenRef
  | ShadowTokenRef
  | BorderWidthTokenRef;

/**
 * 토큰 참조 유효성 검사 유틸리티
 */
export function isValidTokenRef(ref: string): ref is TokenRef {
  const pattern =
    /^\{(color|spacing|typography|radius|shadow)\.[a-zA-Z0-9-]+\}$|^\{border\.width\.[a-z]+\}$/;
  return pattern.test(ref);
}

/**
 * 토큰 카테고리
 */
export interface TokenCategories {
  color: ColorTokens;
  spacing: SpacingTokens;
  typography: TypographyTokens;
  radius: RadiusTokens;
  shadow: ShadowTokens;
  border: BorderWidthTokens;
}

/**
 * 색상 토큰 — 역할 이름 = ADR-302 alias 표 (`primitives/colorAliases.ts`) 의 키.
 *
 * 키 목록은 생성 산출물 (`generated/spectrumThemeColors.ts`) 에서 유도한다 — 역할을 더하거나 빼는 곳은
 * alias 표 한 곳이다 (손으로 interface 에 적지 않는다).
 */
export type ColorTokenName = keyof typeof SPECTRUM_LIGHT_COLORS;

export type ColorTokens = { [K in ColorTokenName]: string };

/**
 * 간격 토큰
 */
export interface SpacingTokens {
  "2xs": number; // 2 (0.125rem) — ADR-071
  xs: number; // 4
  sm: number; // 8
  md: number; // 12
  lg: number; // 16
  xl: number; // 24
  "2xl": number; // 32
  "3xl": number; // 40
  "4xl": number; // 48
}

/**
 * 타이포그래피 토큰
 */
export interface TypographyTokens {
  // ADR-295: 값은 `primitives/typography.ts` 의 S2 단계 표 + 식 (desktop base 14) — 주석 숫자 없음.
  "text-2xs": number;
  "text-xs": number;
  "text-sm": number;
  "text-base": number;
  "text-md": number; // alias for text-base
  "text-lg": number;
  "text-xl": number;
  "text-2xl": number;
  "text-3xl": number;
  "text-4xl": number;
  "text-5xl": number;
  "text-heading-xs": number;
  "text-heading-sm": number;
  "text-heading-md": number;
  "text-heading-lg": number;
  "text-heading-xl": number;
  "text-heading-2xl": number;
  "text-heading-3xl": number;
  // line-height (px) — S2 행간 식
  "text-2xs--line-height": number;
  "text-xs--line-height": number;
  "text-sm--line-height": number;
  "text-base--line-height": number;
  "text-lg--line-height": number;
  "text-xl--line-height": number;
  "text-2xl--line-height": number;
  "text-3xl--line-height": number;
  "text-4xl--line-height": number;
  "text-5xl--line-height": number;
  "text-heading-xs--line-height": number;
  "text-heading-sm--line-height": number;
  "text-heading-md--line-height": number;
  "text-heading-lg--line-height": number;
  "text-heading-xl--line-height": number;
  "text-heading-2xl--line-height": number;
  "text-heading-3xl--line-height": number;
}

/**
 * 둥근 모서리 토큰
 */
export interface RadiusTokens {
  // ADR-295: S2 radius (sm 4 · default 8 · lg 10 · xl 16) + 저장소 단 xs 2 · 2xl 24 (사용자 결정 5)
  none: number; // 0
  xs: number; // 2 (S2 없음)
  sm: number; // 4
  md: number; // 8 (S2 default)
  lg: number; // 10
  xl: number; // 16
  "2xl": number; // 24 (S2 없음)
  full: number; // 9999
}

/**
 * border 폭 토큰 (ADR-227 Phase 3) — 테마가 소유하는 축. catalog rule 의 `borderWidth` 는 이 토큰을
 * 참조하고 (`{border.width.thin}`), Skia 는 `borderWidth` 맵 (px), DOM 은 `--border-width-*` 를 읽는다.
 */
export interface BorderWidthTokens {
  none: number; // 0
  thin: number; // 1
  thick: number; // 2
  hairline: number; // 0.5 — the RAC reference theme's dividers (ListBox · its items · headers)
}

/**
 * 그림자 토큰
 */
/**
 * 그림자 토큰 — Adobe Spectrum 2 역할 토큰 기반 3단계 (ADR-166)
 *
 * `xl` / `focus-ring` 은 ADR-166 Phase 1 에서 제거됐다:
 * - `xl` — Spectrum 이 4번째 elevation 미발행 + D3 소비처 0건
 * - `focus-ring` — 값에 `var()` 를 담아 Skia 파서 미해석 + 실사용 0건.
 *   focus ring 은 ADR-061 의 `{focus.ring.*}` 가 소유한다.
 */
export interface ShadowTokens {
  /** 그림자 없음 */
  none: string;

  /** 작은 그림자 — Spectrum 2 `drop-shadow-emphasized` */
  sm: string;

  /** 중간 그림자 — Spectrum 2 `drop-shadow-elevated` */
  md: string;

  /** 큰 그림자 — Spectrum 2 `drop-shadow-dragged` */
  lg: string;

  /** 내부 그림자 (inset) — elevation 아님, 오목 효과 */
  inset: string;
}

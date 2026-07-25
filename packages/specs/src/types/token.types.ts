/**
 * Token Types
 *
 * 토큰 참조 타입 및 토큰 카테고리 정의
 * Component Spec에서 사용하는 디자인 토큰 시스템
 *
 * @packageDocumentation
 */

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

/**
 * 모든 유효한 토큰 참조 유니온
 */
export type StrictTokenRef =
  | ColorTokenRef
  | SpacingTokenRef
  | TypographyTokenRef
  | RadiusTokenRef
  | ShadowTokenRef;

/**
 * 토큰 참조 유효성 검사 유틸리티
 */
export function isValidTokenRef(ref: string): ref is TokenRef {
  const pattern =
    /^\{(color|spacing|typography|radius|shadow)\.[a-zA-Z0-9-]+\}$/;
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
}

/**
 * 색상 토큰 (S2 체계, ADR-022)
 *
 * React Spectrum S2의 역할 기반 네이밍 채택:
 * - accent/neutral/negative: 핵심 시맨틱
 * - informative/positive/notice: 상태 시맨틱
 * - base/layer-1/layer-2/elevated: 레이어 시스템
 * - -subtle: 연한 배경 변형 (S2 fillStyle=subtle)
 */
export interface ColorTokens {
  // --- Accent (기존 primary) ---
  accent: string;
  "accent-hover": string;
  "accent-pressed": string;
  "on-accent": string;
  "accent-subtle": string;

  // --- Neutral (기존 on-surface + secondary) ---
  neutral: string;
  "neutral-subdued": string;
  "neutral-subtle": string;
  "neutral-hover": string;
  "neutral-pressed": string;

  // --- Negative (기존 error) ---
  negative: string;
  "negative-hover": string;
  "negative-pressed": string;
  "on-negative": string;
  "negative-subtle": string;

  // --- Informative ---
  informative: string;
  "informative-subtle": string;

  // --- Positive ---
  positive: string;
  "positive-subtle": string;

  // --- Notice ---
  notice: string;
  "notice-subtle": string;

  // --- Surface / Layer ---
  base: string;
  /** raised surface (popover/dropdown/collection 컨테이너, ADR-071) → CSS --bg-raised. */
  raised: string;
  "layer-1": string;
  "layer-2": string;
  elevated: string;
  disabled: string;

  // --- Border ---
  border: string;
  "border-hover": string;
  "border-disabled": string;

  // --- Special ---
  transparent: string;
  white: string;
  black: string;

  // --- Named Colors (StatusLight, Badge 등) ---
  purple: string;
  "purple-subtle": string;
  yellow: string;
  "yellow-subtle": string;
  red: string;
  "red-subtle": string;
  orange: string;
  "orange-subtle": string;
  blue: string;
  "blue-subtle": string;
  indigo: string;
  "indigo-subtle": string;
  cyan: string;
  "cyan-subtle": string;
  pink: string;
  "pink-subtle": string;
  fuchsia: string;
  "fuchsia-subtle": string;
  magenta: string;
  "magenta-subtle": string;
  celery: string;
  "celery-subtle": string;
  chartreuse: string;
  "chartreuse-subtle": string;
}

/**
 * 간격 토큰
 */
export interface SpacingTokens {
  "2xs": number; // 2 (0.125rem) — ADR-071
  xs: number; // 4
  sm: number; // 8
  md: number; // 16
  lg: number; // 24
  xl: number; // 32
  "2xl": number; // 48
}

/**
 * 타이포그래피 토큰
 */
export interface TypographyTokens {
  "text-2xs": number; // 10
  "text-xs": number; // 12
  "text-sm": number; // 14
  "text-base": number; // 16
  "text-md": number; // 16 (alias for text-base)
  "text-lg": number; // 18
  "text-xl": number; // 20
  "text-2xl": number; // 24
  "text-3xl": number; // 30
  "text-4xl": number; // 36
  "text-5xl": number; // 48
  // line-height (px): CSS calc(lineHeight / fontSize) × fontSize 결과
  "text-2xs--line-height": number; // 16
  "text-xs--line-height": number; // 16
  "text-sm--line-height": number; // 20
  "text-base--line-height": number; // 24
  "text-lg--line-height": number; // 28
  "text-xl--line-height": number; // 28
  "text-2xl--line-height": number; // 32
  "text-3xl--line-height": number; // 36
  "text-4xl--line-height": number; // 40
  "text-5xl--line-height": number; // 48
}

/**
 * 둥근 모서리 토큰
 */
export interface RadiusTokens {
  none: number; // 0
  xs: number; // 2  (ADR-913 slice 5 — shared-tokens.css --radius-xs:0.125rem, catalog {radius.xs})
  sm: number; // 4
  md: number; // 6  (정정: 과거 주석 8 stale — radius.ts/shared-tokens.css 정본 6px)
  lg: number; // 8  (정정: 과거 주석 12 stale — 정본 8px)
  xl: number; // 12 (정정: 과거 주석 16 stale — 정본 12px)
  "2xl": number; // 16 (ADR-913 slice 5 — shared-tokens.css --radius-2xl:1rem, catalog {radius.2xl})
  full: number; // 9999
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

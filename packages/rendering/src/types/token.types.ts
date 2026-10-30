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
  /** 바탕 위 accent (글자 · 선 · 채움) — 배경 역할 `accent` 와 따로 목표 대비로 정한다 (ADR-290). */
  "accent-content": string;
  "accent-content-hover": string;

  // --- Neutral (기존 on-surface + secondary) ---
  neutral: string;
  "neutral-subdued": string;
  "neutral-subtle": string;
  "neutral-hover": string;
  "neutral-pressed": string;
  /** 진한 바탕 `neutral` (Button primary) 의 hover · pressed — S2 한 단 (ADR-293 결정 4) */
  "neutral-fill-hover": string;
  "neutral-fill-pressed": string;

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

  // --- Status strong (subtle 배경 위 텍스트 — ADR-193 후속, light 900 / dark 200) ---
  "negative-strong": string;
  "positive-strong": string;
  "informative-strong": string;
  "notice-strong": string;

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
  // Spectrum 전용 hue (ADR-191 후속) — Tailwind 최근접 family 로 고정
  turquoise: string;
  "turquoise-subtle": string;
  seafoam: string;
  "seafoam-subtle": string;
  cinnamon: string;
  "cinnamon-subtle": string;
  brown: string;
  "brown-subtle": string;
  silver: string;
  "silver-subtle": string;
  // Skia 결손 보완 (ADR-193) — catalog `{color.gray}` / tokenResolver `green-named` 는 있었으나 colors.ts 에 없었다
  gray: string;
  "gray-subtle": string;
  "green-named": string;
  "green-named-subtle": string;
  // Chart 시리즈 팔레트 (chartPaletteMap.ts) — categorical 은 Spectrum 리터럴 (테마 공용),
  // accent 는 `--tint` 명도 사다리 (tintToSkiaColors 가 런타임에 덮어쓴다)
  "chart-categorical-1": string;
  "chart-categorical-2": string;
  "chart-categorical-3": string;
  "chart-categorical-4": string;
  "chart-categorical-5": string;
  "chart-categorical-6": string;
  "chart-categorical-7": string;
  "chart-categorical-8": string;
  "chart-accent-1": string;
  "chart-accent-2": string;
  "chart-accent-3": string;
  "chart-accent-4": string;
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

/**
 * Color Tokens
 *
 * S2 역할 기반 색상 토큰 (ADR-022)
 * React Spectrum S2의 accent/neutral/negative 체계 채택.
 * tokenToCSSVar()의 매핑 테이블과 함께 사용됨.
 *
 * @packageDocumentation
 */

import type { ColorTokens } from "../types/token.types";
import { TAILWIND_PALETTE } from "./generated/tailwindPalette";

/**
 * Light 모드 색상 토큰
 * 시맨틱 토큰 CSS 변수의 fallback 값 기준.
 * ADR-191: Tailwind 팔레트 복사 항목은 `TAILWIND_PALETTE` (tailwindcss/theme.css 파생) 참조 —
 * 손 복사 hex 를 다시 적지 말 것. 리터럴로 남은 값은 S2/Leonardo custom (팔레트 이름 없음).
 */
export const lightColors: ColorTokens = {
  // --- Accent (기존 primary → --highlight-background) ---
  accent: TAILWIND_PALETTE.blue[600], // blue-600
  "accent-hover": "#1f54c8",
  "accent-pressed": TAILWIND_PALETTE.blue[700],
  "on-accent": "#ffffff",
  "accent-subtle": TAILWIND_PALETTE.blue[100], // blue-100

  // --- Neutral ---
  neutral: TAILWIND_PALETTE.neutral[900], // neutral-900 (기존 on-surface)
  "neutral-subdued": TAILWIND_PALETTE.neutral[700], // neutral-700 (기존 on-surface-variant)
  "neutral-subtle": TAILWIND_PALETTE.neutral[200], // neutral-200 (기존 surface-container-highest)
  "neutral-hover": "#c3c3c3",
  "neutral-pressed": "#a8a8a8",

  // --- Negative (기존 error → --invalid-color) ---
  negative: TAILWIND_PALETTE.red[500], // error-400
  "negative-hover": "#cb3a3a",
  "negative-pressed": "#b33333",
  "on-negative": "#ffffff",
  "negative-subtle": TAILWIND_PALETTE.red[100], // error-100

  // --- Informative ---
  informative: TAILWIND_PALETTE.blue[600], // info-600 (= blue-600)
  "informative-subtle": TAILWIND_PALETTE.blue[100],
  // --- Positive ---
  positive: TAILWIND_PALETTE.green[600], // green-600
  "positive-subtle": TAILWIND_PALETTE.green[100],
  // --- Notice ---
  notice: TAILWIND_PALETTE.orange[600], // warning-600 (= orange-600)
  "notice-subtle": TAILWIND_PALETTE.orange[100],

  // --- Surface / Layer ---
  base: "#ffffff",
  raised: TAILWIND_PALETTE.gray[50], // --bg-raised = --color-gray-50 (popover/dropdown/collection 컨테이너)
  "layer-1": TAILWIND_PALETTE.zinc[50], // neutral-50
  "layer-2": TAILWIND_PALETTE.zinc[50], // neutral-50
  elevated: "#ffffff",
  disabled: TAILWIND_PALETTE.neutral[200], // neutral-200

  // --- Border ---
  border: TAILWIND_PALETTE.neutral[300], // neutral-300
  "border-hover": TAILWIND_PALETTE.neutral[400], // neutral-400
  "border-disabled": TAILWIND_PALETTE.neutral[100], // neutral-100

  // --- Special ---
  transparent: "transparent",
  white: "#ffffff",
  black: "#000000",

  // --- Named Colors ---
  purple: TAILWIND_PALETTE.purple[600],
  "purple-subtle": TAILWIND_PALETTE.purple[100],
  yellow: TAILWIND_PALETTE.yellow[500],
  "yellow-subtle": TAILWIND_PALETTE.yellow[100],
  red: TAILWIND_PALETTE.red[600],
  "red-subtle": TAILWIND_PALETTE.red[100],
  orange: TAILWIND_PALETTE.orange[600],
  "orange-subtle": TAILWIND_PALETTE.orange[100],
  blue: TAILWIND_PALETTE.blue[600],
  "blue-subtle": TAILWIND_PALETTE.blue[100],
  indigo: TAILWIND_PALETTE.indigo[700], // v3 indigo-700 #4338ca
  "indigo-subtle": TAILWIND_PALETTE.indigo[100],
  cyan: TAILWIND_PALETTE.cyan[600], // v3 cyan-600 #0891b2
  "cyan-subtle": TAILWIND_PALETTE.cyan[100],
  pink: TAILWIND_PALETTE.pink[600], // v3 pink-600 #db2777
  "pink-subtle": TAILWIND_PALETTE.pink[100],
  fuchsia: TAILWIND_PALETTE.fuchsia[600], // v3 fuchsia-600 #c026d3
  "fuchsia-subtle": TAILWIND_PALETTE.fuchsia[100],
  magenta: TAILWIND_PALETTE.pink[700], // v3 pink-700 #be185d
  "magenta-subtle": TAILWIND_PALETTE.pink[100],
  celery: TAILWIND_PALETTE.lime[600], // v3 lime-600 #65a30d
  "celery-subtle": TAILWIND_PALETTE.lime[100],
  chartreuse: TAILWIND_PALETTE.lime[500], // v3 lime-500 #84cc16
  "chartreuse-subtle": TAILWIND_PALETTE.lime[100],
  // Spectrum 전용 hue — Tailwind 에 같은 이름이 없어 가장 가까운 family 로 고정 (CSS 매핑과 동일 단계, semanticAlias.symmetry.test)
  turquoise: TAILWIND_PALETTE.teal[500],
  "turquoise-subtle": TAILWIND_PALETTE.teal[100],
  seafoam: TAILWIND_PALETTE.teal[700],
  "seafoam-subtle": TAILWIND_PALETTE.teal[100],
  cinnamon: TAILWIND_PALETTE.amber[800],
  "cinnamon-subtle": TAILWIND_PALETTE.amber[100],
  brown: TAILWIND_PALETTE.yellow[900],
  "brown-subtle": TAILWIND_PALETTE.yellow[100],
  silver: TAILWIND_PALETTE.gray[400],
  "silver-subtle": TAILWIND_PALETTE.gray[100],
};

/**
 * Dark 모드 색상 토큰
 * 시맨틱 토큰 dark mode fallback 값 기준
 */
export const darkColors: ColorTokens = {
  // --- Accent ---
  accent: TAILWIND_PALETTE.blue[500], // blue-500
  "accent-hover": "#3270d1",
  "accent-pressed": TAILWIND_PALETTE.blue[400],
  "on-accent": TAILWIND_PALETTE.neutral[900], // v3 neutral-900 #171717
  "accent-subtle": TAILWIND_PALETTE.blue[900], // blue-900

  // --- Neutral ---
  neutral: TAILWIND_PALETTE.neutral[100], // neutral-100 (dark mode에서 밝은 텍스트)
  "neutral-subdued": TAILWIND_PALETTE.neutral[400], // neutral-400
  "neutral-subtle": TAILWIND_PALETTE.neutral[700], // neutral-700
  "neutral-hover": "#363636",
  "neutral-pressed": "#2e2e2e",

  // --- Negative ---
  negative: TAILWIND_PALETTE.red[400], // error-400 dark
  "negative-hover": "#d36060",
  "negative-pressed": "#ba5555",
  "on-negative": "#ffffff",
  "negative-subtle": TAILWIND_PALETTE.red[900], // error-900

  // --- Informative ---
  informative: TAILWIND_PALETTE.blue[500],
  "informative-subtle": TAILWIND_PALETTE.blue[900],
  // --- Positive ---
  positive: TAILWIND_PALETTE.green[500], // green-500
  "positive-subtle": TAILWIND_PALETTE.green[900],
  // --- Notice ---
  notice: TAILWIND_PALETTE.orange[500], // orange-500
  "notice-subtle": TAILWIND_PALETTE.orange[900],

  // --- Surface / Layer ---
  base: TAILWIND_PALETTE.neutral[900], // neutral-900
  raised: "#202023", // custom zinc-850 (Tailwind 에 없는 단계 — shared-tokens.css 유지) // --bg-raised = --color-zinc-850 (popover/dropdown/collection 컨테이너)
  "layer-1": TAILWIND_PALETTE.neutral[800], // neutral-800
  "layer-2": TAILWIND_PALETTE.neutral[800], // neutral-800
  elevated: TAILWIND_PALETTE.neutral[800],
  disabled: TAILWIND_PALETTE.neutral[700], // neutral-700

  // --- Border ---
  border: TAILWIND_PALETTE.neutral[700], // neutral-700
  "border-hover": TAILWIND_PALETTE.neutral[500], // neutral-500
  "border-disabled": TAILWIND_PALETTE.neutral[800], // neutral-800

  // --- Special ---
  transparent: "transparent",
  white: "#ffffff",
  black: "#000000",

  // --- Named Colors ---
  purple: TAILWIND_PALETTE.purple[500],
  "purple-subtle": TAILWIND_PALETTE.purple[900],
  yellow: TAILWIND_PALETTE.yellow[400],
  "yellow-subtle": TAILWIND_PALETTE.yellow[900],
  red: TAILWIND_PALETTE.red[400],
  "red-subtle": TAILWIND_PALETTE.red[900],
  orange: TAILWIND_PALETTE.orange[500],
  "orange-subtle": TAILWIND_PALETTE.orange[900],
  blue: TAILWIND_PALETTE.blue[500],
  "blue-subtle": TAILWIND_PALETTE.blue[900],
  indigo: TAILWIND_PALETTE.indigo[500], // v3 indigo-500 #6366f1
  "indigo-subtle": TAILWIND_PALETTE.indigo[900], // v3 indigo-900 #312e81
  cyan: TAILWIND_PALETTE.cyan[500], // v3 cyan-500 #06b6d4
  "cyan-subtle": TAILWIND_PALETTE.cyan[900], // v3 cyan-900 #164e63
  pink: TAILWIND_PALETTE.pink[500], // v3 pink-500 #ec4899
  "pink-subtle": TAILWIND_PALETTE.pink[900], // v3 pink-900 #831843
  fuchsia: TAILWIND_PALETTE.fuchsia[500], // v3 fuchsia-500 #d946ef
  "fuchsia-subtle": TAILWIND_PALETTE.fuchsia[900], // v3 fuchsia-900 #701a75
  magenta: TAILWIND_PALETTE.rose[600], // v3 rose-600 #e11d48
  "magenta-subtle": TAILWIND_PALETTE.rose[900], // v3 rose-900 #881337
  celery: TAILWIND_PALETTE.lime[500], // v3 lime-500 #84cc16
  "celery-subtle": TAILWIND_PALETTE.lime[900], // v3 lime-900 #365314
  chartreuse: TAILWIND_PALETTE.lime[400], // v3 lime-400 #a3e635
  "chartreuse-subtle": TAILWIND_PALETTE.lime[900], // v3 lime-900 #365314
  // Spectrum 전용 hue (dark) — light 와 같은 family, 다른 named hue 와 같은 규칙 (본색 한 단계 밝게 / subtle 900)
  turquoise: TAILWIND_PALETTE.teal[400],
  "turquoise-subtle": TAILWIND_PALETTE.teal[900],
  seafoam: TAILWIND_PALETTE.teal[500],
  "seafoam-subtle": TAILWIND_PALETTE.teal[900],
  cinnamon: TAILWIND_PALETTE.amber[600],
  "cinnamon-subtle": TAILWIND_PALETTE.amber[900],
  brown: TAILWIND_PALETTE.yellow[700],
  "brown-subtle": TAILWIND_PALETTE.yellow[900],
  silver: TAILWIND_PALETTE.gray[500],
  "silver-subtle": TAILWIND_PALETTE.gray[800],
};

/**
 * 현재 테마에 따른 색상 반환
 */
export function getColorToken(
  name: keyof ColorTokens,
  theme: "light" | "dark" = "light",
): string {
  return theme === "dark" ? darkColors[name] : lightColors[name];
}

/**
 * 테마별 색상 객체 반환
 */
export function getColorTokens(theme: "light" | "dark" = "light"): ColorTokens {
  return theme === "dark" ? darkColors : lightColors;
}

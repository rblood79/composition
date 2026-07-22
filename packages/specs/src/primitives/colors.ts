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

/**
 * Light 모드 색상 토큰
 * 시맨틱 토큰 CSS 변수의 fallback 값 기준 (Tailwind hex)
 */
export const lightColors: ColorTokens = {
  // --- Accent (기존 primary → --highlight-background) ---
  accent: "#2563eb", // blue-600
  "accent-hover": "#1f54c8",
  "accent-pressed": "#1d4ed8",
  "on-accent": "#ffffff",
  "accent-subtle": "#dbeafe", // blue-100

  // --- Neutral ---
  neutral: "#171717", // neutral-900 (기존 on-surface)
  "neutral-subdued": "#404040", // neutral-700 (기존 on-surface-variant)
  "neutral-subtle": "#e5e5e5", // neutral-200 (기존 surface-container-highest)
  "neutral-hover": "#c3c3c3",
  "neutral-pressed": "#a8a8a8",

  // --- Negative (기존 error → --invalid-color) ---
  negative: "#ef4444", // error-400
  "negative-hover": "#cb3a3a",
  "negative-pressed": "#b33333",
  "on-negative": "#ffffff",
  "negative-subtle": "#fee2e2", // error-100

  // --- Informative ---
  informative: "#2563eb", // info-600 (= blue-600)
  "informative-subtle": "#dbeafe",
  // --- Positive ---
  positive: "#16a34a", // green-600
  "positive-subtle": "#dcfce7",
  // --- Notice ---
  notice: "#ea580c", // warning-600 (= orange-600)
  "notice-subtle": "#ffedd5",

  // --- Surface / Layer ---
  base: "#ffffff",
  raised: "#f9fafb", // --bg-raised = --color-gray-50 (popover/dropdown/collection 컨테이너)
  "layer-1": "#fafafa", // neutral-50
  "layer-2": "#fafafa", // neutral-50
  elevated: "#ffffff",
  disabled: "#e5e5e5", // neutral-200

  // --- Border ---
  border: "#d4d4d4", // neutral-300
  "border-hover": "#a3a3a3", // neutral-400
  "border-disabled": "#f5f5f5", // neutral-100

  // --- Special ---
  transparent: "transparent",
  white: "#ffffff",
  black: "#000000",

  // --- Named Colors ---
  purple: "#9333ea",
  "purple-subtle": "#f3e8ff",
  yellow: "#eab308",
  "yellow-subtle": "#fef9c3",
  red: "#dc2626",
  "red-subtle": "#fee2e2",
  orange: "#ea580c",
  "orange-subtle": "#ffedd5",
  blue: "#2563eb",
  "blue-subtle": "#dbeafe",
  indigo: "#4338ca",
  "indigo-subtle": "#e0e7ff",
  cyan: "#0891b2",
  "cyan-subtle": "#cffafe",
  pink: "#db2777",
  "pink-subtle": "#fce7f3",
  fuchsia: "#c026d3",
  "fuchsia-subtle": "#fae8ff",
  magenta: "#be185d",
  "magenta-subtle": "#fce7f3",
  celery: "#65a30d",
  "celery-subtle": "#ecfccb",
  chartreuse: "#84cc16",
  "chartreuse-subtle": "#ecfccb",
};

/**
 * Dark 모드 색상 토큰
 * 시맨틱 토큰 dark mode fallback 값 기준
 */
export const darkColors: ColorTokens = {
  // --- Accent ---
  accent: "#3b82f6", // blue-500
  "accent-hover": "#3270d1",
  "accent-pressed": "#60a5fa",
  "on-accent": "#171717",
  "accent-subtle": "#1e3a8a", // blue-900

  // --- Neutral ---
  neutral: "#f5f5f5", // neutral-100 (dark mode에서 밝은 텍스트)
  "neutral-subdued": "#a3a3a3", // neutral-400
  "neutral-subtle": "#404040", // neutral-700
  "neutral-hover": "#363636",
  "neutral-pressed": "#2e2e2e",

  // --- Negative ---
  negative: "#f87171", // error-400 dark
  "negative-hover": "#d36060",
  "negative-pressed": "#ba5555",
  "on-negative": "#ffffff",
  "negative-subtle": "#7f1d1d", // error-900

  // --- Informative ---
  informative: "#3b82f6",
  "informative-subtle": "#1e3a8a",
  // --- Positive ---
  positive: "#22c55e", // green-500
  "positive-subtle": "#14532d",
  // --- Notice ---
  notice: "#f97316", // orange-500
  "notice-subtle": "#7c2d12",

  // --- Surface / Layer ---
  base: "#171717", // neutral-900
  raised: "#202023", // --bg-raised = --color-zinc-850 (popover/dropdown/collection 컨테이너)
  "layer-1": "#262626", // neutral-800
  "layer-2": "#262626", // neutral-800
  elevated: "#262626",
  disabled: "#404040", // neutral-700

  // --- Border ---
  border: "#404040", // neutral-700
  "border-hover": "#737373", // neutral-500
  "border-disabled": "#262626", // neutral-800

  // --- Special ---
  transparent: "transparent",
  white: "#ffffff",
  black: "#000000",

  // --- Named Colors ---
  purple: "#a855f7",
  "purple-subtle": "#581c87",
  yellow: "#facc15",
  "yellow-subtle": "#713f12",
  red: "#f87171",
  "red-subtle": "#7f1d1d",
  orange: "#f97316",
  "orange-subtle": "#7c2d12",
  blue: "#3b82f6",
  "blue-subtle": "#1e3a8a",
  indigo: "#6366f1",
  "indigo-subtle": "#312e81",
  cyan: "#06b6d4",
  "cyan-subtle": "#164e63",
  pink: "#ec4899",
  "pink-subtle": "#831843",
  fuchsia: "#d946ef",
  "fuchsia-subtle": "#701a75",
  magenta: "#e11d48",
  "magenta-subtle": "#881337",
  celery: "#84cc16",
  "celery-subtle": "#365314",
  chartreuse: "#a3e635",
  "chartreuse-subtle": "#365314",
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

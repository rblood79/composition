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
import { resolveSemanticColors } from "./semanticPaletteMap";

/**
 * Light 모드 색상 토큰
 * 시맨틱 토큰 CSS 변수의 fallback 값 기준.
 * ADR-191: Tailwind 팔레트 복사 항목은 `TAILWIND_PALETTE` (tailwindcss/theme.css 파생) 참조 —
 * 손 복사 hex 를 다시 적지 말 것. 리터럴로 남은 값은 S2/Leonardo custom (팔레트 이름 없음).
 * ADR-193: status(negative/informative/positive/notice) 와 named hue (+subtle) 는
 * `semanticPaletteMap.ts` 표에서 파생 — 단계 조정은 표에서만 한다 (CSS 생성 산출물과 같은 원천).
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

  // --- Negative hover/pressed (custom — Skia 미소비, 표 밖) ---
  "negative-hover": "#cb3a3a",
  "negative-pressed": "#b33333",
  "on-negative": "#ffffff",

  // --- Status + Named hue (+subtle) — semanticPaletteMap 파생 ---
  ...resolveSemanticColors("light"),

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

  // --- Negative hover/pressed (custom — Skia 미소비, 표 밖) ---
  "negative-hover": "#d36060",
  "negative-pressed": "#ba5555",
  "on-negative": "#ffffff",

  // --- Status + Named hue (+subtle) — semanticPaletteMap 파생 (본색 한 단계 밝게 / subtle 900) ---
  ...resolveSemanticColors("dark"),

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

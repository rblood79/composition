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
import {
  resolveSemanticColors,
  resolveSemanticStateColors,
} from "./semanticPaletteMap";
import { resolveChartPaletteColors } from "./chartPaletteMap";

/**
 * Light 모드 색상 토큰
 * 시맨틱 토큰 CSS 변수의 fallback 값 기준.
 * ADR-191: Tailwind 팔레트 복사 항목은 `TAILWIND_PALETTE` (tailwindcss/theme.css 파생) 참조 —
 * 손 복사 hex 를 다시 적지 말 것. 리터럴로 남은 값은 S2/Leonardo custom (팔레트 이름 없음).
 * ADR-193: status(negative/informative/positive/notice) 와 named hue (+subtle) 는
 * `semanticPaletteMap.ts` 표에서 파생 — 단계 조정은 표에서만 한다 (CSS 생성 산출물과 같은 원천).
 */
const LIGHT_STATE = resolveSemanticStateColors("light");
const DARK_STATE = resolveSemanticStateColors("dark");

export const lightColors: ColorTokens = {
  // --- Status + Named hue 의 hover · pressed — DOM color-mix 와 같은 식 (손 값이 아래에서 이긴다) ---
  ...LIGHT_STATE,
  // --- Accent (기존 primary → --highlight-background) ---
  accent: TAILWIND_PALETTE.blue[600], // blue-600
  "accent-hover": "#1f54c8",
  "accent-pressed": TAILWIND_PALETTE.blue[700],
  "on-accent": "#ffffff",
  "accent-subtle": TAILWIND_PALETTE.blue[100], // blue-100
  // 바탕 위 accent (ADR-290) — 테마가 설치되면 resolver 의 목표 대비 값이 덮는다
  "accent-content": TAILWIND_PALETTE.blue[700],
  "accent-content-hover": TAILWIND_PALETTE.blue[800],

  // --- Neutral ---
  neutral: TAILWIND_PALETTE.neutral[900], // neutral-900 (기존 on-surface)
  // S2 neutral-subdued (label · 보조 텍스트 — 본문과 구분) light #505050 에 가장 가까운 단계 (사용자 결정 2026-09-29, 종전 700)
  "neutral-subdued": TAILWIND_PALETTE.neutral[600], // neutral-600
  "neutral-subtle": TAILWIND_PALETTE.neutral[200], // neutral-200 (기존 surface-container-highest)
  "neutral-hover": TAILWIND_PALETTE.neutral[300], // Tone 단계 (neutralToSkiaColors LIGHT_MAP)
  "neutral-pressed": TAILWIND_PALETTE.neutral[400],
  // 진한 바탕 neutral 의 hover · pressed — S2 한 단 (ADR-293 결정 4)
  "neutral-fill-hover": TAILWIND_PALETTE.neutral[950],
  "neutral-fill-pressed": TAILWIND_PALETTE.neutral[950],

  // --- Negative hover/pressed — status 와 같은 검정 85 · 75 % 혼합 (ADR-293 결정 2, 종전 손값 #cb3a3a · #b33333) ---
  "negative-hover": LIGHT_STATE["negative-hover"]!,
  "negative-pressed": LIGHT_STATE["negative-pressed"]!,
  "on-negative": "#ffffff",

  // --- Status + Named hue (+subtle) — semanticPaletteMap 파생 ---
  ...resolveSemanticColors("light"),
  // --- Chart 시리즈 팔레트 — chartPaletteMap 파생 (테마 공용) ---
  ...resolveChartPaletteColors(),

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
  // --- Status + Named hue 의 hover · pressed — DOM color-mix 와 같은 식 (손 값이 아래에서 이긴다) ---
  ...DARK_STATE,
  // --- Accent ---
  accent: TAILWIND_PALETTE.blue[500], // blue-500
  "accent-hover": "#3270d1",
  "accent-pressed": TAILWIND_PALETTE.blue[400],
  "on-accent": "#ffffff", // S2 — accent 배경 위 글자는 두 모드 모두 흰색 (ADR-290 결정 1)
  "accent-subtle": TAILWIND_PALETTE.blue[900], // blue-900
  "accent-content": TAILWIND_PALETTE.blue[400],
  "accent-content-hover": TAILWIND_PALETTE.blue[300],

  // --- Neutral ---
  neutral: TAILWIND_PALETTE.neutral[100], // neutral-100 (dark mode에서 밝은 텍스트)
  "neutral-subdued": TAILWIND_PALETTE.neutral[400], // neutral-400
  "neutral-subtle": TAILWIND_PALETTE.neutral[700], // neutral-700
  "neutral-hover": TAILWIND_PALETTE.neutral[600], // Tone 단계 (neutralToSkiaColors DARK_MAP)
  "neutral-pressed": TAILWIND_PALETTE.neutral[500],
  "neutral-fill-hover": TAILWIND_PALETTE.neutral[50],
  "neutral-fill-pressed": TAILWIND_PALETTE.neutral[50],

  // --- Negative hover/pressed — 검정 85 · 75 % 혼합 (ADR-293 결정 2) ---
  "negative-hover": DARK_STATE["negative-hover"]!,
  "negative-pressed": DARK_STATE["negative-pressed"]!,
  "on-negative": "#ffffff",

  // --- Status + Named hue (+subtle) — semanticPaletteMap 파생 (본색 한 단계 밝게 / subtle 900) ---
  ...resolveSemanticColors("dark"),
  // --- Chart 시리즈 팔레트 — chartPaletteMap 파생 (테마 공용) ---
  ...resolveChartPaletteColors(),

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

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
  // S2 1.8.2 Button fill: light 900/1000, dark 700/600.
  "selection-accent": "#3b63fb",
  "selection-accent-hover": "#274dea",
  "selection-negative": "#d73220",
  "selection-negative-hover": "#b72818",
  "accent-fill": "#3b63fb",
  "focus-ring": "#4b75ff",
  "accent-fill-hover": "#274dea",
  "negative-fill": "#d73220",
  "negative-fill-hover": "#b72818",

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
  // S2 1.8.2: 내용 · 진한 바탕 · 옅은 바탕 · 테두리 역할은 독립적으로 편집한다.
  "neutral-content": "#292929",
  "neutral-content-hover": "#131313",
  "neutral-fill": "#292929",
  "neutral-surface": "#e9e9e9",
  "neutral-surface-hover": "#e1e1e1",
  "neutral-outline": "#dadada",
  "neutral-outline-hover": "#c6c6c6",
  "on-neutral": "#ffffff",

  neutral: TAILWIND_PALETTE.neutral[900], // neutral-900 (기존 on-surface)
  // S2 1.8.2 neutral-subdued-content-color-default (FieldLabel).
  "neutral-subdued": "#505050",
  // S2 1.8.2 Field input placeholder and prefix (gray-600).
  "field-placeholder": "#717171",
  "neutral-subtle": TAILWIND_PALETTE.neutral[200], // neutral-200 (기존 surface-container-highest)
  "neutral-hover": TAILWIND_PALETTE.neutral[300], // Tone 단계 (neutralToSkiaColors LIGHT_MAP)
  "neutral-pressed": TAILWIND_PALETTE.neutral[400],
  // 진한 바탕 neutral 의 hover · pressed — S2 한 단 (ADR-293 결정 4)
  "neutral-fill-hover": "#131313",
  "neutral-fill-pressed": "#131313",

  // --- Negative hover/pressed — status 와 같은 검정 85 · 75 % 혼합 (ADR-293 결정 2, 종전 손값 #cb3a3a · #b33333) ---
  "negative-hover": LIGHT_STATE["negative-hover"]!,
  "negative-pressed": LIGHT_STATE["negative-pressed"]!,
  "on-negative": "#ffffff",

  // --- Status + Named hue (+subtle) — semanticPaletteMap 파생 ---
  ...resolveSemanticColors("light"),
  // --- Chart 시리즈 팔레트 — chartPaletteMap 파생 (테마 공용) ---
  ...resolveChartPaletteColors(),

  // --- Surface / Layer ---
  // S2 1.8.1 Modal underlay `transparent-black-500` (설치본 `Modal.css` — 색 모드 무관 한 값).
  "overlay-backdrop": "#00000070",
  // S2 Popover: light transparent-white-25 / dark gray-200.
  "popover-outline": "#ffffff00",
  "popover-background": "#ffffff",
  // S2 Menu/Picker/ComboBox: baseColor('gray-100').isFocusVisible = gray-200.
  "collection-item-focus": "#e1e1e1",
  "picker-background": "#e9e9e9",
  "picker-background-hover": "#e1e1e1",
  "picker-content": "#292929",
  "picker-content-hover": "#131313",
  "picker-content-disabled": "#c6c6c6",
  "picker-checkbox-base": "#ffffff",
  base: "#ffffff",
  raised: TAILWIND_PALETTE.gray[50], // --bg-raised = --color-gray-50 (popover/dropdown/collection 컨테이너)
  "layer-1": "#f8f8f8", // S2 1.8.2 background-layer-1-color
  "layer-2": "#ffffff", // S2 background-layer-2-color
  elevated: "#ffffff",
  disabled: "#e9e9e9", // S2 disabled-background-color
  "disabled-content": "#c6c6c6", // S2 disabled-content-color

  // --- Border ---
  border: TAILWIND_PALETTE.neutral[300], // neutral-300
  "border-hover": TAILWIND_PALETTE.neutral[400], // neutral-400
  "border-disabled": "#dadada", // S2 disabled-border-color

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
  // S2 1.8.2 Button fill: light 900/1000, dark 700/600.
  "selection-accent": "#5681ff",
  "selection-accent-hover": "#6995fe",
  "selection-negative": "#fc432e",
  "selection-negative-hover": "#ff6756",
  "accent-fill": "#345bf8",
  "focus-ring": "#4069fd",
  "accent-fill-hover": "#2549e5",
  "negative-fill": "#cd2e1d",
  "negative-fill-hover": "#b12617",

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
  // S2 1.8.2: 내용 · 진한 바탕 · 옅은 바탕 · 테두리 역할은 독립적으로 편집한다.
  "neutral-content": "#dbdbdb",
  "neutral-content-hover": "#f2f2f2",
  "neutral-fill": "#dbdbdb",
  "neutral-surface": "#2c2c2c",
  "neutral-surface-hover": "#323232",
  "neutral-outline": "#393939",
  "neutral-outline-hover": "#444444",
  "on-neutral": "#111111",

  neutral: TAILWIND_PALETTE.neutral[100], // neutral-100 (dark mode에서 밝은 텍스트)
  "neutral-subdued": "#afafaf",
  "field-placeholder": "#8a8a8a",
  "neutral-subtle": TAILWIND_PALETTE.neutral[700], // neutral-700
  "neutral-hover": TAILWIND_PALETTE.neutral[600], // Tone 단계 (neutralToSkiaColors DARK_MAP)
  "neutral-pressed": TAILWIND_PALETTE.neutral[500],
  "neutral-fill-hover": "#f2f2f2",
  "neutral-fill-pressed": "#f2f2f2",

  // --- Negative hover/pressed — 검정 85 · 75 % 혼합 (ADR-293 결정 2) ---
  "negative-hover": DARK_STATE["negative-hover"]!,
  "negative-pressed": DARK_STATE["negative-pressed"]!,
  "on-negative": "#ffffff",

  // --- Status + Named hue (+subtle) — semanticPaletteMap 파생 (본색 한 단계 밝게 / subtle 900) ---
  ...resolveSemanticColors("dark"),
  // --- Chart 시리즈 팔레트 — chartPaletteMap 파생 (테마 공용) ---
  ...resolveChartPaletteColors(),

  // --- Surface / Layer ---
  // S2 1.8.1 Modal underlay `transparent-black-500` (설치본 `Modal.css` — 색 모드 무관 한 값).
  "overlay-backdrop": "#00000070",
  "popover-outline": "#323232",
  "popover-background": "#222222",
  "collection-item-focus": "#323232",
  "picker-background": "#2c2c2c",
  "picker-background-hover": "#323232",
  "picker-content": "#dbdbdb",
  "picker-content-hover": "#f2f2f2",
  "picker-content-disabled": "#444444",
  "picker-checkbox-base": "#111111",
  base: "#111111", // S2 background-base-color
  raised: "#202023", // custom zinc-850 (Tailwind 에 없는 단계 — shared-tokens.css 유지) // --bg-raised = --color-zinc-850 (popover/dropdown/collection 컨테이너)
  "layer-1": "#1b1b1b", // S2 background-layer-1-color
  "layer-2": "#222222", // S2 background-layer-2-color
  elevated: "#222222", // S2 background-elevated-color
  disabled: "#2c2c2c", // S2 disabled-background-color
  "disabled-content": "#444444", // S2 disabled-content-color

  // --- Border ---
  border: TAILWIND_PALETTE.neutral[700], // neutral-700
  "border-hover": TAILWIND_PALETTE.neutral[500], // neutral-500
  "border-disabled": "#393939", // S2 disabled-border-color

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

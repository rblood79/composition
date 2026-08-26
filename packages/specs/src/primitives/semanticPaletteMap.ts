/**
 * Semantic Palette Map (ADR-193)
 *
 * 테마별 semantic·named hue → Tailwind 팔레트 (family, step) 매핑의 **단일 정본**.
 *
 * 두 소비자가 이 표 하나에서 파생된다:
 *   - Skia  : `colors.ts` `lightColors/darkColors` 의 status/named/subtle 항목 (`resolveSemanticHex`)
 *   - CSS   : `theme/generated/semantic-palette.css` (`pnpm generate:palette`) —
 *             `:root` / `[data-theme="dark"]` 에 `cssVar: var(--color-{family}-{step})` 참조만 emit
 *             (hex 금지 — ThemeStudio runtime override 훅 보존, R2)
 *
 * 취향 조정 (Spectrum 전용 hue 의 family, dark 단계 정책) 은 여기 한 줄 + 재생성으로 끝난다.
 * light 열은 ADR-191 후속 (2026-08-27) 정렬 값 그대로, dark 열은 기존 `darkColors` 설계
 * (본색 한 단계 밝게 / subtle 900) 그대로 옮겼다 — 값 변경 0 (snapshot test 가 고정).
 *
 * @packageDocumentation
 */

import {
  TAILWIND_PALETTE,
  type TailwindPaletteFamily,
  type TailwindPaletteStep,
} from "./generated/tailwindPalette";

/** 팔레트 좌표 — `TAILWIND_PALETTE[family][step]` */
export type PaletteRef = readonly [TailwindPaletteFamily, TailwindPaletteStep];

export interface SemanticPaletteEntry {
  light: PaletteRef;
  dark: PaletteRef;
  /** 생성 CSS 가 정의하는 semantic 변수명 — catalog/tokenResolver 매핑이 이 이름을 가리킨다 */
  cssVar: `--${string}`;
  /** 사용자 override 훅 — `cssVar: var(hook, var(--color-…))` 로 emit (예: `--color-invalid`) */
  hook?: `--${string}`;
}

/**
 * status 4 (+subtle 4 +strong 4) / named hue 19 (+subtle 19).
 *
 * 변수명 규약 (breakdown §3): status 는 `--{token}`, named hue 는 `--hue-{token}` —
 * `--indigo`·`--red` 류는 preview-system 의 tint preset 이 이미 점유하므로 접두 필수.
 * `gray` / `green-named` 는 catalog·tokenResolver 에는 있었으나 Skia 에 없던 결손 행 (Badge gray 캔버스 비가시).
 */
export const SEMANTIC_PALETTE_MAP = {
  // --- Status ---
  negative: {
    light: ["red", 500],
    dark: ["red", 400],
    cssVar: "--negative",
    hook: "--color-invalid",
  },
  "negative-subtle": {
    light: ["red", 100],
    dark: ["red", 900],
    cssVar: "--negative-subtle",
  },
  informative: {
    light: ["blue", 600],
    dark: ["blue", 500],
    cssVar: "--informative",
  },
  "informative-subtle": {
    light: ["blue", 100],
    dark: ["blue", 900],
    cssVar: "--informative-subtle",
  },
  positive: {
    light: ["green", 600],
    dark: ["green", 500],
    cssVar: "--positive",
  },
  "positive-subtle": {
    light: ["green", 100],
    dark: ["green", 900],
    cssVar: "--positive-subtle",
  },
  notice: {
    light: ["orange", 600],
    dark: ["orange", 500],
    cssVar: "--notice",
  },
  "notice-subtle": {
    light: ["orange", 100],
    dark: ["orange", 900],
    cssVar: "--notice-subtle",
  },
  // `-strong` — subtle 배경 위 텍스트 (Tailwind `bg-red-100 text-red-900` / Radix step 3↔11 관행). light 900 / dark 200.
  // 소비: Table error 선택 텍스트, CollectionErrorState 메시지. named hue 는 소비자 없음 (필요 시 같은 규칙으로 행 추가).
  "negative-strong": {
    light: ["red", 900],
    dark: ["red", 200],
    cssVar: "--negative-strong",
  },
  "positive-strong": {
    light: ["green", 900],
    dark: ["green", 200],
    cssVar: "--positive-strong",
  },
  "informative-strong": {
    light: ["blue", 900],
    dark: ["blue", 200],
    cssVar: "--informative-strong",
  },
  "notice-strong": {
    light: ["orange", 900],
    dark: ["orange", 200],
    cssVar: "--notice-strong",
  },

  // --- Named hue (StatusLight / Badge / Meter …) ---
  purple: { light: ["purple", 600], dark: ["purple", 500], cssVar: "--hue-purple" },
  "purple-subtle": { light: ["purple", 100], dark: ["purple", 900], cssVar: "--hue-purple-subtle" },
  yellow: { light: ["yellow", 500], dark: ["yellow", 400], cssVar: "--hue-yellow" },
  "yellow-subtle": { light: ["yellow", 100], dark: ["yellow", 900], cssVar: "--hue-yellow-subtle" },
  red: { light: ["red", 600], dark: ["red", 400], cssVar: "--hue-red" },
  "red-subtle": { light: ["red", 100], dark: ["red", 900], cssVar: "--hue-red-subtle" },
  orange: { light: ["orange", 600], dark: ["orange", 500], cssVar: "--hue-orange" },
  "orange-subtle": { light: ["orange", 100], dark: ["orange", 900], cssVar: "--hue-orange-subtle" },
  blue: { light: ["blue", 600], dark: ["blue", 500], cssVar: "--hue-blue" },
  "blue-subtle": { light: ["blue", 100], dark: ["blue", 900], cssVar: "--hue-blue-subtle" },
  indigo: { light: ["indigo", 700], dark: ["indigo", 500], cssVar: "--hue-indigo" },
  "indigo-subtle": { light: ["indigo", 100], dark: ["indigo", 900], cssVar: "--hue-indigo-subtle" },
  cyan: { light: ["cyan", 600], dark: ["cyan", 500], cssVar: "--hue-cyan" },
  "cyan-subtle": { light: ["cyan", 100], dark: ["cyan", 900], cssVar: "--hue-cyan-subtle" },
  pink: { light: ["pink", 600], dark: ["pink", 500], cssVar: "--hue-pink" },
  "pink-subtle": { light: ["pink", 100], dark: ["pink", 900], cssVar: "--hue-pink-subtle" },
  fuchsia: { light: ["fuchsia", 600], dark: ["fuchsia", 500], cssVar: "--hue-fuchsia" },
  "fuchsia-subtle": { light: ["fuchsia", 100], dark: ["fuchsia", 900], cssVar: "--hue-fuchsia-subtle" },
  magenta: { light: ["pink", 700], dark: ["rose", 600], cssVar: "--hue-magenta" },
  "magenta-subtle": { light: ["pink", 100], dark: ["rose", 900], cssVar: "--hue-magenta-subtle" },
  celery: { light: ["lime", 600], dark: ["lime", 500], cssVar: "--hue-celery" },
  "celery-subtle": { light: ["lime", 100], dark: ["lime", 900], cssVar: "--hue-celery-subtle" },
  chartreuse: { light: ["lime", 500], dark: ["lime", 400], cssVar: "--hue-chartreuse" },
  "chartreuse-subtle": { light: ["lime", 100], dark: ["lime", 900], cssVar: "--hue-chartreuse-subtle" },
  // Spectrum 전용 hue — Tailwind 에 같은 이름이 없어 가장 가까운 family 로 고정
  turquoise: { light: ["teal", 500], dark: ["teal", 400], cssVar: "--hue-turquoise" },
  "turquoise-subtle": { light: ["teal", 100], dark: ["teal", 900], cssVar: "--hue-turquoise-subtle" },
  seafoam: { light: ["teal", 700], dark: ["teal", 500], cssVar: "--hue-seafoam" },
  "seafoam-subtle": { light: ["teal", 100], dark: ["teal", 900], cssVar: "--hue-seafoam-subtle" },
  cinnamon: { light: ["amber", 800], dark: ["amber", 600], cssVar: "--hue-cinnamon" },
  "cinnamon-subtle": { light: ["amber", 100], dark: ["amber", 900], cssVar: "--hue-cinnamon-subtle" },
  brown: { light: ["yellow", 900], dark: ["yellow", 700], cssVar: "--hue-brown" },
  "brown-subtle": { light: ["yellow", 100], dark: ["yellow", 900], cssVar: "--hue-brown-subtle" },
  silver: { light: ["gray", 400], dark: ["gray", 500], cssVar: "--hue-silver" },
  "silver-subtle": { light: ["gray", 100], dark: ["gray", 800], cssVar: "--hue-silver-subtle" },
  // Skia 결손 행 (ADR-193 §0-3) — CSS 는 이미 neutral-500 / neutral-200, green-600 / green-100 이었다
  gray: { light: ["neutral", 500], dark: ["neutral", 400], cssVar: "--hue-gray" },
  "gray-subtle": { light: ["neutral", 200], dark: ["neutral", 700], cssVar: "--hue-gray-subtle" },
  "green-named": { light: ["green", 600], dark: ["green", 500], cssVar: "--hue-green" },
  "green-named-subtle": { light: ["green", 100], dark: ["green", 900], cssVar: "--hue-green-subtle" },
} as const satisfies Record<string, SemanticPaletteEntry>;

export type SemanticPaletteToken = keyof typeof SEMANTIC_PALETTE_MAP;

export type ColorTheme = "light" | "dark";

/** 표의 (family, step) → sRGB hex. Skia `colors.ts` 가 이걸로 파생된다. */
export function resolveSemanticHex(
  token: SemanticPaletteToken,
  theme: ColorTheme,
): string {
  const [family, step] = SEMANTIC_PALETTE_MAP[token][theme];
  return TAILWIND_PALETTE[family][step];
}

/** 테마 전 토큰 hex 맵 — `colors.ts` 스프레드용 */
export function resolveSemanticColors(
  theme: ColorTheme,
): Record<SemanticPaletteToken, string> {
  const out = {} as Record<SemanticPaletteToken, string>;
  for (const token of Object.keys(SEMANTIC_PALETTE_MAP) as SemanticPaletteToken[]) {
    out[token] = resolveSemanticHex(token, theme);
  }
  return out;
}

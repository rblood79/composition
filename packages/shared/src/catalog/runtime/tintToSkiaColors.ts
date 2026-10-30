/**
 * Tint → accent 색상 토큰
 *
 * Tint 프리셋 (또는 사용자 hex) 의 (chroma, hue) 에서 accent 토큰 hex 값을 파생한다 (순수 — 토큰 맵
 * mutation 없음, 설치는 `themeMaps.ts` `installThemeMaps`). 명도는 역할별 목표 대비로 정한다
 * (ADR-290 — `accentContrast.ts`). 결과는 resolver 가 Skia 맵과 DOM 변수에 같은 객체로 싣는다 (ADR-293).
 *
 * @see ADR-021 Phase A · ADR-290
 */

import {
  CHART_ACCENT_STEPS,
  CHART_ACCENT_TOKENS,
  darkColors,
  lightColors,
} from "@composition/rendering";

import {
  contrastRatio,
  solveLightness,
  type ContrastConstraint,
} from "./accentContrast";
import { hexToOklch, oklchToHex } from "./oklchToHex";

// ============================================================================
// srgb color-mix 유틸 (CSS color-mix(in srgb, color P%, black) 정합)
// ============================================================================

/**
 * CSS `color-mix(in srgb, hexColor P%, black)` 과 동일한 결과를 반환.
 * srgb 채널별 선형 혼합: result = color × (percent/100)
 * (black = 0,0,0 이므로 두 번째 항은 0)
 */
export function mixWithBlackSrgb(hex: string, percent: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const p = percent / 100;
  const mr = Math.max(0, Math.min(255, Math.round(r * p)));
  const mg = Math.max(0, Math.min(255, Math.round(g * p)));
  const mb = Math.max(0, Math.min(255, Math.round(b * p)));
  return `#${mr.toString(16).padStart(2, "0")}${mg.toString(16).padStart(2, "0")}${mb.toString(16).padStart(2, "0")}`;
}

// ============================================================================
// Tint 프리셋 정의 (preview-system.css 기준)
// ============================================================================

export type TintPreset =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "turquoise"
  | "cyan"
  | "blue"
  | "indigo"
  | "purple"
  | "pink";

interface TintValue {
  /** oklch hue (0~360) */
  h: number;
  /** oklch chroma (0~0.4) */
  c: number;
}

/** oklch(L C H) — preview-system.css와 동일한 값 */
export const TINT_PRESETS: Record<TintPreset, TintValue> = {
  red: { h: 27.0726, c: 0.181447 },
  orange: { h: 54, c: 0.150492 },
  yellow: { h: 73.8032, c: 0.128516 },
  green: { h: 155.372, c: 0.121276 },
  turquoise: { h: 205.114, c: 0.081146 },
  cyan: { h: 243.926, c: 0.142107 },
  blue: { h: 266.315, c: 0.22049 },
  indigo: { h: 284.23, c: 0.25049 },
  purple: { h: 302, c: 0.223324 },
  pink: { h: 347.813, c: 0.177717 },
};

// ============================================================================
// Lightness 스케일 (preview-system.css 기준)
// ============================================================================

/**
 * preview-system.css의 --tint-900 ~ --tint-1200 lightness 값.
 * highlight-background는 항상 55% 고정.
 */
const LIGHTNESS = {
  light: {
    highlight: 0.55, // --highlight-background: oklch(from var(--tint) 55% c h)
    900: 0.579699,
    1000: 0.519076,
    1100: 0.469058,
    1200: 0.410821,
  },
  dark: {
    highlight: 0.55,
    900: 0.623039,
    1000: 0.670121,
    1100: 0.723297,
    1200: 0.791773,
  },
};

/**
 * 색 피커 Theme 팔레트용 accent 사다리 (panel-ui 05 #1) — theme 이 실제로 쓰는 색을 밝은 순으로:
 * subtle · 900 · 탐색된 `accent` · `accent-content` (ADR-290) · 1000 · 1100 · 1200. 같은 hex 는 한 칸.
 */
export function resolveAccentLadder(
  tint: TintPreset,
  mode: "light" | "dark",
  surfaces?: Readonly<Record<string, string>>,
): string[] {
  const { h, c } = TINT_PRESETS[tint];
  const ls = LIGHTNESS[mode];
  const roles = solveAccentRoles(c, h, mode, { surfaces });
  const subtleL = mode === "light" ? 0.95 : 0.25;
  const steps: Array<[number, string]> = [
    [subtleL, oklchToHex(subtleL, c * 0.3, h)],
    [ls[900], oklchToHex(ls[900], c, h)],
    [roles.accentL, roles.accent],
    [roles.contentL, roles.content],
    [ls[1000], oklchToHex(ls[1000], c, h)],
    [ls[1100], oklchToHex(ls[1100], c, h)],
    [ls[1200], oklchToHex(ls[1200], c, h)],
  ];
  return [
    ...new Set(steps.sort((a, b) => b[0] - a[0]).map(([, hex]) => hex)),
  ];
}

// ============================================================================
// accent 토큰 파생
// ============================================================================

/** accent 배경 위 글자 · 아이콘 — 두 모드 모두 흰색 (S2 Button fill 과 같음, ADR-290 결정 1). */
export const ON_ACCENT = "#ffffff";

/**
 * `accent-content` (바탕 위 글자 · 선 · 채움) 가 놓이는 바탕 — catalog rule 에서 유도한 집합 (ADR-290 §5).
 * 글자가 놓이는 바탕은 4.5, 선 · 채움만 놓이는 바탕은 3.0. 배경이 투명한 자리 (outline · Link) 는
 * 컨테이너 surface 전부. `accentContentBackdrops.static.test.ts` 가 rule 과 대조한다.
 */
export const ACCENT_CONTENT_TEXT_BACKDROPS = [
  "base",
  "raised",
  "layer-1",
  "layer-2",
  "elevated",
  "accent-subtle",
] as const;
export const ACCENT_CONTENT_GRAPHIC_BACKDROPS = ["neutral-subtle"] as const;

const TEXT_CONTRAST = 4.5;
const GRAPHIC_CONTRAST = 3.0;
/** `accent-content-hover` 는 가장 가까운 바탕과의 대비를 이만큼 더 벌린다. */
const HOVER_CONTRAST_STEP = 1.0;
const HOVER_CONTRAST_CAP = 15;
const PRESET_LIGHTNESS = 0.55;

export interface AccentRoleOptions {
  /**
   * 테마 바탕 (Tone · 명시 델타가 반영된 색 맵) — 없으면 설치된 토큰 맵 (`lightColors` · `darkColors`).
   * `base` · `raised` · `layer-1` · `layer-2` · `elevated` · `neutral-subtle` 만 읽는다.
   */
  surfaces?: Readonly<Record<string, string>>;
  /** 시작 명도 — 사용자 hex 면 그 hex 의 명도 (ADR-290 결정 2). 기본 55%. */
  startL?: number;
  /** 사용자 hex — 조건을 통과하면 그 색 그대로 (브랜드색 보존). */
  startHex?: string;
  /** 명시 `color.accent-subtle` — 없으면 (c, h) 에서 파생. */
  subtle?: string;
  /** 명시 `color.accent-content` — 있으면 그 값을 쓰고 hover 만 탐색한다. */
  content?: string;
  warnings?: string[];
}

interface AccentRoles {
  accent: string;
  accentL: number;
  content: string;
  contentL: number;
  contentHover: string;
  subtle: string;
}

function hexL(hex: string, fallback: number): number {
  return hexToOklch(hex)?.l ?? fallback;
}

function solveAccentRoles(
  c: number,
  h: number,
  mode: "light" | "dark",
  options: AccentRoleOptions,
): AccentRoles {
  const surfaces =
    options.surfaces ??
    ((mode === "dark" ? darkColors : lightColors) as unknown as Record<
      string,
      string
    >);
  const startL = options.startL ?? PRESET_LIGHTNESS;
  const subtle =
    options.subtle ??
    oklchToHex(mode === "light" ? 0.95 : 0.25, c * 0.3, h);
  const backdrop = (key: string) =>
    key === "accent-subtle" ? subtle : (surfaces[key] ?? "");
  const warn = (role: string) =>
    options.warnings?.push(
      `${mode} ${role}: 대비 조건 일부 미충족 (글자 우선)`,
    );

  // 배경 역할 — 흰 글자 4.5 · 바탕과 경계 3.0 (hover · pressed 는 검정 혼합이라 흰 글자 대비가 오른다)
  const accent = solveLightness({
    c,
    h,
    startL,
    startHex: options.startHex,
    constraints: [
      { against: ON_ACCENT, min: TEXT_CONTRAST },
      { against: backdrop("base"), min: GRAPHIC_CONTRAST },
    ],
  });
  if (!accent.ok) warn("accent");

  // 바탕 위 역할 — 유도한 바탕 집합
  const contentConstraints = (text: number, graphic: number) => [
    ...ACCENT_CONTENT_TEXT_BACKDROPS.map(
      (key): ContrastConstraint => ({ against: backdrop(key), min: text }),
    ),
    ...ACCENT_CONTENT_GRAPHIC_BACKDROPS.map(
      (key): ContrastConstraint => ({ against: backdrop(key), min: graphic }),
    ),
  ];
  let content: { hex: string; l: number };
  if (options.content) {
    content = { hex: options.content, l: hexL(options.content, startL) };
  } else {
    const solved = solveLightness({
      c,
      h,
      startL,
      startHex: options.startHex,
      constraints: contentConstraints(TEXT_CONTRAST, GRAPHIC_CONTRAST),
    });
    if (!solved.ok) warn("accent-content");
    content = solved;
  }

  // hover — 가장 가까운 글자 바탕과의 대비를 한 단 더 (모드에 따라 방향이 정해진다)
  const nearest = Math.min(
    ...ACCENT_CONTENT_TEXT_BACKDROPS.map((key) =>
      contrastRatio(content.hex, backdrop(key)),
    ).filter((r) => !Number.isNaN(r)),
  );
  const hoverText = Math.min(
    HOVER_CONTRAST_CAP,
    Math.max(TEXT_CONTRAST + HOVER_CONTRAST_STEP, nearest + HOVER_CONTRAST_STEP),
  );
  const hover = solveLightness({
    c,
    h,
    startL: content.l,
    constraints: contentConstraints(
      hoverText,
      GRAPHIC_CONTRAST + HOVER_CONTRAST_STEP,
    ),
  });

  return {
    accent: accent.hex,
    accentL: accent.l,
    content: content.hex,
    contentL: content.l,
    contentHover: hover.hex,
    subtle,
  };
}

/**
 * accent 계열 토큰 (ADR-290): 배경 역할 `accent` (위에 on-accent 를 얹는 면) 과 바탕 위 역할
 * `accent-content` 를 각각 목표 대비로 정한다. (c, h) 는 그대로, 명도만 움직인다.
 */
export function createAccentColorTokens(
  c: number,
  h: number,
  mode: "light" | "dark",
  options: AccentRoleOptions = {},
): AccentColorTokens {
  const roles = solveAccentRoles(c, h, mode, options);
  // Chart mono 팔레트 — chartPaletteMap.ts 의 (L, chroma 계수) 표. CSS `--chart-accent-N`
  //   (`oklch(from var(--tint) L calc(c × f) h)`) 과 같은 공식이라 두 leg 가 같은 단계를 본다.
  const chart = Object.fromEntries(
    CHART_ACCENT_STEPS.map((step, i) => [
      CHART_ACCENT_TOKENS[i],
      oklchToHex(step.lightness, c * step.chromaFactor, h),
    ]),
  ) as Record<(typeof CHART_ACCENT_TOKENS)[number], string>;
  return {
    accent: roles.accent,
    "accent-hover": mixWithBlackSrgb(roles.accent, 85),
    "accent-pressed": mixWithBlackSrgb(roles.accent, 75),
    "on-accent": ON_ACCENT,
    "accent-subtle": roles.subtle,
    "accent-content": roles.content,
    "accent-content-hover": roles.contentHover,
    ...chart,
  };
}

// ============================================================================
// Per-element accent (ADR-021 Phase E)
// ============================================================================

/** accent 계열 토큰 스냅샷 */
export interface AccentColorTokens {
  accent: string;
  "accent-hover": string;
  "accent-pressed": string;
  "on-accent": string;
  "accent-subtle": string;
  "accent-content": string;
  "accent-content-hover": string;
  "chart-accent-1": string;
  "chart-accent-2": string;
  "chart-accent-3": string;
  "chart-accent-4": string;
}

/**
 * 요소별 tint가 바꾸는 accent token만 pure value로 계산한다 — 바탕은 설치된 활성 테마 맵.
 * 전역 토큰 맵을 mutation 하지 않는다.
 */
export function resolveAccentColorTokens(
  accentTint: TintPreset | undefined,
  mode: "light" | "dark",
): AccentColorTokens | undefined {
  if (!accentTint || !(accentTint in TINT_PRESETS)) return undefined;
  const { h, c } = TINT_PRESETS[accentTint];
  return createAccentColorTokens(c, h, mode);
}


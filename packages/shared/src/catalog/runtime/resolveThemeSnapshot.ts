/**
 * ADR-227 Phase 2 — 활성 테마 → `ResolvedThemeSnapshot` (pure).
 *
 * 해석 순서 (breakdown §3.3): preset seed (tint · neutral · radius 파생 + specs 정적 맵) → root
 * user-defined fallback → 활성 테마 명시 델타 → **미명시 파생 키** 계산. 명시 hover/pressed 값은
 * 파생보다 우선한다. dark 는 preset 파생만 다르고 명시 델타는 양 모드에 같이 (§6 유보).
 *
 * 출력은 두 leg 가 그대로 소비하는 모양이다 — Skia/레이아웃은 specs 토큰 맵 (`colors` · `typography`
 * · `radius` · `shadows`) 을 덮어쓰고, DOM (Preview `THEME_VARS` · Publish) 은 `cssVars` 한 벌을
 * 싣는다 (`installThemeSnapshot`). 노드별 snapshot 은 없다.
 *
 * **테마 색은 여기서만 만든다 (ADR-293)**: 모든 델타 · 파생이 끝난 최종 `colors.light` / `colors.dark` 의
 * 모든 키를 함수 끝에서 `cssVars` (`color: true`) 로 싣는다 — 변수 이름은 생성 CSS 와 같은 표
 * (`colorTokenCssValue`) 에서. `preview-system.css` 는 이 변수들을 계산하지 않는다. 토큰 ↔ 변수는 1:1 이고
 * 팔레트 상수 `white` · `black` (`--color-white` · `--color-black`) 과 Tone 단계 `--color-neutral-N` 은
 * 테마 색으로 덮지 않는다.
 *
 * 색 델타 규칙:
 *   - `color.accent` (hex) 는 **tint 대체** — hex 의 (c, h) 로 tint 프리셋과 같은 파생 (역할별 목표 대비
 *     accent · accent-content · hover 85%/pressed 75% black mix · subtle · chart) 을 만든다. 명도 탐색은
 *     hex 자신의 명도에서 시작해 통과하면 hex 그대로 (ADR-290). accent 탐색은 Tone 과 명시 색 델타가 반영된
 *     바탕을 입력으로 받는다. DOM 의 `--tint` 는 `--tint-N` 사다리 · link · focus-ring 의 입력으로만 남는다.
 *   - 그 밖의 `color.<key>` 는 값 그대로 양 모드 맵에. 명시된 `<x>` 의 미명시 `<x>-hover` / `<x>-pressed`
 *     는 base 에서 다시 혼합한다 (아래 파생 블록) — DOM 은 최종 맵을 받으므로 같은 값.
 */
import type { ThemeDefinition, TokensSnapshot } from "@composition/shared";
import { BASE_TYPOGRAPHY_TOKEN_KEYS } from "@composition/shared";
import {
  colorTokenCssValue,
  borderWidth as borderWidthSeed,
  darkColors,
  darkShadows,
  lightColors,
  lightShadows,
  radius as radiusSeed,
  typography as typographySeed,
} from "@composition/rendering";
import type { BaseTypography } from "./fontDefaults";
import { hexToOklch } from "./oklchToHex";
import {
  resolveNeutralColorTokens,
  resolveNeutralSteps,
  type NeutralPreset,
} from "./neutralToSkiaColors";
import { resolveRadiusTokens } from "./radiusScaleToSkia";
import {
  TINT_PRESETS,
  createAccentColorTokens,
  mixWithBlackSrgb,
  type TintPreset,
} from "./tintToSkiaColors";

export interface ThemeCssVar {
  name: string;
  value: string;
  isDark: boolean;
  /** 테마 색 — DOM 은 `@media not (forced-colors: active)` 안에 싣는다 (시스템 색이 이기게). */
  color: boolean;
}

/**
 * 바탕 토큰 → 그 바탕의 hover · pressed 토큰 (이름이 `<x>-hover` 가 아닌 것만). `neutral-hover` 는
 * 밝은 바탕 `neutral-subtle` 의 다음 단이고, 진한 바탕 `neutral` 의 것은 `neutral-fill-*` 다 (ADR-293 결정 4).
 * 명시 델타 뒤 파생이 엉뚱한 바탕에서 혼합하면 그 값이 DOM 에도 실린다.
 */
const DERIVED_STATE_KEYS: Readonly<Record<string, readonly [string, string]>> =
  {
    neutral: ["neutral-fill-hover", "neutral-fill-pressed"],
    "neutral-subtle": ["neutral-hover", "neutral-pressed"],
  };

/** 팔레트 상수 — 테마 색 변수로 싣지 않는다 (`--color-white` · `--color-black` 은 팔레트 CSS 소유). */
const PALETTE_CONSTANT_COLOR_TOKENS: ReadonlySet<string> = new Set([
  "white",
  "black",
]);

export interface ResolvedThemeSnapshot {
  themeId: string;
  preset: ThemeDefinition["preset"];
  /** 유효 dark 여부는 소비자가 `darkMode` ("system" 포함) 로 판정한다. */
  darkMode: string;
  colors: { light: Record<string, string>; dark: Record<string, string> };
  typography: Record<string, number | string>;
  radius: Record<string, number>;
  /** ADR-227 Phase 3 — border 폭 (px): `{border.width.none|thin|thick}` 의 값. Skia 맵 · DOM `--border-width-*`. */
  border: Record<string, number>;
  shadows: { light: Record<string, string>; dark: Record<string, string> };
  base: BaseTypography;
  /** DOM 한 벌 — light/dark 두 블록. Preview `THEME_VARS` (replace) · Publish 가 그대로 싣는다. */
  cssVars: ThemeCssVar[];
  warnings: string[];
}

// 정적 seed — 모듈 로드 시점의 specs 맵 (tint/neutral 파생 키는 어차피 preset 에서 다시 계산한다).
//   installThemeSnapshot 이 같은 맵을 mutation 하므로 **여기서 복사해 둔 것이 seed 정본**이다.
const SEED_LIGHT_COLORS: Readonly<Record<string, string>> = {
  ...(lightColors as unknown as Record<string, string>),
};
const SEED_DARK_COLORS: Readonly<Record<string, string>> = {
  ...(darkColors as unknown as Record<string, string>),
};
const SEED_TYPOGRAPHY: Readonly<Record<string, number | string>> = {
  ...(typographySeed as unknown as Record<string, number | string>),
};
const SEED_RADIUS: Readonly<Record<string, number>> = {
  ...(radiusSeed as unknown as Record<string, number>),
};
const SEED_BORDER: Readonly<Record<string, number>> = {
  ...(borderWidthSeed as unknown as Record<string, number>),
};
const SEED_LIGHT_SHADOWS: Readonly<Record<string, string>> = {
  ...(lightShadows as unknown as Record<string, string>),
};
const SEED_DARK_SHADOWS: Readonly<Record<string, string>> = {
  ...(darkShadows as unknown as Record<string, string>),
};

const NEUTRAL_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

/** focus 축 — DOM 만 (ADR-150: 캔버스는 focus ring 을 그리지 않는다). */
const FOCUS_TOKEN_TO_VAR: Readonly<
  Record<string, { name: string; px: boolean }>
> = {
  "ring-color": { name: "--focus-ring", px: false },
  "ring-width": { name: "--focus-ring-width", px: true },
  "ring-offset": { name: "--focus-ring-offset", px: true },
  "ring-inset-offset": { name: "--focus-ring-inset-offset", px: true },
};

function tintOf(
  preset: ThemeDefinition["preset"],
  accentHex: string | undefined,
  warnings: string[],
): {
  c: number;
  h: number;
  tintVar: string;
  startL?: number;
  startHex?: string;
} {
  if (accentHex) {
    const oklch = hexToOklch(accentHex);
    // 사용자 hex 는 자기 명도에서 탐색을 시작한다 — 통과하면 브랜드색 그대로 (ADR-290 결정 2)
    if (oklch)
      return {
        c: oklch.c,
        h: oklch.h,
        tintVar: accentHex,
        startL: oklch.l,
        startHex: /^#[0-9a-f]{6}$/i.test(accentHex.trim())
          ? accentHex.trim().toLowerCase()
          : undefined,
      };
    warnings.push(
      `color.accent "${accentHex}" 는 hex 가 아니라 tint 프리셋으로 대체`,
    );
  }
  const tint = (
    preset.tint in TINT_PRESETS ? preset.tint : "blue"
  ) as TintPreset;
  const { c, h } = TINT_PRESETS[tint];
  return { c, h, tintVar: `var(--${tint})` };
}

/**
 * `{color.<key>}` 의 DOM 변수 이름 — 생성 CSS 와 같은 표의 `var(--x)` · `var(--x, 폴백)` 의 `--x`.
 * 표에 없는 키는 `--<key>`, CSS 키워드 (`transparent`) 는 null.
 */
export function colorTokenCssVarName(key: string): string | null {
  const css = colorTokenCssValue(key);
  if (css === undefined) return `--${key}`;
  return /^var\((--[a-z0-9-]+)\s*[,)]/i.exec(css)?.[1] ?? null;
}

function toPxOrRatio(
  key: string,
  value: number,
  sizes: Record<string, number | string>,
): string {
  // `--text-sm--line-height` 는 DOM 에서 unitless 비율 (calc(lh/size)) — Skia 는 px 를 든다.
  const lhMatch = /^(text-[a-z0-9-]+?)--line-height$/.exec(key);
  if (lhMatch) {
    const size = Number(sizes[lhMatch[1]!]);
    // 정확한 분수로 — 소수 4자리 반올림 (1.3333 × 12 = 15.9996) 은 DOM 줄 상자를 Skia 의 px 보다
    //   미세하게 줄인다 (ADR-295 G1: 전 키를 싣자 S size 글자가 16 → 15.98).
    if (Number.isFinite(size) && size > 0) {
      const ratio = value / size;
      const short = Math.round(ratio * 10000) / 10000;
      return short === ratio ? String(short) : `calc(${value} / ${size})`;
    }
  }
  return `${value}px`;
}

export function resolveThemeSnapshot(
  theme: ThemeDefinition,
  options: { rootTokens?: TokensSnapshot; baseTypographySeed: BaseTypography },
): ResolvedThemeSnapshot {
  const warnings: string[] = [];
  const preset = theme.preset;
  // root user-defined 는 테마 무관 fallback — 테마 델타가 같은 키를 덮는다.
  const delta: TokensSnapshot = {
    ...(options.rootTokens ?? {}),
    ...theme.tokens,
  };

  // ── seed ──
  const accentDelta = delta["color.accent"];
  const accentHex =
    typeof accentDelta?.value === "string" ? accentDelta.value : undefined;
  const { c, h, tintVar, startL, startHex } = tintOf(
    preset,
    accentHex,
    warnings,
  );
  const neutral = (preset.neutral || "neutral") as NeutralPreset;
  // accent 는 실제 바탕을 알고 정한다 (ADR-290): Tone → 명시 색 델타 → accent 탐색. 명시 accent 계열
  //   델타 (`accent-hover` …) 는 아래 델타 루프가 탐색 결과를 덮는다.
  const explicitColors: Record<string, string> = {};
  for (const [tokenKey, entry] of Object.entries(delta))
    if (
      tokenKey.startsWith("color.") &&
      tokenKey !== "color.accent" &&
      typeof entry.value === "string" &&
      entry.value.trim() !== ""
    )
      explicitColors[tokenKey.slice(6)] = entry.value;
  const seedColors = (mode: "light" | "dark"): Record<string, string> => ({
    ...(mode === "dark" ? SEED_DARK_COLORS : SEED_LIGHT_COLORS),
    ...resolveNeutralColorTokens(neutral, mode),
  });
  const withAccent = (mode: "light" | "dark"): Record<string, string> => {
    const seed = seedColors(mode);
    return {
      ...seed,
      ...createAccentColorTokens(c, h, mode, {
        surfaces: { ...seed, ...explicitColors },
        startL,
        startHex,
        subtle: explicitColors["accent-subtle"],
        content: explicitColors["accent-content"],
        warnings,
      }),
    };
  };
  const light = withAccent("light");
  const dark = withAccent("dark");
  const typography: Record<string, number | string> = { ...SEED_TYPOGRAPHY };
  const radius: Record<string, number> = {
    ...SEED_RADIUS,
    ...resolveRadiusTokens(preset.radiusScale),
  };
  const border: Record<string, number> = { ...SEED_BORDER };
  const lightShadow: Record<string, string> = { ...SEED_LIGHT_SHADOWS };
  const darkShadow: Record<string, string> = { ...SEED_DARK_SHADOWS };
  const base: BaseTypography = { ...options.baseTypographySeed };

  // ── DOM 한 벌 (seed) ──
  const cssVars: ThemeCssVar[] = [];
  // 같은 (name, isDark) 는 마지막 값 하나만 — seed 뒤 델타가 덮는다 (DOM 에 중복 선언을 보내지 않는다)
  const put = (name: string, value: string, isDark: boolean, color = false) => {
    const i = cssVars.findIndex((v) => v.name === name && v.isDark === isDark);
    if (i === -1) cssVars.push({ name, value, isDark, color });
    else cssVars[i] = { name, value, isDark, color };
  };
  const both = (name: string, value: string) => {
    put(name, value, false);
    put(name, value, true);
  };
  // `--tint-N` 사다리 · link · focus-ring 의 입력 (DOM 전용 — 테마 색 토큰이 아니다)
  both("--tint", tintVar);
  const steps = resolveNeutralSteps(neutral);
  for (const step of NEUTRAL_STEPS)
    both(`--color-neutral-${step}`, steps[step]!);
  for (const [key, px] of Object.entries(radius)) {
    if (key === "none" || key === "full") continue;
    both(`--radius-${key}`, `${px}px`);
  }
  for (const [key, px] of Object.entries(border))
    both(`--border-width-${key}`, `${px}px`);

  // ── 명시 델타 ──
  const explicitColorKeys = new Set<string>();
  for (const [tokenKey, entry] of Object.entries(delta)) {
    const dot = tokenKey.indexOf(".");
    const category = dot === -1 ? tokenKey : tokenKey.slice(0, dot);
    const key = tokenKey.slice(dot + 1);
    const value = entry.value;
    switch (category) {
      case "color": {
        if (key === "accent") break; // tint 대체 — 위에서 처리 (파생까지)
        if (typeof value !== "string" || value.trim() === "") {
          warnings.push(`${tokenKey} 무효 색 값 — 무시`);
          break;
        }
        light[key] = value;
        dark[key] = value;
        explicitColorKeys.add(key);
        break;
      }
      case "typography": {
        if (key === "base-font-family" && typeof value === "string") {
          base.fontFamily = value;
        } else if (key === "base-font-size" && typeof value === "number") {
          base.fontSize = value;
        } else if (key === "base-line-height" && typeof value === "number") {
          base.lineHeight = value;
        } else if (
          typeof value === "number" &&
          Number.isFinite(value) &&
          value >= 0
        ) {
          typography[key] = value;
        } else if (key === "sans" || key === "mono") {
          if (typeof value === "string") typography[key] = value;
        } else {
          warnings.push(`${tokenKey} 무효 값 — 무시`);
        }
        break;
      }
      case "radius": {
        if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
          radius[key] = value;
          both(`--radius-${key}`, `${value}px`);
        } else warnings.push(`${tokenKey} 무효 값 — 무시`);
        break;
      }
      case "shadow": {
        if (typeof value === "string" && value.trim() !== "") {
          lightShadow[key] = value;
          darkShadow[key] = value;
          both(`--shadow-${key}`, value);
        } else warnings.push(`${tokenKey} 무효 값 — 무시`);
        break;
      }
      case "focus": {
        const target = FOCUS_TOKEN_TO_VAR[key];
        if (!target) {
          warnings.push(`${tokenKey} 미지원 focus 키 — 무시`);
          break;
        }
        if (target.px && typeof value === "number")
          both(target.name, `${value}px`);
        else if (!target.px && typeof value === "string")
          both(target.name, value);
        else warnings.push(`${tokenKey} 무효 값 — 무시`);
        break;
      }
      // ADR-227 Phase 3: `border.width.<k>` — 맵 키는 `<k>` (none/thin/thick), 새 키도 받는다
      case "border": {
        const name = key.startsWith("width.") ? key.slice(6) : "";
        if (
          name !== "" &&
          typeof value === "number" &&
          Number.isFinite(value) &&
          value >= 0
        ) {
          border[name] = value;
          both(`--border-width-${name}`, `${value}px`);
        } else warnings.push(`${tokenKey} 무효 값 — 무시`);
        break;
      }
      default:
        warnings.push(`${tokenKey} 미지원 카테고리 — 무시`);
    }
  }
  // typography DOM 변수 — 전 키를 싣는다 (ADR-295: seed 가 S2 값이라 `shared-tokens.css` 의 chrome 값과
  //   다르다. 델타만 실으면 Preview · Publish 가 chrome 값을 읽어 Skia 와 갈린다). 크기가 바뀌면 line-height
  //   비율도 같이 다시 낸다.
  for (const [key, value] of Object.entries(typography)) {
    if (typeof value !== "number") continue;
    both(
      `--${key === "text-md" ? "text-base" : key}`,
      toPxOrRatio(key, value, typography),
    );
  }

  // ── 파생 키: 명시가 없으면 base 에서 (양 leg 같은 식) ──
  //   accent 계열은 createAccentColorTokens 가 이미 채웠다. 그 밖의 `<x>` 가 명시되고 `<x>-hover/-pressed`
  //   가 명시되지 않았으면 Skia 맵은 seed 파생값 그대로 (DOM 은 color-mix 가 base 변수를 따라간다)
  //   — 두 leg 가 갈리지 않게 Skia 도 base 로부터 mix 한다.
  for (const key of explicitColorKeys) {
    // 명시 `accent-content` 의 hover 는 accent 탐색이 그 값에서 이미 풀었다 (dark 는 밝히는 방향)
    if (key === "accent-content") continue;
    const [hoverKey, pressedKey] = DERIVED_STATE_KEYS[key] ?? [
      `${key}-hover`,
      `${key}-pressed`,
    ];
    for (const [derived, pct] of [
      [hoverKey, 85],
      [pressedKey, 75],
    ] as const) {
      if (explicitColorKeys.has(derived)) continue;
      if (!(derived in SEED_LIGHT_COLORS)) continue;
      light[derived] = mixHexWithBlack(light[key]!, pct) ?? light[derived]!;
      dark[derived] = mixHexWithBlack(dark[key]!, pct) ?? dark[derived]!;
    }
  }

  // ── 테마 색 전체 → DOM (ADR-293): 최종 맵에서, 파생 재계산 뒤에 ──
  for (const [map, isDark] of [
    [light, false],
    [dark, true],
  ] as const)
    for (const [key, value] of Object.entries(map)) {
      if (PALETTE_CONSTANT_COLOR_TOKENS.has(key)) continue;
      const name = colorTokenCssVarName(key);
      if (name) put(name, value, isDark, true);
    }

  return {
    themeId: theme.id,
    preset,
    darkMode: preset.darkMode,
    colors: { light, dark },
    typography,
    radius,
    border,
    shadows: { light: lightShadow, dark: darkShadow },
    base,
    cssVars,
    warnings,
  };
}

/** hex6 만 mix (tintToSkiaColors 와 같은 식) — hex 가 아니면 null 로 두어 seed 파생값을 유지한다. */
function mixHexWithBlack(hex: string, pct: number): string | null {
  return /^#[0-9a-f]{6}$/i.test(hex.trim())
    ? mixWithBlackSrgb(hex.trim(), pct)
    : null;
}

export { BASE_TYPOGRAPHY_TOKEN_KEYS };

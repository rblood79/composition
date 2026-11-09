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
 * 팔레트 상수 `white` · `black` (`--color-white` · `--color-black`) 은 테마 색으로 덮지 않는다. 팔레트 변수
 * (`--color-<family>-<step>`, ADR-191) 는 테마가 덮지 않는다 — 두 축의 사다리는 `--tint-N` · `--tone-N` 이다 (R7).
 *
 * 색 (ADR-302): preset 의 두 축 (accent = tint 또는 `color.accent` hex · tone = Tone) → 사다리 → alias 표 →
 * 역할 두 벌 → 명시 델타 덮기.
 *   - 기본 축 (tint blue · hex 없음 / Tone neutral) 은 seed (`colors.ts` — alias 표 × Spectrum 사다리) 그대로.
 *   - 비기본 축은 생성 사다리 (`ladderGenerate.ts` — lazy chunk, `themeLadders.ts` 로더). 로드 전이면 seed 와
 *     `THEME_LADDERS_PENDING` 경고 — 로드되면 세션이 테마를 다시 적용한다.
 *   - `color.accent` (hex) 는 **tint 대체** — hex 의 (c, h) 가 accent 축 입력이다.
 *   - 두 축의 사다리 자체도 DOM 에 싣는다 — `--tint-<단>` (accent 16 단) · `--tone-<단>` (tone 13 단), 모드별 값
 *     (Canvas 와 같은 사다리 — 옛 CSS oklch 상대색 · Tailwind Tone 단계는 없다). DOM 전용 색 (link · 강조
 *     글자 · track …, `preview-system.css`) 이 이 변수를 읽는다.
 *   - 그 밖의 `color.<key>` 는 값 그대로 양 모드 맵에 (사용자 결정 5 — override 한 값). 그 `<x>-hover` ·
 *     `<x>-pressed` 는 사다리 값 그대로다 (혼합 파생 없음 — Decision 2).
 */
import type { ThemeDefinition, TokensSnapshot } from "@composition/shared";
import { BASE_TYPOGRAPHY_TOKEN_KEYS } from "@composition/shared";
import {
  catalogTokenVarName,
  colorTokenCssValue,
  borderWidth as borderWidthSeed,
  darkColors,
  darkShadows,
  lightColors,
  lightShadows,
  radius as radiusSeed,
  S2_DEVICE,
  SPECTRUM_DEFAULT_LADDERS,
  s2ControlHeights,
  s2SizeTokens,
  s2TypographyTokens,
  typography as typographySeed,
  type S2Device,
} from "@composition/rendering";
import {
  catalogCssFontFamily,
  DEFAULT_BASE_TYPOGRAPHY,
  type BaseTypography,
} from "./fontDefaults";
import { hexToOklch } from "./oklchToHex";
import type { NeutralPreset } from "./neutralToSkiaColors";
import { resolveRadiusTokens } from "./radiusScaleToSkia";
import {
  THEME_LADDERS_PENDING,
  themeAccentHex,
  themeLadderModule,
  themeNeedsLadders,
} from "./themeLadders";
import { TINT_PRESETS, type TintPreset } from "./tintToSkiaColors";

export interface ThemeCssVar {
  name: string;
  value: string;
  isDark: boolean;
  /** 테마 색 — DOM 은 `@media not (forced-colors: active)` 안에 싣는다 (시스템 색이 이기게). */
  color: boolean;
}

/** ADR-295 — 기기 벌 하나 (desktop · touch). Canvas 는 desktop 만 읽는다 (사용자 결정 7). */
export interface ResolvedDeviceTokens {
  scale: number;
  /** S2 `--s2-font-size-base` (px) — 글자 단계식의 기준. */
  fontBase: number;
  typography: Record<string, number | string>;
  /** S2 component-height 5단 × scale — Skia 맵 `size` 의 `height.<S>` (`{size.height.XS…XL}`, Phase 3). */
  controlHeight: Record<string, number>;
}

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
  /** Seed와 같은 명시 값도 locale 기본값보다 우선하도록 provenance를 보존한다. */
  explicitTypography: Readonly<Record<string, number | string>>;
  /** ADR-227 Phase 3 — border 폭 (px): `{border.width.none|thin|thick}` 의 값. Skia 맵 · DOM `--border-width-*`. */
  border: Record<string, number>;
  shadows: { light: Record<string, string>; dark: Record<string, string> };
  base: BaseTypography;
  /**
   * ADR-295 Phase 3 — `{size.height.<S>}` 의 Skia 맵 (키 `height.<S>`). desktop 벌 — Canvas 는 desktop 만 그린다
   * (사용자 결정 7). `touchThemeSnapshot` 이 터치 벌로 바꾼다.
   */
  size: Record<string, number>;
  /** ADR-295 — desktop 벌의 `typography` 는 위 `typography` 와 같은 객체. */
  device: Record<S2Device, ResolvedDeviceTokens>;
  /**
   * ADR-295 Decision 2 — 터치 벌의 DOM 변수 (치수뿐 — light/dark 구분 없음). `cssVars` 와 따로 둔다: DOM 은
   * S2 와 같은 `@media not ((hover: hover) and (pointer: fine))` 안과 Preview 「터치」 보기
   * (`:root[data-catalog-touch]`) 에만 싣는다 (`catalogThemeVarsCss`). `cssVars` 를 그대로 `:root` 에 쓰는
   * 소비자가 터치 값을 desktop 위에 덮지 않게.
   */
  touchCssVars: { name: string; value: string }[];
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

/** focus 축 — DOM 변수와 ActionButton·ToggleButton Canvas outline이 함께 읽는다. */
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
  /** 기본 accent 축 (tint blue · 유효한 hex 없음) — 사다리 = Spectrum blue 그대로. */
  isDefault: boolean;
} {
  if (accentHex) {
    const oklch = hexToOklch(accentHex);
    // 사용자 hex 는 (c, h) 만 — 명도는 사다리 모양을 따른다 (ADR-302 Decision 1)
    if (oklch) return { c: oklch.c, h: oklch.h, isDefault: false };
    warnings.push(
      `color.accent "${accentHex}" 는 hex 가 아니라 tint 프리셋으로 대체`,
    );
  }
  const tint = (
    preset.tint in TINT_PRESETS ? preset.tint : "blue"
  ) as TintPreset;
  const { c, h } = TINT_PRESETS[tint];
  return { c, h, isDefault: tint === "blue" };
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
  const accentHex = themeAccentHex(delta);
  const { c, h, isDefault } = tintOf(preset, accentHex, warnings);
  const neutral = (preset.neutral || "neutral") as NeutralPreset;
  // ADR-302 — 비기본 축은 생성 사다리 (lazy). 로드 전이면 seed 로 두고 알린다 (세션이 로드 뒤 다시 적용).
  const ladders = themeNeedsLadders(preset, accentHex)
    ? themeLadderModule()
    : undefined;
  if (themeNeedsLadders(preset, accentHex) && !ladders)
    warnings.push(THEME_LADDERS_PENDING);
  const toneHues = ladders?.TONE_PRESET_HUES as
    Readonly<Record<string, { c: number; h: number }>> | undefined;
  const generated = ladders?.buildThemeColors({
    accent: isDefault ? undefined : { c, h },
    tone: toneHues?.[neutral],
  });
  for (const failure of generated?.failures ?? [])
    warnings.push(`ADR-302 대비 미달: ${failure}`);
  const light: Record<string, string> = {
    ...SEED_LIGHT_COLORS,
    ...generated?.light,
  };
  const dark: Record<string, string> = {
    ...SEED_DARK_COLORS,
    ...generated?.dark,
  };
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
  const touchCssVars: ResolvedThemeSnapshot["touchCssVars"] = [];
  const both = (name: string, value: string) => {
    put(name, value, false);
    put(name, value, true);
  };
  // 두 축의 사다리 (ADR-302 Phase 3) — 생성 축은 생성 사다리, 기본 축 · 로드 전은 seed 사다리 (역할 값과 같은 출처)
  const ladderOf = { accent: "--tint", tone: "--tone" } as const;
  for (const axis of ["accent", "tone"] as const)
    for (const mode of ["light", "dark"] as const) {
      const ladder =
        generated?.ladders[axis][mode] ?? SPECTRUM_DEFAULT_LADDERS[axis][mode];
      for (const [step, hex] of Object.entries(ladder))
        put(`${ladderOf[axis]}-${step}`, hex, mode === "dark", true);
    }
  for (const [key, px] of Object.entries(radius)) {
    if (key === "none" || key === "full") continue;
    both(`--radius-${key}`, `${px}px`);
  }
  for (const [key, px] of Object.entries(border))
    both(`--border-width-${key}`, `${px}px`);

  // ── 명시 델타 ──
  const explicitColorKeys = new Set<string>();
  const explicitTypography: Record<string, number | string> = {};
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
          explicitTypography[key] = value;
        } else if (key === "sans" || key === "mono") {
          if (typeof value === "string") {
            typography[key] = value;
            explicitTypography[key] = value;
          }
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
  // 기존 focus 편집값은 S2 기본 색 역할보다 우선한다. CSS 별칭 emit 순서와 무관하게 유지한다.
  const focusColor = delta["focus.ring-color"]?.value;
  if (typeof focusColor === "string") {
    light["focus-ring"] = focusColor;
    dark["focus-ring"] = focusColor;
  }
  // typography DOM 변수 — 전 키를 싣는다 (ADR-295: seed 가 S2 값이라 `shared-tokens.css` 의 chrome 값과
  //   다르다. 델타만 실으면 Preview · Publish 가 chrome 값을 읽어 Skia 와 갈린다). 크기가 바뀌면 line-height
  //   비율도 같이 다시 낸다.
  // sans seed가 base-font-family 편집을 가리지 않게 한다. 명시한 sans 토큰은 우선한다.
  const sans = String(explicitTypography.sans ?? base.fontFamily);
  typography.sans = sans;
  both("--catalog-default-font-family", DEFAULT_BASE_TYPOGRAPHY.fontFamily);
  both(
    "--font-sans",
    sans === DEFAULT_BASE_TYPOGRAPHY.fontFamily
      ? "var(--catalog-default-font-family)"
      : catalogCssFontFamily(sans),
  );
  for (const [key, value] of Object.entries(typography)) {
    if (typeof value !== "number") continue;
    both(
      `--${key === "text-md" ? "text-base" : key}`,
      toPxOrRatio(key, value, typography),
    );
  }

  // ── 기기 두 벌 (ADR-295 Decision 2 · 6 · 9) ──
  //   생성 CSS 는 사용자 컴포넌트 치수를 `--catalog-token-*` 로 읽는다 (빌더 chrome 의 `--radius-*` ·
  //   `--text-*` 와 다른 이름 공간 — 빌더 문서는 생성 시트를 싣지 않는다, ADR-305). 터치 벌은 S2 의
  //   기기 조건과 Preview 「터치」 보기에서만 이긴다. 수동 시트 (Checkbox · ListBox …) 가 읽는 `--text-*` 도
  //   터치 벌에 같이 싣는다 — Preview · Publish root 의 그 이름은 사용자 컴포넌트 값이다 (Decision 8).
  const device = {
    desktop: {
      ...S2_DEVICE.desktop,
      typography,
      controlHeight: s2ControlHeights(S2_DEVICE.desktop.scale),
    },
    touch: {
      ...S2_DEVICE.touch,
      typography: touchTypography({ ...explicitTypography, sans }),
      controlHeight: s2ControlHeights(S2_DEVICE.touch.scale),
    },
  } satisfies Record<S2Device, ResolvedDeviceTokens>;
  for (const [key, px] of Object.entries(radius))
    put(catalogTokenVarName(`--radius-${key}`), `${px}px`, false);
  for (const [name, tokens] of Object.entries(device) as [
    S2Device,
    ResolvedDeviceTokens,
  ][]) {
    const touch = name === "touch";
    const emit = (cssName: string, value: string) =>
      touch
        ? touchCssVars.push({ name: cssName, value })
        : put(cssName, value, false);
    emit("--catalog-token-scale", String(tokens.scale));
    emit("--catalog-token-font-base", `${tokens.fontBase}px`);
    for (const [size, px] of Object.entries(tokens.controlHeight))
      emit(`--catalog-token-size-height-${size}`, `${px}px`);
    // ADR-295 Phase 3b · 3c-2: the rest of the size map (`{size.icon.<S>}` · `{size.height-sm.<S>}` ·
    //   `{size.field-button.<S>}` · `{size.bar.min-width}`) — `tokenToCSSVar`'s name for each key.
    //   (Phase 3c-3: `{size.device.touch}` is a unitless flag — a relative length's coefficient factor.)
    for (const [key, px] of Object.entries(s2SizeTokens(tokens.scale)))
      if (!key.startsWith("height."))
        emit(
          `--catalog-token-size-${key.replace(/\./g, "-")}`,
          key === "device.touch" ? String(px) : `${px}px`,
        );
    for (const [key, value] of Object.entries(tokens.typography)) {
      if (typeof value !== "number") continue;
      const cssName = `--${key === "text-md" ? "text-base" : key}`;
      const cssValue = toPxOrRatio(key, value, tokens.typography);
      emit(catalogTokenVarName(cssName), cssValue);
      if (touch) emit(cssName, cssValue);
    }
  }

  // 기존 색상 델타는 분리된 역할에도 적용한다. 새 역할을 명시하면 그 값이 우선한다.
  // 기본값은 연결하지 않아 내용·바탕·테두리를 각각 편집하고 복원할 수 있다.
  const legacyColorRoles: Record<string, readonly string[]> = {
    neutral: ["neutral-content", "neutral-fill"],
    "neutral-subtle": ["neutral-surface"],
    border: ["neutral-outline"],
    "accent-hover": ["accent-fill-hover"],
    "accent-content": ["selection-accent"],
    "accent-content-hover": ["selection-accent-hover"],
    negative: ["negative-fill", "selection-negative"],
    "negative-hover": ["negative-fill-hover", "selection-negative-hover"],
  };
  for (const [legacy, roles] of Object.entries(legacyColorRoles)) {
    if (!explicitColorKeys.has(legacy)) continue;
    for (const role of roles) {
      if (explicitColorKeys.has(role)) continue;
      light[role] = light[legacy]!;
      dark[role] = dark[legacy]!;
      explicitColorKeys.add(role);
    }
  }

  // ── 테마 색 전체 → DOM (ADR-293): 최종 맵에서 ──
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
    explicitTypography,
    border,
    shadows: { light: lightShadow, dark: darkShadow },
    base,
    size: s2SizeTokens(S2_DEVICE.desktop.scale),
    device,
    touchCssVars,
    cssVars,
    warnings,
  };
}

/**
 * 터치 벌 글자 — S2 단계식을 터치 기준 글자 (17) 로. 테마가 명시한 글자 크기는 같은 비율로 (사용자가 정한
 * 단계 관계를 유지 — 명시 14 가 터치에서 그대로면 seed 의 base 18 보다 작아진다), 명시 행간 · 글꼴은 그대로.
 */
function touchTypography(
  explicit: Readonly<Record<string, number | string>>,
): Record<string, number | string> {
  const out: Record<string, number | string> = {
    ...(s2TypographyTokens(S2_DEVICE.touch.fontBase) as unknown as Record<
      string,
      number
    >),
  };
  for (const key of Object.keys(SEED_TYPOGRAPHY))
    if (!(key in out)) out[key] = SEED_TYPOGRAPHY[key]!;
  const ratio = S2_DEVICE.touch.fontBase / S2_DEVICE.desktop.fontBase;
  for (const [key, value] of Object.entries(explicit))
    out[key] =
      typeof value === "number" && !key.endsWith("--line-height")
        ? Math.round(value * ratio)
        : value;
  return out;
}

/**
 * Skia 맵을 터치 벌로 — Canvas 는 쓰지 않는다 (사용자 결정 7). G2 하니스의 터치 arm 이 두 leg 를 같은
 * 벌로 맞출 때 쓴다 (`installThemeMaps(touchThemeSnapshot(s))` + DOM `:root[data-catalog-touch]`).
 */
export function touchThemeSnapshot(
  snapshot: ResolvedThemeSnapshot,
): ResolvedThemeSnapshot {
  return {
    ...snapshot,
    typography: snapshot.device.touch.typography,
    size: s2SizeTokens(S2_DEVICE.touch.scale),
  };
}

export { BASE_TYPOGRAPHY_TOKEN_KEYS };

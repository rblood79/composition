/**
 * Token Resolver
 *
 * 토큰 참조를 실제 값으로 변환하는 유틸리티
 *
 * @packageDocumentation
 */

import type { TokenRef } from "../../types/token.types";
import type { ColorValue } from "../../types/shape.types";
import type { ShadowTokenRef } from "../../types/token.types";
import { lightColors, darkColors } from "../../primitives/colors";
import { spacing } from "../../primitives/spacing";
import { typography } from "../../primitives/typography";
import { radius } from "../../primitives/radius";
import { lightShadows, darkShadows } from "../../primitives/shadows";

/**
 * 토큰 참조를 실제 값으로 변환
 */
export function resolveToken(
  ref: TokenRef,
  theme: "light" | "dark" = "light",
): string | number {
  // '{color.accent}' → 'accent'
  const match = ref.match(/^\{(\w+)\.(.+)\}$/);
  if (!match) {
    console.warn(`Invalid token reference: ${ref}`);
    return ref;
  }

  const [, category, name] = match;

  switch (category) {
    case "color":
      return theme === "dark"
        ? darkColors[name as keyof typeof darkColors]
        : lightColors[name as keyof typeof lightColors];
    case "spacing":
      return spacing[name as keyof typeof spacing];
    case "typography":
      return typography[name as keyof typeof typography];
    case "radius":
      return radius[name as keyof typeof radius];
    // ADR-166 Phase 1: shadow 도 color 와 동일하게 theme 분기.
    //   구 flat map 은 CSS 변수(--shadow-* 는 light/dark 값이 다름)와 어긋나
    //   같은 토큰이 CSS 축과 Skia 축에서 서로 다른 값을 의미했다.
    case "shadow":
      return theme === "dark"
        ? darkShadows[name as keyof typeof darkShadows]
        : lightShadows[name as keyof typeof lightShadows];
    default:
      console.warn(`Unknown token category: ${category}`);
      return ref;
  }
}

/**
 * ColorValue를 실제 색상으로 변환
 */
export function resolveColor(
  value: ColorValue,
  theme: "light" | "dark" = "light",
): string | number {
  if (typeof value === "string" && value.startsWith("{")) {
    return resolveToken(value as TokenRef, theme);
  }
  // `var(--accent-subtle)` 류 시맨틱 CSS 변수 문자열 (2026-07-20) — origin props.style
  //   의 backgroundColor 가 var() 리터럴로 Skia fill 에 도달하는 경로 (Selected variant
  //   배선). 역변환 가능한 단순 var() 는 토큰으로 해석해 theme(light/dark) 정합 색을
  //   반환한다. 역변환 불가(복합 표현/미등록 변수)면 기존 동작(문자열 passthrough —
  //   hexStringToNumber 에서 0x000000) 유지.
  if (typeof value === "string" && value.startsWith("var(")) {
    const tokenRef = cssVarToTokenRef(value);
    if (tokenRef) return resolveToken(tokenRef, theme);
  }
  return value;
}

/**
 * S2 색상 토큰 → 시맨틱 CSS 변수 매핑 (ADR-022)
 *
 * Spec 파일의 S2 토큰 이름({color.accent} 등)을
 * 시맨틱 CSS 변수명(--highlight-background 등)으로 변환.
 */
const COLOR_TOKEN_TO_CSS: Record<string, string> = {
  // --- Accent ---
  accent: "var(--accent)",
  "accent-hover": "color-mix(in srgb, var(--accent) 85%, black)",
  "accent-pressed": "color-mix(in srgb, var(--accent) 75%, black)",
  "on-accent": "var(--fg-on-accent)",
  "accent-subtle": "var(--accent-subtle)",

  // --- Neutral ---
  neutral: "var(--fg)",
  "neutral-subdued": "var(--fg-muted)",
  "neutral-subtle": "var(--bg-muted)",
  "neutral-hover": "color-mix(in srgb, var(--bg-muted) 85%, black)",
  "neutral-pressed": "color-mix(in srgb, var(--bg-muted) 75%, black)",

  // --- Negative ---
  negative: "var(--negative)",
  "negative-hover": "color-mix(in srgb, var(--negative) 85%, black)",
  "negative-pressed": "color-mix(in srgb, var(--negative) 75%, black)",
  "on-negative": "var(--color-white)",
  "negative-subtle": "var(--color-error-100)",

  // --- Informative / Positive / Notice ---
  informative: "var(--color-info-600)",
  "informative-subtle": "var(--color-info-100)",
  positive: "var(--color-green-600)",
  "positive-subtle": "var(--color-green-100)",
  notice: "var(--color-warning-600)",
  "notice-subtle": "var(--color-warning-100)",

  // --- Surface / Layer ---
  base: "var(--bg)",
  raised: "var(--bg-raised)",
  "layer-1": "var(--bg-overlay)",
  "layer-2": "var(--bg-inset)",
  elevated: "var(--color-white)",
  disabled: "var(--color-neutral-200)",

  // --- Border ---
  border: "var(--border)",
  "border-hover": "var(--border-hover)",
  "border-disabled": "var(--border-disabled)",

  // --- Special ---
  transparent: "transparent",
  white: "var(--color-white)",
  black: "var(--color-black)",
};

/**
 * Named color → CSS 변수 매핑 (ADR-022)
 * S2에 글로벌 시맨틱이 없는 named color 처리 (기존 tertiary 등)
 */
const NAMED_COLOR_TO_CSS: Record<string, string> = {
  // Purple
  purple: "var(--color-purple-600)",
  "purple-hover": "color-mix(in srgb, var(--color-purple-600) 85%, black)",
  "purple-pressed": "color-mix(in srgb, var(--color-purple-600) 75%, black)",
  "purple-subtle": "var(--color-purple-100)",
  // Gray
  gray: "var(--color-neutral-500)",
  "gray-subtle": "var(--color-neutral-200)",
  // Red
  red: "var(--color-red-600)",
  "red-subtle": "var(--color-red-100)",
  // Orange
  orange: "var(--color-orange-600)",
  "orange-subtle": "var(--color-orange-100)",
  // Yellow
  yellow: "var(--color-yellow-500)",
  "yellow-subtle": "var(--color-yellow-100)",
  // Green (named, not semantic positive)
  "green-named": "var(--color-green-600)",
  "green-named-subtle": "var(--color-green-100)",
  // Blue
  blue: "var(--color-blue-600)",
  "blue-subtle": "var(--color-blue-100)",
  // Indigo
  indigo: "oklch(0.45 0.2 284)",
  "indigo-subtle": "oklch(0.93 0.04 284)",
  // Cyan
  cyan: "oklch(0.5 0.14 220)",
  "cyan-subtle": "oklch(0.93 0.03 220)",
  // Pink
  pink: "oklch(0.6 0.18 348)",
  "pink-subtle": "oklch(0.93 0.04 348)",
  // Turquoise
  turquoise: "oklch(0.55 0.1 195)",
  "turquoise-subtle": "oklch(0.93 0.02 195)",
  // Fuchsia
  fuchsia: "oklch(0.55 0.22 320)",
  "fuchsia-subtle": "oklch(0.93 0.04 320)",
  // Magenta
  magenta: "oklch(0.55 0.2 335)",
  "magenta-subtle": "oklch(0.93 0.04 335)",
  // Celery
  celery: "oklch(0.62 0.16 130)",
  "celery-subtle": "oklch(0.93 0.04 130)",
  // Chartreuse
  chartreuse: "oklch(0.65 0.18 115)",
  "chartreuse-subtle": "oklch(0.93 0.04 115)",
};

/**
 * CSS 변수명으로 변환
 */
export function tokenToCSSVar(ref: TokenRef): string {
  // ADR-036: number(0 as unknown as TokenRef 패턴) 방어
  if (typeof ref !== "string") return String(ref);
  // '{color.accent}' → 'var(--accent)'
  // '{spacing.md}' → 'var(--spacing-md)'
  const match = ref.match(/^\{(\w+)\.(.+)\}$/);
  if (!match) return ref;

  const [, category, name] = match;

  switch (category) {
    case "color": {
      const mapped = COLOR_TOKEN_TO_CSS[name] ?? NAMED_COLOR_TO_CSS[name];
      return mapped ?? `var(--${name})`;
    }
    case "spacing":
      return `var(--spacing-${name})`;
    case "typography":
      // text-md → text-base (CSS 변수에 --text-md 없음, --text-base만 정의됨)
      return `var(--${name === "text-md" ? "text-base" : name})`;
    case "radius":
      return `var(--radius-${name})`;
    case "shadow":
      return `var(--shadow-${name})`;
    default:
      return `var(--${name})`;
  }
}

/**
 * ADR-082 P1: CSS var 문자열 → TokenRef 역변환.
 *
 * `tokenToCSSVar()` 의 역함수. Composite Spec 의 `composition.gap = "var(--spacing-xs)"`
 * 같은 CSS string 값을 TokenRef 로 변환하여 `resolveToken()` 소비 가능하게 함.
 * Style Panel consumer (specPresetResolver) 가 Composite Spec 의 composition.* 를
 * fallback chain 으로 참조할 때 진입점.
 *
 * 규칙:
 * - spacing/radius/shadow: `var(--{category}-{name})` → `{${category}.${name}}`
 * - typography: `var(--text-base)` → `{typography.text-base}` (text-md 는 tokenToCSSVar 에서
 *   text-base 로 매핑되므로 text-md 역변환 불필요, text-base 우선 반환)
 * - color: `COLOR_TOKEN_TO_CSS` / `NAMED_COLOR_TO_CSS` 역방향 lookup. `color-mix(...)` 등
 *   복합 표현은 역변환 대상 아님 (단순 `var(--xxx)` 만 지원)
 * - 미등록 var: `null` 반환 (silent fail, dev warn 은 consumer 측 책임)
 *
 * @see tokenToCSSVar (생성 방향)
 * @see cssVarToTokenRef.test.ts (왕복 검증)
 */
export function cssVarToTokenRef(cssVar: string): TokenRef | null {
  if (typeof cssVar !== "string") return null;
  const match = cssVar.match(/^var\(--([a-z][a-z0-9-]*)\)$/);
  if (!match) return null;
  const name = match[1];

  // Non-color category: prefix 기반 단순 역변환
  if (name.startsWith("spacing-"))
    return `{spacing.${name.slice(8)}}` as TokenRef;
  if (name.startsWith("radius-"))
    return `{radius.${name.slice(7)}}` as TokenRef;
  if (name.startsWith("shadow-"))
    return `{shadow.${name.slice(7)}}` as TokenRef;
  // typography: text-2xs / text-xs / text-sm / text-base / text-lg / ... / text-Nxl--line-height
  if (name.startsWith("text-")) return `{typography.${name}}` as TokenRef;

  // Color: 역방향 Map lookup (단순 `var(--xxx)` 형식만. color-mix 등 복합 표현 미지원)
  const colorName = reverseLookupColorVar(cssVar);
  if (colorName) return `{color.${colorName}}` as TokenRef;

  return null;
}

/**
 * Lazy-built reverse map for `COLOR_TOKEN_TO_CSS` + `NAMED_COLOR_TO_CSS`.
 * color-mix(...) / oklch(...) 등 복합 표현은 역변환 불가 → 단순 var(--xxx) 값만 인덱싱.
 */
let _colorReverseMap: Map<string, string> | null = null;

function reverseLookupColorVar(cssVar: string): string | null {
  if (!_colorReverseMap) {
    _colorReverseMap = new Map();
    const ingest = (src: Record<string, string>) => {
      for (const [name, val] of Object.entries(src)) {
        // 단순 var(--xxx) 형식만 역인덱스 대상
        if (
          /^var\(--[a-z][a-z0-9-]*\)$/.test(val) &&
          !_colorReverseMap!.has(val)
        ) {
          _colorReverseMap!.set(val, name);
        }
      }
    };
    ingest(COLOR_TOKEN_TO_CSS);
    ingest(NAMED_COLOR_TO_CSS);
  }
  return _colorReverseMap.get(cssVar) ?? null;
}

/**
 * 그림자 토큰 참조를 실제 값으로 변환
 */
export function resolveBoxShadow(
  value: string | ShadowTokenRef,
  theme: "light" | "dark" = "light",
): string {
  // 토큰 참조인 경우 (예: '{shadow.md}')
  if (typeof value === "string" && value.startsWith("{shadow.")) {
    return resolveToken(value as TokenRef, theme) as string;
  }
  // 직접 값인 경우
  return value;
}

/**
 * Focus Ring Token (ADR-061)
 *
 * Spec의 `states.focusVisible.focusRing` TokenRef를 CSS outline/offset 쌍으로 변환.
 *
 * - `{focus.ring.default}` → 기본 외부 focus ring (2px solid accent, offset 2px)
 * - `{focus.ring.inset}` → 컨테이너 내부 focus ring (offset 음수)
 *
 * 색상은 기존 `--focus-ring` CSS 변수를 재사용 (preview/builder system의 semantic token).
 * width/offset은 `--focus-ring-width`, `--focus-ring-offset` 변수에서 파생.
 */
const FOCUS_RING_TOKENS: Record<string, { outline: string; offset: string }> = {
  "focus.ring.default": {
    outline: "var(--focus-ring-width) solid var(--focus-ring)",
    offset: "var(--focus-ring-offset)",
  },
  "focus.ring.inset": {
    outline: "var(--focus-ring-width) solid var(--focus-ring)",
    offset: "var(--focus-ring-inset-offset)",
  },
};

export type FocusRingTokenRef = "{focus.ring.default}" | "{focus.ring.inset}";

export function isFocusRingTokenRef(ref: string): ref is FocusRingTokenRef {
  return ref === "{focus.ring.default}" || ref === "{focus.ring.inset}";
}

export function resolveFocusRingToken(ref: TokenRef): {
  outline: string;
  outlineOffset: string;
} {
  const key = ref.replace(/^\{|\}$/g, "");
  const token = FOCUS_RING_TOKENS[key];
  if (!token) {
    throw new Error(`Unknown focus ring token: ${ref}`);
  }
  return { outline: token.outline, outlineOffset: token.offset };
}

/**
 * hex 문자열을 숫자로 변환
 */
export function hexStringToNumber(hex: string): number {
  if (hex.startsWith("#")) {
    return parseInt(hex.slice(1), 16);
  }
  if (hex.startsWith("0x")) {
    return parseInt(hex, 16);
  }
  // rgb() 등 다른 형식은 colord로 처리 필요
  return 0x000000;
}

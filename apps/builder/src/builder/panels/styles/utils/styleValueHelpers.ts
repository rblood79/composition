/**
 * 스타일 값 변환 헬퍼 — use*Values 훅 공용
 */

import {
  cssVarToTokenRef,
  resolveToken,
  type TokenRef,
} from "@composition/specs";
import {
  resolveAccentColorTokens,
  type AccentColorTokens,
  type TintPreset,
} from "../../../../utils/theme/tintToSkiaColors";

const ACCENT_TOKEN_KEYS: Readonly<
  Record<string, keyof AccentColorTokens | undefined>
> = {
  "{color.accent}": "accent",
  "{color.accent-hover}": "accent-hover",
  "{color.accent-pressed}": "accent-pressed",
  "{color.on-accent}": "on-accent",
  "{color.accent-subtle}": "accent-subtle",
};

function toTokenRef(value: string): TokenRef | null {
  if (/^\{[a-z]+\.[^}]+\}$/.test(value)) return value as TokenRef;
  return cssVarToTokenRef(value);
}

function toPickerCompatibleColor(value: string): string {
  return value.trim().toLowerCase() === "transparent" ? "#00000000" : value;
}

/**
 * catalog preset의 CSS var를 ColorPicker가 소비 가능한 현재 Skia theme 색상으로 해석한다.
 * CSS keyword `transparent`는 React Aria parseColor 경계에서 보존 가능한 hex8로 정규화하고,
 * 그 밖의 inline hex/rgb 등 이미 파싱 가능한 CSS 색상은 그대로 보존한다.
 */
export function resolveStylePanelColor(
  value: string,
  theme: "light" | "dark",
  accentColor?: TintPreset,
): string {
  const token = toTokenRef(value);
  if (!token) return toPickerCompatibleColor(value);

  const accentKey = ACCENT_TOKEN_KEYS[token];
  if (accentKey) {
    const accentTokens = resolveAccentColorTokens(accentColor, theme);
    if (accentTokens) return accentTokens[accentKey];
  }

  const resolved = resolveToken(token, theme);
  return typeof resolved === "string"
    ? toPickerCompatibleColor(resolved)
    : value;
}

export function numToPx(n: number | string | undefined): string | undefined {
  if (n === undefined) return undefined;
  if (typeof n === "string") return n;
  return `${n}px`;
}

export function firstDefined(
  inline: unknown,
  specPx: string | undefined,
  fallback: string,
): string {
  if (inline !== undefined && inline !== null && inline !== "") {
    return String(inline);
  }
  if (specPx !== undefined) return specPx;
  return fallback;
}

/**
 * ADR-082 P1-2: 4-way 값이 균일하면 그 값, 아니면 undefined.
 *
 * collapsed shorthand 입력(Padding/Margin 단일 입력)에 Spec 기본값 4-way 를
 * 녹여넣기 위한 헬퍼. 4 인자 중 하나라도 undefined 이거나 값이 다르면 undefined
 * 반환 — `firstDefined` 의 두 번째 인자로 연결되어 fallback 기본값 경로 유지.
 */
export function uniform4Way<T>(
  a: T | undefined,
  b: T | undefined,
  c: T | undefined,
  d: T | undefined,
): T | undefined {
  if (
    a === undefined ||
    b === undefined ||
    c === undefined ||
    d === undefined
  ) {
    return undefined;
  }
  if (a === b && b === c && c === d) return a;
  return undefined;
}

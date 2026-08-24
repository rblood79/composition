/**
 * 스타일 값 변환 헬퍼 — use*Values 훅 공용
 */

import { cssVarToTokenRef, resolveToken } from "@composition/specs";

/**
 * catalog preset의 CSS var를 ColorPicker가 소비 가능한 현재 Skia theme 색상으로 해석한다.
 * inline hex/rgb/transparent 등 이미 파싱 가능한 CSS 색상은 그대로 보존한다.
 */
export function resolveStylePanelColor(
  value: string,
  theme: "light" | "dark",
): string {
  const token = cssVarToTokenRef(value);
  if (!token) return value;
  const resolved = resolveToken(token, theme);
  return typeof resolved === "string" ? resolved : value;
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

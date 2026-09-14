/**
 * ADR-219 — Border 기하 채널 판독 helper (per-corner radius · per-side width)
 *
 * `props.style` 의 border 축 키 10개 (shorthand 2 + CSS longhand 8) 를 **한 곳에서만**
 * 읽는다. Skia converter · Styles 패널 · Modified · reset 기준선이 이 함수를 공유하고,
 * 레이아웃 `parseBorder` (`layout/engines/utils.ts`) 는 이미 같은 우선순위라 동치
 * 테스트로 묶는다. 이 파일 밖에서 `style.borderTopLeftRadius` 같은 longhand 를 직접
 * 읽는 코드는 정적 가드 (`borderGeometry.static.test.ts`) 가 막는다.
 *
 * 우선순위 (축별): longhand ?? shorthand 다중값 ?? shorthand 단일 ?? 카탈로그 base ?? 0.
 * 반경은 원형만 — `"8px / 4px"` 타원 표기는 `/` 앞 (가로 반경) 만 읽는다.
 *
 * 코너 반경 축소는 CSS Backgrounds 3 §4.5 (`resolveCssCornerRadii`) — 기존
 * `clampCornerRadii` (코너별 `min(w,h)/2`) 는 100×100 `[80,0,0,0]` 을 50 으로 잘라
 * Chrome (80 유지) 과 달랐다. 균일 반경에서는 두 규칙이 같은 값이다.
 */

import { resolveCSSSizeValue } from "../layout/engines/cssValueParser";
import { parseBorderShorthand } from "../layout/engines/cssValueParser";
import { getRootComputedStyle } from "../layout/engines/cssResolver";

/** `[topLeft, topRight, bottomRight, bottomLeft]` — CSS `border-radius` 4값 순서 */
export type CornerRadii = [number, number, number, number];
/** `[top, right, bottom, left]` — CSS 변 순서 */
export type SideWidths = [number, number, number, number];

export const BORDER_RADIUS_LONGHANDS = [
  "borderTopLeftRadius",
  "borderTopRightRadius",
  "borderBottomRightRadius",
  "borderBottomLeftRadius",
] as const;

export const BORDER_WIDTH_LONGHANDS = [
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
] as const;

/** 반경 축 키 5 (shorthand 1 + longhand 4) */
export const BORDER_RADIUS_AXIS_KEYS = [
  "borderRadius",
  ...BORDER_RADIUS_LONGHANDS,
] as const;

/** 폭 축 키 5 (shorthand 1 + longhand 4) */
export const BORDER_WIDTH_AXIS_KEYS = [
  "borderWidth",
  ...BORDER_WIDTH_LONGHANDS,
] as const;

/** border 기하 축 키 10 — store 배치 연산 (P3) 이 항목별이 아니라 묶어서 처리하는 집합 */
export const BORDER_GEOMETRY_KEYS: ReadonlySet<string> = new Set([
  ...BORDER_RADIUS_AXIS_KEYS,
  ...BORDER_WIDTH_AXIS_KEYS,
]);

export function isBorderGeometryProp(prop: string): boolean {
  return BORDER_GEOMETRY_KEYS.has(prop);
}

export interface BorderGeometry {
  radii: CornerRadii;
  widths: SideWidths;
  /** 네 코너가 같으면 그 값, 아니면 null */
  uniformRadius: number | null;
  /** 네 변이 같으면 그 값, 아니면 null */
  uniformWidth: number | null;
  /** longhand 가 하나라도 있었는가 (저장 형태 진단용) */
  hasRadiusLonghand: boolean;
  hasWidthLonghand: boolean;
}

/** 카탈로그 base (`ComponentRuleSize.borderRadius/borderWidth`) — 단일값 */
export interface BorderGeometryBase {
  borderRadius?: number | string | null;
  borderWidth?: number | string | null;
}

type StyleLike = Record<string, unknown> | undefined | null;

/** px/number/rem 등 길이 하나 — 없거나 못 읽으면 undefined (다음 우선순위로) */
function readLength(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return undefined;
  const n = resolveCSSSizeValue(value, {
    rootFontSize: getRootComputedStyle().fontSize,
  });
  return n === undefined || !Number.isFinite(n) ? undefined : n;
}

/** 0 이상으로 (반경·폭은 음수가 없다) */
const nonNegative = (n: number): number => (n > 0 ? n : 0);

/** CSS 1~4값 shorthand → 4값 (반경은 tl tr br bl, 폭은 t r b l — 같은 전개 규칙) */
function expandShorthand(value: unknown): CornerRadii | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number") {
    const n = nonNegative(Number.isFinite(value) ? value : 0);
    return [n, n, n, n];
  }
  if (typeof value !== "string") return undefined;
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return undefined;
  const values = parts.map((p) => nonNegative(readLength(p) ?? 0));
  const [a, b, c, d] = values;
  if (values.length === 1) return [a, a, a, a];
  if (values.length === 2) return [a, b, a, b];
  if (values.length === 3) return [a, b, c, b];
  return [a, b, c, d];
}

/** 반경 shorthand — `/` 뒤 (세로 반경) 는 버린다 (원형만) */
function expandRadiusShorthand(value: unknown): CornerRadii | undefined {
  if (typeof value === "string" && value.includes("/")) {
    return expandShorthand(value.split("/")[0]);
  }
  return expandShorthand(value);
}

function resolveAxis(
  style: StyleLike,
  longhands: readonly [string, string, string, string],
  shorthand: CornerRadii | undefined,
  base: number,
): { values: CornerRadii; hasLonghand: boolean } {
  const values: CornerRadii = [base, base, base, base];
  if (shorthand) {
    values[0] = shorthand[0];
    values[1] = shorthand[1];
    values[2] = shorthand[2];
    values[3] = shorthand[3];
  }
  let hasLonghand = false;
  if (style) {
    for (let i = 0; i < 4; i++) {
      const v = readLength(style[longhands[i]]);
      if (v !== undefined) {
        values[i] = nonNegative(v);
        hasLonghand = true;
      }
    }
  }
  return { values, hasLonghand };
}

function uniformOf(values: CornerRadii): number | null {
  return values[0] === values[1] &&
    values[1] === values[2] &&
    values[2] === values[3]
    ? values[0]
    : null;
}

/**
 * 유효 border 기하 — 저장 형태 (shorthand/longhand) 와 무관하게 4값 두 벌.
 *
 * `base` 는 카탈로그 base (`resolveMergedStyle(node).base`) 의 단일값이며, 어느 층에도
 * 값이 없을 때만 쓰인다. 폭은 `border: "1px solid red"` 단축도 마지막 폴백으로 읽는다
 * (레이아웃 `parseBorder` 와 같은 우선순위).
 */
export function resolveBorderGeometry(
  style: StyleLike,
  base?: BorderGeometryBase | null,
): BorderGeometry {
  const baseRadius = nonNegative(readLength(base?.borderRadius) ?? 0);
  const baseWidth = nonNegative(readLength(base?.borderWidth) ?? 0);

  const radius = resolveAxis(
    style,
    BORDER_RADIUS_LONGHANDS,
    expandRadiusShorthand(style?.borderRadius),
    baseRadius,
  );

  let widthShorthand = expandShorthand(style?.borderWidth);
  if (!widthShorthand && style?.border !== undefined) {
    const parsed = parseBorderShorthand(style.border);
    if (parsed && parsed.width !== undefined) {
      const w = nonNegative(parsed.width);
      widthShorthand = [w, w, w, w];
    }
  }
  const width = resolveAxis(
    style,
    BORDER_WIDTH_LONGHANDS,
    widthShorthand,
    baseWidth,
  );

  return {
    radii: radius.values,
    widths: width.values,
    uniformRadius: uniformOf(radius.values),
    uniformWidth: uniformOf(width.values),
    hasRadiusLonghand: radius.hasLonghand,
    hasWidthLonghand: width.hasLonghand,
  };
}

/**
 * CSS Backgrounds 3 §4.5 corner-overlap — 변마다 `f = L / (r_a + r_b)` (그 변에 붙은
 * 두 코너 반경 합), `min(1, f_top, f_right, f_bottom, f_left)` 를 **모든 반경에** 곱한다.
 *
 * - 100×100 `[80,0,0,0]` → f = 1 → 80 유지 (코너별 clamp 는 50)
 * - 100×100 `[80,80,0,0]` → f = 100/160 → `[50,50,0,0]`
 * - 균일 r → f = min(w,h)/2r → `min(w,h)/2` 상한 — 기존 clamp 와 같은 값
 */
export function resolveCssCornerRadii(
  radii: readonly [number, number, number, number],
  width: number,
  height: number,
): CornerRadii {
  const tl = nonNegative(radii[0]);
  const tr = nonNegative(radii[1]);
  const br = nonNegative(radii[2]);
  const bl = nonNegative(radii[3]);
  if (width <= 0 || height <= 0) return [0, 0, 0, 0];
  // 합이 0 인 변은 Infinity → min 에서 무시된다
  const f = Math.min(
    1,
    width / (tl + tr),
    width / (bl + br),
    height / (tl + bl),
    height / (tr + br),
  );
  return [tl * f, tr * f, br * f, bl * f];
}

/**
 * 안쪽 (padding box) 코너 반경 — 코너의 **가로 반경은 인접 세로변 폭**, **세로 반경은
 * 인접 가로변 폭** 을 뺀다 (TL: `rx = r − left`, `ry = r − top`). Blink
 * `BoxBorderPainter` / CSS Backgrounds §4.2 와 같은 기하. 폭 0 인 변에 붙은 코너는
 * 그 축 반경이 그대로라 띠가 호를 따라 가늘어진다 (변 마스크의 CSS 모양).
 *
 * `radii` 는 이미 `resolveCssCornerRadii` 를 거친 바깥 반경이어야 한다.
 */
export function resolveInnerCornerRadii(
  radii: readonly [number, number, number, number],
  widths: readonly [number, number, number, number],
): { rx: CornerRadii; ry: CornerRadii } {
  const [t, r, b, l] = widths;
  return {
    rx: [
      nonNegative(radii[0] - l),
      nonNegative(radii[1] - r),
      nonNegative(radii[2] - r),
      nonNegative(radii[3] - l),
    ],
    ry: [
      nonNegative(radii[0] - t),
      nonNegative(radii[1] - t),
      nonNegative(radii[2] - b),
      nonNegative(radii[3] - b),
    ],
  };
}

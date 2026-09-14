/**
 * 공유 보간 유틸리티.
 * TransitionManager와 AnimationEngine이 속성별 보간에 사용.
 */

/** 숫자 선형 보간 */
export function lerpNumber(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** sRGB 색상 component-wise 보간. Float32Array [r,g,b,a] 0-1 */
export function lerpColor(
  a: Float32Array,
  b: Float32Array,
  t: number,
  out?: Float32Array,
): Float32Array {
  const result = out ?? new Float32Array(4);
  result[0] = a[0] + (b[0] - a[0]) * t;
  result[1] = a[1] + (b[1] - a[1]) * t;
  result[2] = a[2] + (b[2] - a[2]) * t;
  result[3] = a[3] + (b[3] - a[3]) * t;
  return result;
}

/** transform 분해 보간 */
export interface DecomposedTransform {
  translateX: number;
  translateY: number;
  scaleX: number;
  scaleY: number;
  rotate: number;
}

export function lerpTransform(
  a: DecomposedTransform,
  b: DecomposedTransform,
  t: number,
): DecomposedTransform {
  return {
    translateX: lerpNumber(a.translateX, b.translateX, t),
    translateY: lerpNumber(a.translateY, b.translateY, t),
    scaleX: lerpNumber(a.scaleX, b.scaleX, t),
    scaleY: lerpNumber(a.scaleY, b.scaleY, t),
    rotate: lerpNumber(a.rotate, b.rotate, t),
  };
}

/** box-shadow 보간 */
export interface ShadowValues {
  dx: number;
  dy: number;
  sigmaX: number;
  sigmaY: number;
  spread: number;
  color: Float32Array;
}

export function lerpBoxShadow(
  a: ShadowValues,
  b: ShadowValues,
  t: number,
): ShadowValues {
  return {
    dx: lerpNumber(a.dx, b.dx, t),
    dy: lerpNumber(a.dy, b.dy, t),
    sigmaX: lerpNumber(a.sigmaX, b.sigmaX, t),
    sigmaY: lerpNumber(a.sigmaY, b.sigmaY, t),
    spread: lerpNumber(a.spread, b.spread, t),
    color: lerpColor(a.color, b.color, t),
  };
}

/**
 * 숫자 보간 가능한 CSS 속성 (SSOT).
 * StoreRenderBridge의 transition 감지 + interpolateProperty 양쪽에서 참조.
 */
export const ANIMATABLE_NUMERIC_PROPERTIES = new Set([
  "opacity",
  "width",
  "height",
  "borderRadius",
  // ADR-219 — 코너 · 변 longhand 8 (transition 감지)
  "borderTopLeftRadius",
  "borderTopRightRadius",
  "borderBottomRightRadius",
  "borderBottomLeftRadius",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "padding",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "margin",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "gap",
  "columnGap",
  "rowGap",
  "fontSize",
  "letterSpacing",
  "lineHeight",
  "top",
  "right",
  "bottom",
  "left",
  "rotate",
  "scaleX",
  "scaleY",
  "translateX",
  "translateY",
]);

/**
 * CSS 속성에 맞는 보간 함수 자동 선택.
 * 미지원 속성은 discrete (t>=0.5 → end, else start).
 */
export function interpolateProperty(
  prop: string,
  start: unknown,
  end: unknown,
  t: number,
): unknown {
  if (
    ANIMATABLE_NUMERIC_PROPERTIES.has(prop) &&
    typeof start === "number" &&
    typeof end === "number"
  ) {
    return lerpNumber(start, end, t);
  }
  if (
    (prop === "backgroundColor" ||
      prop === "color" ||
      prop === "borderColor") &&
    start instanceof Float32Array &&
    end instanceof Float32Array
  ) {
    return lerpColor(start, end, t);
  }
  return t >= 0.5 ? end : start;
}

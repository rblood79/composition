/**
 * CSS Transitions Engine (ADR-100 Phase 3)
 *
 * 순수 수학: cubic-bezier + easing. Newton-Raphson 방법으로 cubic-bezier 역산.
 */

import { lerpNumber } from "./interpolators";

/**
 * Cubic Bezier easing.
 * CSS cubic-bezier(x1, y1, x2, y2) 구현.
 * Newton-Raphson 방법으로 t에 해당하는 x를 찾고, 대응하는 y를 반환.
 */
export function cubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  t: number,
): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;

  // B(t) = 3(1-t)²t·P1 + 3(1-t)t²·P2 + t³
  // x(u) = 3(1-u)²u·x1 + 3(1-u)u²·x2 + u³
  // Newton-Raphson: u를 찾아 x(u) = t인 u → y(u) 반환

  let u = t; // initial guess
  for (let i = 0; i < 8; i++) {
    const xu = sampleCurve(x1, x2, u) - t;
    if (Math.abs(xu) < 1e-6) break;
    const dxu = sampleCurveDerivative(x1, x2, u);
    if (Math.abs(dxu) < 1e-6) break;
    u -= xu / dxu;
  }

  // Clamp
  u = Math.max(0, Math.min(1, u));
  return sampleCurve(y1, y2, u);
}

function sampleCurve(a: number, b: number, t: number): number {
  // B(t) = 3(1-t)²t·a + 3(1-t)t²·b + t³
  return ((1 - 3 * b + 3 * a) * t + (3 * b - 6 * a)) * t * t + 3 * a * t;
  // Expanded: (1 - 3b + 3a)t³ + (3b - 6a)t² + 3at
}

function sampleCurveDerivative(a: number, b: number, t: number): number {
  return (3 * (1 - 3 * b + 3 * a) * t + 2 * (3 * b - 6 * a)) * t + 3 * a;
}

// ADR-912 후속 cleanup: lerp deprecated alias 제거 — 외부 사용 0건.
//   직접 lerpNumber (interpolators.ts) 사용. 본 파일 L115 에서 live.

/** CSS named easings */
export const EASINGS = {
  linear: (t: number) => t,
  ease: (t: number) => cubicBezier(0.25, 0.1, 0.25, 1.0, t),
  "ease-in": (t: number) => cubicBezier(0.42, 0, 1, 1, t),
  "ease-out": (t: number) => cubicBezier(0, 0, 0.58, 1, t),
  "ease-in-out": (t: number) => cubicBezier(0.42, 0, 0.58, 1, t),
} as const;

export type EasingName = keyof typeof EASINGS;

/**
 * 주어진 CSS easing 이름 또는 cubic-bezier 문자열에서 easing 함수 반환.
 */
export function parseEasing(value: string): (t: number) => number {
  const trimmed = value.trim();

  if (trimmed in EASINGS) {
    return EASINGS[trimmed as EasingName];
  }

  // cubic-bezier(x1, y1, x2, y2)
  const match = trimmed.match(
    /cubic-bezier\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/,
  );
  if (match) {
    const [, x1, y1, x2, y2] = match.map(Number);
    return (t: number) => cubicBezier(x1, y1, x2, y2, t);
  }

  // fallback: linear
  return EASINGS.linear;
}

/**
 * Transition 상태 추적기.
 */
export interface TransitionState {
  property: string;
  startValue: number;
  endValue: number;
  startTime: number;
  duration: number; // ms
  easing: (t: number) => number;
}

/**
 * 현재 시간에서 transition의 보간 값을 계산.
 */
export function computeTransitionValue(
  state: TransitionState,
  currentTime: number,
): { value: number; done: boolean } {
  const elapsed = currentTime - state.startTime;
  if (elapsed <= 0) return { value: state.startValue, done: false };
  if (elapsed >= state.duration) return { value: state.endValue, done: true };

  const progress = elapsed / state.duration;
  const eased = state.easing(progress);
  return {
    value: lerpNumber(state.startValue, state.endValue, eased),
    done: false,
  };
}

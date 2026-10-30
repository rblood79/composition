/**
 * ADR-290 — accent 명도를 목표 대비로 정한다 (순수 · 의존 0).
 *
 * (chroma, hue) 는 그대로 두고 oklch 명도만 움직여, 주어진 바탕들과의 WCAG 2 대비가 조건을
 * 만족하는 명도 중 시작 명도에 가장 가까운 값을 찾는다. Leonardo 의 핵심 계산 (배경 · 목표 대비 →
 * 명도) 과 같다 — 패키지는 쓰지 않는다 (ADR-290 대안 A 기각: 동기 설치 경로 · initial 번들).
 */
import { oklchToHex } from "./oklchToHex";

/** WCAG 2 상대 휘도 — hex6 (`#rrggbb`). hex 가 아니면 NaN. */
export function relativeLuminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return Number.NaN;
  const n = parseInt(m[1]!, 16);
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel((n >> 16) & 0xff) +
    0.7152 * channel((n >> 8) & 0xff) +
    0.0722 * channel(n & 0xff)
  );
}

/** WCAG 2 대비 (1 ~ 21). 어느 쪽이든 hex 가 아니면 NaN. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export interface ContrastConstraint {
  /** 바탕 (hex6). hex 가 아닌 값 (`transparent` · `var(…)`) 은 조건에서 빠진다. */
  against: string;
  min: number;
}

export interface SolvedLightness {
  l: number;
  hex: string;
  /** 모든 조건을 만족했는지 — false 면 글자 조건 (min ≥ 4.5) 만으로 풀었거나 시작 명도 그대로. */
  ok: boolean;
}

const TEXT_MIN = 4.5;
const SCAN_STEP = 0.0025;
const REFINE_STEPS = 12;

function passes(
  hex: string,
  constraints: readonly ContrastConstraint[],
): boolean {
  for (const k of constraints) {
    const r = contrastRatio(hex, k.against);
    if (!Number.isNaN(r) && r < k.min) return false;
  }
  return true;
}

/** 시작 명도에서 가장 가까운 통과 명도 — 없으면 null. 양쪽으로 넓혀 가다 경계를 이분 탐색. */
function nearestPassing(
  c: number,
  h: number,
  startL: number,
  constraints: readonly ContrastConstraint[],
): number | null {
  const ok = (l: number) => passes(oklchToHex(l, c, h), constraints);
  if (ok(startL)) return startL;
  for (let d = SCAN_STEP; d <= 1; d += SCAN_STEP) {
    for (const dir of [-1, 1] as const) {
      const l = startL + dir * d;
      if (l < 0 || l > 1 || !ok(l)) continue;
      // (l - dir·step, l] 사이의 경계를 좁힌다 — 실패 쪽 a, 통과 쪽 b
      let a = l - dir * SCAN_STEP;
      let b = l;
      for (let i = 0; i < REFINE_STEPS; i++) {
        const mid = (a + b) / 2;
        if (ok(mid)) b = mid;
        else a = mid;
      }
      return b;
    }
  }
  return null;
}

/**
 * 조건 전부를 만족하는 명도 중 `startL` 에 가장 가까운 값. 그런 명도가 없으면 글자 조건
 * (min ≥ 4.5) 만으로 다시 풀고 `ok: false`.
 */
export function solveLightness(input: {
  c: number;
  h: number;
  startL: number;
  /** 시작 색 그대로 (사용자 hex) — 통과하면 oklch 왕복 없이 이 hex 를 돌려준다. */
  startHex?: string;
  constraints: readonly ContrastConstraint[];
}): SolvedLightness {
  const { c, h, constraints } = input;
  const startL = Math.min(1, Math.max(0, input.startL));
  if (input.startHex && passes(input.startHex, constraints))
    return { l: startL, hex: input.startHex, ok: true };
  const all = nearestPassing(c, h, startL, constraints);
  if (all !== null) return { l: all, hex: oklchToHex(all, c, h), ok: true };
  const text = constraints.filter((k) => k.min >= TEXT_MIN);
  const textOnly =
    text.length > 0 && text.length < constraints.length
      ? nearestPassing(c, h, startL, text)
      : null;
  const l = textOnly ?? startL;
  return { l, hex: oklchToHex(l, c, h), ok: false };
}

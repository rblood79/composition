/**
 * ADR-306 Phase 6 — 강조 대상 (`highlight`). 식은 ztd-charts 0.5.0 (`3c4376c`, MIT —
 * `src/core/highlight.ts` `resolveHighlight`) 을 옮겼다. composition 의 값은 문자열 목록 하나다 — 모드
 * (`max` · `min` · `first` · `last` · `none`) 또는 항목 이름. ztd 의 판별 함수 · 숫자 인덱스는 문서에
 * 저장할 수 없어 받지 않는다 (같은 일은 이름으로 한다).
 */

export type HighlightFallback = "max" | "min" | "first" | "last" | "none";

const MODES: ReadonlySet<string> = new Set([
  "max",
  "min",
  "first",
  "last",
  "none",
]);

/** 저장된 `highlight` 를 비어 있지 않은 문자열 목록으로 (문자열 하나 · 빈 칸 · 그 밖은 정리). */
export function highlightList(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [];
  return list
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((v) => v !== "");
}

/** `highlight` 가 지정됐는가 (비면 종류의 기본 강조). */
export function hasHighlight(raw: unknown): boolean {
  return highlightList(raw).length > 0;
}

/**
 * 강조할 항목 인덱스. `labels` 는 항목 이름 (이름으로 고를 때), `values` 는 max · min 비교 값. 지정이
 * 없으면 `fallback` (종류마다 ztd 와 같은 기본) 을 쓴다. 같은 이름이 여럿이면 전부.
 */
export function resolveHighlight(
  raw: unknown,
  labels: readonly string[],
  values: readonly number[],
  fallback: HighlightFallback,
): Set<number> {
  const out = new Set<number>();
  const n = labels.length;
  const pick = (mode: string) => {
    if (n === 0 || mode === "none") return;
    if (mode === "first") out.add(0);
    else if (mode === "last") out.add(n - 1);
    else {
      let best = -1;
      let bv = mode === "max" ? -Infinity : Infinity;
      for (let i = 0; i < n; i++) {
        const v = values[i];
        if (!Number.isFinite(v)) continue;
        if (mode === "max" ? v > bv : v < bv) {
          bv = v;
          best = i;
        }
      }
      if (best >= 0) out.add(best);
    }
  };
  const list = highlightList(raw);
  if (list.length === 0) {
    pick(fallback);
    return out;
  }
  for (const item of list) {
    if (MODES.has(item)) pick(item);
    else
      labels.forEach((label, i) => {
        if (label === item) out.add(i);
      });
  }
  return out;
}

/** 강조 하나만 쓰는 자리 (family 의 accent 하나) — 가장 앞 인덱스, 없으면 -1. */
export function firstHighlight(set: ReadonlySet<number>): number {
  let best = -1;
  for (const i of set) if (best < 0 || i < best) best = i;
  return best;
}

/**
 * family 의 강조 하나 — `highlight` 가 비면 지금 고른 것 (`current` — 종류의 기본, 그림 그대로), 지정하면
 * 그 첫 항목 (없으면 −1 = 강조 없음). ztd 의 기본 (`fallback`) 은 이름 · 모드가 섞일 때만 쓰인다.
 */
export function highlightIndex(
  raw: unknown,
  labels: readonly string[],
  values: readonly number[],
  fallback: HighlightFallback,
  current: number,
): number {
  if (!hasHighlight(raw)) return current;
  return firstHighlight(resolveHighlight(raw, labels, values, fallback));
}

/** 강조 집합 — `highlight` 가 비면 null (종류의 기본을 그대로 쓴다). */
export function highlightSet(
  raw: unknown,
  labels: readonly string[],
  values: readonly number[],
  fallback: HighlightFallback,
): Set<number> | null {
  if (!hasHighlight(raw)) return null;
  return resolveHighlight(raw, labels, values, fallback);
}

/**
 * ADR-306 Phase 5 — 산점도 점 크기 반지름 범위 (`sizeRange`). layout (그림 안쪽 여백) 과 보강 마크 builder 가
 * 같이 읽는다.
 */
/** 점 크기 반지름 기본 [작은, 큰] px (ztd 는 상자 폭에 맞춘다 — 여기서는 고정, 패널에서 바꾼다). */
export const SIZE_RANGE_DEFAULT: readonly [number, number] = [3, 18];

export function sizeRangeOf(raw: unknown): [number, number] {
  if (!Array.isArray(raw)) return [...SIZE_RANGE_DEFAULT];
  const nums = raw
    .map((v) => (typeof v === "number" ? v : Number(String(v).trim())))
    .filter((v) => Number.isFinite(v) && v > 0);
  if (nums.length < 2) return [...SIZE_RANGE_DEFAULT];
  const lo = Math.min(nums[0], nums[1]);
  const hi = Math.max(nums[0], nums[1]);
  return [Math.min(lo, 60), Math.min(hi, 80)];
}

/**
 * 그림 크기에 맞춘 반지름 범위 — 큰 반지름은 그림 짧은 변의 1/8 을 넘지 않는다 (ztd 는 폭 / 22 — 작은
 * 칸 (Library 표본 · 카드) 에서 점이 상자를 덮지 않게). 작은 반지름도 그 아래로.
 */
export function fittedSizeRange(
  raw: unknown,
  plotW: number,
  plotH: number,
): [number, number] {
  const [lo, hi] = sizeRangeOf(raw);
  const cap = Math.max(1.5, Math.min(plotW, plotH) / 8);
  const top = Math.min(hi, cap);
  return [Math.min(lo, top), top];
}

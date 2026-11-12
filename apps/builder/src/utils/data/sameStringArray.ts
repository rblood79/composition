/**
 * 두 값이 같은 원소를 같은 순서로 가진 배열인가 (원소는 `===`). 배열이 아니면 참조 비교.
 * Chart patch 의 의미 비교 · 패널 필드 memo 비교가 같이 쓴다.
 */
export function sameStringArray(a: unknown, b: unknown): boolean {
  if (!Array.isArray(a) || !Array.isArray(b)) return a === b;
  return a.length === b.length && a.every((item, i) => item === b[i]);
}

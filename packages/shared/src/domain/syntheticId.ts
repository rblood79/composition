/**
 * instance 안 자식의 synthetic id (`<instance id>/<path>`) 분해 — 구분자를 아는 곳은 여기 하나 (ADR-236 Phase 1).
 *
 * 여기 함수들은 **문자열 형태만** 본다. render projection id (`projection:` prefix · `::page-frame::`
 * infix) 도 `/` 를 품을 수 있어 "이 id 가 synthetic 자식인가" 는 builder
 * `stores/canonical/syntheticDescendantLookup.ts` `isSyntheticDescendantId` 가 판정한다 (projection 제외).
 * 호출처가 projection 을 어떻게 거를지는 각자의 제외 조건으로 남아 있다 — Phase 0 인벤토리 §2.2.
 */

export const SYNTHETIC_ID_SEPARATOR = "/";

/** id 에 synthetic 경로 구분자가 있는가 (projection 여부는 보지 않는다). */
export function hasSyntheticIdPath(id: string): boolean {
  return id.includes(SYNTHETIC_ID_SEPARATOR);
}

/** `<root>/<path>` 를 첫 구분자에서 나눈다. 구분자가 없거나 맨 앞이면 null. */
export function splitSyntheticId(
  id: string,
): { rootId: string; pathKey: string } | null {
  const separator = id.indexOf(SYNTHETIC_ID_SEPARATOR);
  if (separator <= 0) return null;
  return { rootId: id.slice(0, separator), pathKey: id.slice(separator + 1) };
}

/** `a/b/c` → `["a/b", "a"]` — 가까운 조상부터. 구분자가 없으면 빈 배열. */
export function getSyntheticAncestorIds(id: string): string[] {
  const segments = id.split(SYNTHETIC_ID_SEPARATOR);
  const ancestors: string[] = [];
  while (segments.length > 1) {
    segments.pop();
    ancestors.push(segments.join(SYNTHETIC_ID_SEPARATOR));
  }
  return ancestors;
}

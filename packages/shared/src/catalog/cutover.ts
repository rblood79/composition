/**
 * ADR-142 — catalog cutover 상태 SSOT.
 *
 * 이 집합에 든 component type 은 catalog generic 경로(Preview 렌더 + Inspector 편집)로
 * 전환된 것으로 간주한다. family cutover(Phase 6) 가 family 단위로 type 을 추가한다.
 *
 * **현재 비어있음** → 모든 type 이 legacy 경로(rendererMap / spec.properties.sections)를
 * 유지 (live 회귀 0, G2 fallback 규율). cutover 게이트의 단일 진입점.
 */
const CUTOVER_TYPES: ReadonlySet<string> = new Set<string>();

export function isCatalogCutover(type: string): boolean {
  return CUTOVER_TYPES.has(type);
}

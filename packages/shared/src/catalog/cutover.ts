/**
 * ADR-142 — catalog cutover 게이트.
 *
 * 이 집합에 든 component type 은 catalog generic 경로(Preview 렌더 + Skia + Inspector 편집)로
 * 전환된 것으로 간주한다. **단일 SSOT 는 `componentCatalog`** — 게이트는 catalog 의
 * `cutover === "catalog"` entry 에서 파생된다. family flip(Phase 6) 은 componentCatalog 의
 * 해당 family entry `cutover` 를 `"catalog"` 로 바꾸는 것으로 발효(불변식 D atomic).
 *
 * componentCatalog 는 모듈 상수라 파생 Set 을 모듈 로드 시 1회 계산한다.
 */
import { getCatalogCutoverTypes } from "./componentCatalog";

const CUTOVER_TYPES: ReadonlySet<string> = getCatalogCutoverTypes();

export function isCatalogCutover(type: string): boolean {
  return CUTOVER_TYPES.has(type);
}

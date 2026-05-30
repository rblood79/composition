/**
 * ADR-142 — catalog cutover 게이트.
 *
 * 이 집합에 든 component type 은 catalog generic 경로(Preview 렌더 + Inspector 편집)로
 * 전환된 것으로 간주한다. **단일 SSOT 는 `componentCatalog`** — 게이트는 catalog 의
 * `cutover === "catalog"` entry 에서 파생된다. family flip(Phase 6) 은 componentCatalog 의
 * 해당 family entry `cutover` 를 `"catalog"` 로 바꾸는 것으로 발효.
 *
 * **채널 분리 (ADR-142 family ④/⑤ DOM-only cutover)**:
 * - `isCatalogCutover` — DOM(Preview)/Inspector 게이트. cutover==="catalog" 전부.
 * - `isCatalogSkiaCutover` — Skia generic 렌더 게이트. cutover==="catalog" && !skiaLegacy.
 *   collection(skiaLegacy:true)은 Skia 만 legacy render.shapes 유지(items 순회 렌더) →
 *   DOM 은 RAC items 자동 합성으로 generic 발효, Skia 는 부분 cutover.
 *
 * componentCatalog 는 모듈 상수라 파생 Set 을 모듈 로드 시 1회 계산한다.
 */
import {
  getCatalogCutoverTypes,
  getCatalogSkiaCutoverTypes,
} from "./componentCatalog";

const CUTOVER_TYPES: ReadonlySet<string> = getCatalogCutoverTypes();
const SKIA_CUTOVER_TYPES: ReadonlySet<string> = getCatalogSkiaCutoverTypes();

/** DOM(Preview)/Inspector catalog generic 경로 발효 여부. */
export function isCatalogCutover(type: string): boolean {
  return CUTOVER_TYPES.has(type);
}

/**
 * Skia generic 렌더(buildCatalogShapes) 발효 여부. collection(skiaLegacy)은 false →
 * Skia 만 legacy render.shapes 유지. DOM/Inspector 는 `isCatalogCutover` 로 catalog.
 */
export function isCatalogSkiaCutover(type: string): boolean {
  return SKIA_CUTOVER_TYPES.has(type);
}

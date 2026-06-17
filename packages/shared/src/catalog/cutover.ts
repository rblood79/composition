/**
 * ADR-142 — catalog cutover 게이트.
 *
 * 이 집합에 든 component type 은 catalog generic 경로(Preview 렌더 + Inspector 편집)로
 * 전환된 것으로 간주한다. **단일 SSOT 는 `componentCatalog`** — 게이트는 catalog 의
 * `cutover === "catalog"` entry 에서 파생된다. family flip(Phase 6) 은 componentCatalog 의
 * 해당 family entry `cutover` 를 `"catalog"` 로 바꾸는 것으로 발효.
 *
 * **ADR-912 단계 5 step 1 (2026-06-04) — 채널 통합 (dead gate 제거)**:
 * 단계 5 (1b) 에서 skiaLegacy 0건 도달 → Skia generic 렌더가 전 catalog entry 발효.
 * DOM/Skia 채널이 더 이상 갈리지 않으므로 `isCatalogCutover` 단일 게이트만 의미가 있다.
 *
 * **ADR-912 P1-B (2026-06-17) — deprecated 게이트 삭제 완료**: 과거 Skia 전용
 * `isCatalogSkiaCutover` / `getCatalogSkiaCutoverTypes` 는 `isCatalogCutover` 위임으로
 * collapse 됐고, 호출처(소스 5 + 테스트 10)를 단일 게이트로 정리한 뒤 본 step 에서 삭제.
 *
 * componentCatalog 는 모듈 상수라 파생 Set 을 모듈 로드 시 1회 계산한다.
 */
import { getCatalogCutoverTypes } from "./componentCatalog";

const CUTOVER_TYPES: ReadonlySet<string> = getCatalogCutoverTypes();

/** DOM(Preview)/Inspector/Skia catalog generic 경로 발효 여부 (단일 게이트). */
export function isCatalogCutover(type: string): boolean {
  return CUTOVER_TYPES.has(type);
}

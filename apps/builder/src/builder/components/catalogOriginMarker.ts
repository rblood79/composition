/**
 * catalog origin 노드의 `metadata.type` 표식 — 의존 0 leaf. `stateVariantOrigins` (Preview resolver 가 읽는다) 가
 * 이 값만 쓰는데 `catalogOrigins` 에서 가져오면 factory 정의 전체가 Preview initial 에 실린다 (2026-09-25 실측).
 */
export const CATALOG_ORIGIN_METADATA_TYPE = "catalog-origin";

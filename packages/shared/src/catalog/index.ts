/**
 * ADR-142 — catalog 공개 surface.
 * `PrimitiveBinding` / `PropContract` / `ComponentCatalogEntry` 타입 +
 * `componentCatalog` 등록 SSOT + `toRacProps` 투영기.
 */
export * from "./types";
export * from "./cutover";
export * from "./componentCatalog";
export * from "./outputs/toRacProps";
export * from "./outputs/inspectorFields";
export * from "./bindings";
// ADR-142 G2(b) B — 컴포넌트 시각 규칙 resolver (build-time 생성 테이블 소비, spec 참조 0)
export * from "./resolvers/resolveComponentRule";

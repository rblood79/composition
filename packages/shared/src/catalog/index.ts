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
// ADR-912 1A-(b) — DOM 시각 override 어댑터 (override 전용)
export * from "./outputs/toReactStyle";
// ADR-912 1A-(c) — Skia 시각 어댑터 (base⊕override ⊕ token 해소, 같은 resolveMergedStyle 코어)
export * from "./outputs/toSkiaStyle";
export * from "./bindings";
// ADR-142 G2(b) B — 컴포넌트 시각 규칙 resolver (build-time 생성 테이블 소비, spec 참조 0)
export * from "./resolvers/resolveComponentRule";
// ADR-912 1A-(b) — base/override 2층 분리 코어 (HC#3)
export * from "./resolvers/resolveMergedStyle";
// ADR-912 1A-(4) — 편집 계약 단일 진입점 (semantic ∪ universal style, origin 태그, HC#1/#2)
export * from "./resolvers/resolveEditContract";

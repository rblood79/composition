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

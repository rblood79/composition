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
// ADR-148 Phase 0 — slotRole 공용 vocabulary + slot 구성 resolver (설계도 §2-1)
export * from "./slotRoles";
// ADR-148 Phase 2 — reusable 템플릿 바인딩 `{키}` 치환 엔진 (propsSchema gate)
export * from "./templateBinding";
// ADR-142 G2(b) B — 컴포넌트 시각 규칙 resolver (build-time 생성 테이블 소비, spec 참조 0)
export * from "./resolvers/resolveComponentRule";
// 트리거 아이콘 glyph 크기 — DOM wrapper 와 Skia icon_font 가 공유하는 단일 SSOT
export * from "./resolvers/resolveTriggerIconSize";
// ADR-912 catalog SSOT collapse — 컨테이너 base/variant/structure/size-value 단일 진입 (specs import 0)
export * from "./resolvers/resolveCatalogContainer";
// ADR-912 1A-(b) — base/override 2층 분리 코어 (HC#3)
export * from "./resolvers/resolveMergedStyle";
// ADR-912 1A-(4) — 편집 계약 단일 진입점 (semantic ∪ universal style, origin 태그, HC#1/#2)
export * from "./resolvers/resolveEditContract";

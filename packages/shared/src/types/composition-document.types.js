/**
 * @fileoverview Canonical Document Types — ADR-903 P0 + ADR-116 G1
 *
 * **scope 분리 (R5)**:
 * - `CanonicalNode.type` (ComponentTag, 121-literal) — composition component / pencil 구조 타입
 * - `DataBinding.type` ("collection" | "value" | "field") — `element.dataBinding.type` scope
 * - `FieldDefinition.type` (FieldType 7-literal) — `fieldDef.type` scope
 *
 * 세 필드는 `element.type` vs `element.props.columnMapping.*.type` vs
 * `element.dataBinding.type` 처럼 **3단계 nesting scope** 로 격리되어 있으며,
 * 서로 rename 하지 않는다. 값 공간 교집합 0건 — compile-time disjoint 보장.
 *
 * **pencil schema 정합**: 필드명은 pencil.dev 공식 schema 와 동일
 * (`type` / `reusable` / `ref` / `descendants` / `slot` / `clip` / `placeholder` /
 * `version` / `themes` / `imports` / `name` / `metadata`) 사용. 이름 변경 금지.
 *
 * **ADR-143 예외**: pencil `variables` root 필드는 내부 모델에서 `tokens` 로
 * 정명 (D3 시각 design token ↔ 런타임 `variables` store 의 이중 의미 해소).
 * `.pen` wire 포맷은 `variables` 유지 — 직렬화 경계에서 `tokens` ↔ `variables`
 * 매핑 (ADR-143 §3-4).
 *
 * **ADR-116 G1 boundary (Schema Boundary Freeze)**:
 *
 * 1. canonical core — 본 파일의 `CompositionDocument` / `CanonicalNode` /
 *    `FrameNode` / `RefNode` + `props` 필드. 저장/편집/렌더 SSOT.
 * 2. Composition extension — `x-composition.events` / `actions` / `dataBinding` /
 *    `editor` (`CompositionExtension` 타입). canonical core 가 아닌 namespaced
 *    extension. function callback / React runtime object serialize 금지.
 * 3. adapter quarantine — legacy frame/slot/component mirror metadata. Runtime
 *    resolver/preview/store consumers must not extract props from metadata.
 * 4. Pencil primitive schema — 본 파일은 Pencil 호환 필드명 (frame/ref/
 *    descendants/slot/clip/placeholder) 만 채택. Pencil primitive schema 자체는
 *    채택 대상 아님 (대안 B 기각).
 */
/**
 * `migrate` — 문서 버전 migration 스텁.
 *
 * 실제 migration 체인은 breaking change 시점에 확장.
 * 현재는 `fromVersion === toVersion` 이면 그대로 반환, 그 외는 미구현 에러.
 */
export function migrate(doc, fromVersion, toVersion) {
    if (fromVersion === toVersion)
        return doc;
    throw new Error(`migrate: not implemented (from "${fromVersion}" to "${toVersion}")`);
}
// ADR-131 Phase 8 (2026-05-13): `SerializedData` type 제거.
// 사용자 framing 정정 — data SSOT 는 이미 `collections` / `api_endpoints` /
// `variables` 로 IndexedDB store 분리 + RAC/RSC 컴포넌트가
// `useCollectionData({ datatableId | dataBinding })` 로 통합 소비. binding 자체는
// element 별 reference + config (`Element.dataBinding`) — root collection 격상
// 의미 없음. `SerializedDataBinding` (deprecated) 가 binding payload SSOT 로
// 잔존 — Phase 6 후속 ADR 에서 cleanup 결정.
//# sourceMappingURL=composition-document.types.js.map
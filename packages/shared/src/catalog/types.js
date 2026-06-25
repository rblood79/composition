/**
 * ADR-142 — canonical 문서 기반 컴포넌트 시스템 / catalog 타입 SSOT.
 *
 * 새 시스템에는 "컴포넌트당 정의 객체"(legacy `ComponentSpec`)가 없다.
 * 코드 정의는 leaf RAC primitive 약 35개의 `PrimitiveBinding` 하나뿐이고,
 * 조합 컴포넌트는 canonical reusable 문서(데이터)다.
 *
 * 6개 레지스트리(spec / TAG_SPEC_MAP / specRegistry / factory / panel / renderer)는
 * 단일 `ComponentCatalogEntry` 등록으로 대체된다.
 *
 * 본 파일은 self-contained — legacy `packages/specs/src/types/spec.types.ts`(FieldDef 등)를
 * import 하지 않는다. canonical/resolver 타입은 같은 패키지(`shared`)에서 직접 소비한다.
 *
 * 설계 상세: docs/adr/design/142-starter-spec-component-system-cutover-breakdown.md §3
 */
export {};
//# sourceMappingURL=types.js.map
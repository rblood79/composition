import type { PrimitiveBinding } from "../types";
/**
 * TableHeader — TableView 헤더 행 컨테이너 (자식 Column×N flex row).
 *
 * **ADR-912 catalog cutover (TableView 자식 트리 Skia 대칭, 2026-06-25)**: TableHeader 는 canonical
 *   element 가 실재한다(`createTableViewDefinition` 이 TableView 아래 생성, 자식 Column×N). catalog
 *   미등록 시 `buildSpecNodeData:994` 에서 Skia scene node 가 null 로 버려졌다. catalog 등록으로
 *   `isCatalogCutover("TableHeader")` → `buildCatalogShapesOrPrimitive` 진입,
 *   `COMPONENT_RULES_TABLE.TableHeader`(containerStyles flex row, variant transparent) → shell box
 *   (자식 Column 이 헤더 텍스트 담당). children/text 미보유 → text 분기 미발동(자연 shell-only).
 *
 * **DOM = 부모 renderTableView self-compose (위임 경유 안 함)**: 독립 cutover 렌더 미진입 → DOM 변화
 *   0, Skia 대칭만 추가. PALETTE_ORDER 미포함(TableView factory 전용 자식).
 *
 * D1: composition — DOM 은 부모 renderTableView 가 role=rowgroup div 로 self-compose.
 * D2: 편집 surface 최소(컨테이너 — 자식 Column 이 내용).
 * D3: 시각(flex row 배치 + transparent)은 theme rule(COMPONENT_RULES_TABLE.TableHeader).
 *     Skia generic box ↔ DOM renderTableView div 시각 대칭.
 *
 * source.renderer "tableheader" 은 DOM 에서 호출되지 않는다(부모 self-compose) — getPrimitiveBinding
 * 타입 계약 충족용. DELEGATING 등록 불요.
 */
export declare const tableHeaderBinding: PrimitiveBinding;
//# sourceMappingURL=TableHeader.binding.d.ts.map
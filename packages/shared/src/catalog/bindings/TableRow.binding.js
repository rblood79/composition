/**
 * TableRow — Table 2D projection 의 행 (배경 + 하단 구분선).
 *
 * **ADR-912 Pattern B (collection sub-part, 2026-06-13)**: TableRow 는 catalog 미등록 상태에서
 *   `TableRow.spec.render.shapes`(행 배경 rect + 하단 line)가 Skia 시각 유일 source 였다. catalog
 *   등록으로 rule(`COMPONENT_RULES_TABLE.TableRow`: variants.default.fill base `{color.base}` +
 *   colors.border + sizes.{height/borderRadius}) + buildCatalogShapes generic(bg box) +
 *   `table_row_divider` skiaPrimitive(append, 하단 line)으로 이전.
 *   - **배경 분기(header/striped/selected) → projection 이 `style.backgroundColor` 보편 D3 주입**:
 *     spec 의 `_isSelected`(→{color.accent-subtle}) / `_striped`·`_isHeader`(→{color.layer-2}) /
 *     기본({color.base}) 분기를 projection(appendTableRowProjection)이 계산해 `style.backgroundColor`
 *     단일 보편 데이터로 주입. buildCatalogShapes 는 `style.backgroundColor` 우선 경로로 box 를
 *     그린다(행 종류를 모름 — 컴포넌트 식별 분기 0, ADR-142 §3). rule fill base `{color.base}` 는
 *     projection 미주입 시 fallback.
 *
 * **Skia = box(bg) generic + table_row_divider append**: TableRow 는 render-space projection 노드
 *   (appendTableRowProjection → type:"TableRow" SceneNode)다. buildSpecNodeData 가
 *   `isCatalogCutover("TableRow")` → `buildCatalogShapesOrPrimitive`(bg box) + append divider.
 *   셀 텍스트는 자식 TableCell projection 노드가 독립 self-draw → 행은 bg+divider 만.
 *
 * **DOM = 부모 Table self-compose (독립 노드 0)**: renderTable(RAC `<Row>`)이 합성. canonical 문서에
 *   TableRow element 가 없다(projection 전용 런타임 SceneNode) → DOM 변화 0. 발효 가치는 Skia 대칭
 *   (spec 의존 끊기 = step 4 삭제 안전) 한정.
 *
 * D1: composition — DOM 은 RAC `<Table>`/`<Row>` 가 self-compose + ARIA(role=row/rowheader,
 *     aria-selected). RAC D1/ARIA 권위 보존.
 * D2: size 편집 surface(행은 projection 데이터라 편집 surface 최소).
 * D3: 시각(행 배경 + 하단 구분선)은 theme rule(COMPONENT_RULES_TABLE.TableRow) —
 *     variants.default.fill base + colors.border + sizes{height}. Skia generic(bg box) +
 *     table_row_divider ↔ DOM RAC self-compose 시각 대칭.
 *
 * source.renderer "tablerow" 은 DOM 에서 호출되지 않는다(부모 Table self-compose) — primitiveEntry
 * 의 getPrimitiveBinding 타입 계약 충족용. canonical TableRow element 가 없어 DELEGATING 등록 불요.
 */
export const tableRowBinding = {
    source: {
        kind: "internal",
        renderer: "tablerow",
    },
    props: {
        accepts: {
            size: {
                kind: "size",
                label: "Size",
                section: "appearance",
                default: "md",
            },
        },
        toRacProps: "default",
    },
    skiaPrimitive: "table_row_divider",
};
//# sourceMappingURL=TableRow.binding.js.map
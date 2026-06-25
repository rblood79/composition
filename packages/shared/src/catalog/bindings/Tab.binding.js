/**
 * Tab — Tabs projection 의 개별 탭 leaf (라벨 + 선택 인디케이터).
 *
 * **ADR-912 projection 3 cutover (2026-06-15, TableCell/TableRow Pattern B 동형)**: Tab 은 catalog
 *   미등록 상태에서 `Tab.spec.render.shapes`(transparent box 위 라벨 text + 선택 시 accent
 *   indicator rect)가 Skia 시각 유일 source 였다. catalog 등록으로 rule
 *   (`COMPONENT_RULES_TABLE.Tab`: variants.default transparent fill + colors.text/textHover +
 *   sizes.{fontSize/paddingX/paddingY/height/borderRadius}) + buildCatalogShapes generic(text) +
 *   `tab_indicator` skiaPrimitive(append, 선택 시 accent 막대)로 이전.
 *   - 라벨 text = projection 이 주입한 props.title(보편 데이터, ADR-142 §3). 굵기/색은 rule colors.
 *   - 선택 인디케이터 = `_isSelected`/`_showIndicator`/`orientation`/`_containerWidth` 데이터 분기
 *     (appendTabRowProjection 주입). 컴포넌트 식별 분기 0.
 *
 * **Skia = box+text generic + tab_indicator append**: Tab 은 render-space projection 노드
 *   (appendTabRowProjection → type:"Tab" SceneNode)다. buildSpecNodeData 가
 *   `isCatalogCutover("Tab")` → `buildCatalogShapesOrPrimitive`(transparent box + text) +
 *   append indicator. Tab 은 CONTAINER_DIMENSION_TAGS 등록(buildSpecNodeData) — `_containerWidth`
 *   주입으로 indicator full-width.
 *
 * **DOM = 부모 Tabs self-compose (독립 노드 0)**: renderTabs(RAC `<TabList><Tab>`)가 합성. canonical
 *   문서에 Tab element 가 없다(propagation 으로 TabList.props.items 채워지고 projection 전용 런타임
 *   SceneNode) → DOM 변화 0. 발효 가치는 Skia 대칭(spec 의존 끊기 = step 4 삭제 안전) 한정.
 *
 * D1: composition — DOM 은 RAC `<Tabs>`/`<Tab>` 이 self-compose + ARIA(role=tab, aria-selected).
 *     RAC D1/ARIA 권위 보존.
 * D2: size 편집 surface(탭은 projection 데이터라 편집 surface 최소).
 * D3: 시각(라벨 색/크기 + 선택 인디케이터)은 theme rule(COMPONENT_RULES_TABLE.Tab) +
 *     tab_indicator escape. Skia generic(text)+indicator ↔ DOM RAC self-compose 시각 대칭.
 *
 * source.renderer "tab" 은 DOM 에서 호출되지 않는다(부모 Tabs self-compose) — primitiveEntry 의
 * getPrimitiveBinding 타입 계약 충족용. canonical Tab element 가 없어 DELEGATING 등록 불요.
 */
export const tabBinding = {
    source: {
        kind: "internal",
        renderer: "tab",
    },
    props: {
        accepts: {
            title: { kind: "string", label: "Title", section: "content" },
            size: {
                kind: "size",
                label: "Size",
                section: "appearance",
                default: "md",
            },
        },
        toRacProps: "default",
    },
    skiaPrimitive: "tab_indicator",
};
//# sourceMappingURL=Tab.binding.js.map
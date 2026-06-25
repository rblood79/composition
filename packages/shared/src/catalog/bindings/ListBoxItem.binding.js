/**
 * ListBoxItem — ListBox 행 항목 (selection bg + icon + label + description + check).
 *
 * **ADR-912 collection sub-part cutover (2026-06-14, gridlist_card/Avatar escape 선례 동형)**:
 *   ListBoxItem 은 catalog 미등록 상태에서 `ListBoxItem.spec.render.shapes`(selection/hover row-bg +
 *   icon(좌측) + label fw600 + description(2번째 줄 neutral-subdued) + check(우측 selection))가 Skia
 *   시각 유일 source 였다. catalog 등록으로 rule(`COMPONENT_RULES_TABLE.ListBoxItem`:
 *   variants.default.fill{base transparent / hover layer-1 / selected accent-subtle} + colors.text +
 *   textWeight 600 + sizes.md{paddingX 12/paddingY 4/gap 2/iconSize 16/borderRadius radius.xs}) +
 *   `listbox_item` skiaPrimitive(replace 모드 — multi-slot 행 전체 자체 생성)로 이전.
 *
 * **replace 모드인 이유**: 행은 icon|label/description(수직 스택)|check 의 multi-slot 레이아웃이라
 *   buildCatalogShapes 의 box+single-text 가정으로 재현 불가. ListBoxItem.spec.ts:200-292 좌표 공식과
 *   1:1 대칭. selection 은 props.isSelected(보편 축, ADR-142 §3) — 빌더 정적 캔버스는 default state.
 *   icon/label/description = projection(appendListBoxRowProjection)이 주입한 props.icon/children/
 *   description 보편 데이터.
 *
 * **DOM = 부모 ListBox self-compose (독립 노드 0)**: renderListBox(RAC `<ListBoxItem>`)이 합성 +
 *   ADR-147 이 slot 자식(Icon/Label/Description)을 scene 에서 제외(render.shapes 단일 렌더). canonical
 *   문서에 ListBoxItem element 가 없다(projection 전용 런타임 SceneNode) → DOM 변화 0. 발효 가치는
 *   Skia 대칭(spec 의존 끊기 = step 4 삭제 안전) 한정.
 *
 * D1: composition — DOM 은 RAC `<ListBox>`/`<ListBoxItem>` 이 self-compose + ARIA(role=option,
 *     aria-selected). RAC D1/ARIA 권위 보존.
 * D2: children(label) + description + icon + size 편집 surface.
 * D3: 시각(selection bg + icon + label + description 색/크기)은 theme rule
 *     (COMPONENT_RULES_TABLE.ListBoxItem). Skia generic escape(listbox_item) ↔ DOM RAC
 *     self-compose 시각 대칭.
 *
 * source.renderer "listboxitem" 은 DOM 에서 호출되지 않는다(부모 ListBox self-compose) —
 * primitiveEntry 의 getPrimitiveBinding 타입 계약 충족용. canonical ListBoxItem element 가 없어
 * DELEGATING 등록 불요.
 */
export const listBoxItemBinding = {
    source: {
        kind: "internal",
        renderer: "listboxitem",
    },
    props: {
        accepts: {
            children: { kind: "string", label: "Label", section: "content" },
            size: {
                kind: "size",
                label: "Size",
                section: "appearance",
                default: "md",
            },
        },
        toRacProps: "default",
    },
    skiaPrimitive: "listbox_item",
};
//# sourceMappingURL=ListBoxItem.binding.js.map
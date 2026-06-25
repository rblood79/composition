/**
 * DateInput — DateField/TimeField/DatePicker/DateRangePicker 의 **입력 영역 자식** leaf
 * (input box + border + 세그먼트 placeholder text, picker 일 때 후행 calendar icon).
 *
 * **ADR-912 deletion-risk(date) DateInput 발효 (datefield_segments replace escape, 2026-06-08)**:
 *   recon #108(Workflow 4 agent 4축) 으로 발효 후보 확정 — DateInput.spec.ts:218-331 render.shapes
 *   가 유일 Skia source(부모 catalog cutover 후 자식 spec fallback, controller 0 self-render 완비).
 *   CalendarGrid(`calendar_month_grid`) 동형 standalone replace escape 로 spec 의존 끊기(step 4 삭제 안전).
 *
 * **Skia = datefield_segments replace**: `skiaPrimitive: "datefield_segments"`(skiaPrimitives.ts, replace)가
 *   input box + border + 세그먼트 placeholder text(MM/DD/YYYY 등, locale 분기) + (picker 일 때) 후행
 *   calendar icon 을 함께 그린다. `_parentTag` 4종 분기(DateField/TimeField=segment / DatePicker/
 *   DateRangePicker=picker icon 포함) 이식. datefield_trigger(부모 picker 가 자식 없을 때 그리는 trigger
 *   field 전체)와 별개 키 — datefield_segments 는 **자식 DateInput element 자신** 이 그림.
 *   - box+border+text(+icon) 복합 self-positioning → generic buildCatalogShapes box+text 로 재현
 *     불가(picker icon 우측 배치) → replace 모드(CalendarHeader inline_icon_text / CalendarGrid 선례 동형).
 *   - controller(RAC DateFieldState segment) 비의존 — static placeholder text(SliderTrack/CalendarGrid
 *     controller-free 동형). _parentTag/_granularity/_hourCycle/_locale 정적 props 자기충족.
 *   - 색 = rule variant text/border/fill(default/accent/negative). spec-free.
 *
 * **DOM = 부모 self-compose(독립 노드 0)**: DateField.tsx:149 / TimeField.tsx:127 / DatePicker.tsx:209 /
 *   DateRangePicker.tsx:184 가 모두 RAC `<DateInput>{(segment)=><DateSegment/>}</DateInput>` 를
 *   self-compose 하고 canonical DateInput 자식을 DOM 트리에 순회하지 않는다 → DateInput 자식 노드는
 *   DOM 미렌더. catalog 등록 후에도 DOM 변화 0 — 발효 가치는 Skia 대칭 한정. source.renderer
 *   ="dateinput" 은 단독 배치 edge case fallback 안전망(CalendarGrid 동형 — INTERNAL_RENDERERS 미등록
 *   이므로 cutover generic 320 의 PrimitiveComponent=undefined → 블록 skip → 부모 self-compose 만 그림,
 *   자식 DateInput DOM 노드 0 보장).
 *
 * D1: composition — DOM 은 부모 DateField/TimeField/DatePicker 가 `<DateInput>` self-compose(독립
 *     DOM 노드 없음). RAC DateField/DatePicker D1/ARIA 권위 보존(DateSegment 키보드 네비게이션).
 * D2: size + variant + _parentTag/_granularity/_hourCycle/_locale(부모 주입 placeholder 데이터).
 * D3: 시각(box/border/segment text 색·크기 + picker icon)은 theme rule(COMPONENT_RULES_TABLE.DateInput) —
 *     variant{default/accent/negative} text/border/fill + sizes{fontSize/borderRadius/height}.
 *     Skia generic(datefield_segments replace) ↔ DOM 부모 self-compose 시각 대칭.
 */
export const dateInputBinding = {
    source: {
        kind: "internal",
        renderer: "dateinput",
    },
    props: {
        accepts: {
            variant: {
                kind: "variant",
                label: "Variant",
                section: "appearance",
                default: "default",
            },
            size: {
                kind: "size",
                label: "Size",
                section: "appearance",
                default: "md",
            },
            isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
        },
        toRacProps: "default",
    },
    skiaPrimitive: "datefield_segments",
};
//# sourceMappingURL=DateInput.binding.js.map
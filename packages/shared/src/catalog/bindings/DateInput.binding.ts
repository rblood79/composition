import type { PrimitiveBinding } from "../types";

/**
 * DateInput — DateField/TimeField/DatePicker/DateRangePicker 의 **입력 영역 자식** leaf
 * (input box + border + 세그먼트 placeholder text, picker 일 때 후행 calendar icon).
 *
 * **ADR-912 deletion-risk(date) DateInput 전환 (datefield_segments replace escape, 2026-06-08)**:
 *   CalendarGrid(`calendar_month_grid`) 동형 standalone replace escape.
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
 *   - 색 = rule variant text/border/fill(default/accent/negative).
 *
 * **ADR-253 (2026-10-07)**: DateInput 은 DateInput 원본의 instance 로 쓰이는 부품이다. DOM 은 그 노드가
 *   RAC `DateInput` (+ `DateSegment`) 을 부모의 RAC context 안에서 직접 그리고 (`domBinding`
 *   `fieldDateInputBinding`), 상자 · 크기 단계 · 상태 · 조각은 DateInput rule 의 자기 sheet 다. Canvas 는
 *   어느 부모 안에서든 노드 값으로 상자를 그린다.
 *
 * D1: RAC `<DateInput>` + `<DateSegment>` (부모 field 의 RAC context 안). RAC DateField/DatePicker
 *     D1/ARIA 권위 보존(DateSegment 키보드 네비게이션).
 * D2: size + isDisabled + slot. _parentTag/_granularity/_hourCycle/_locale 은 presence.ts 가 부모에서
 *     주입하는 placeholder 데이터 (accepts 아님).
 * D3: 시각(box/border/segment text 색·크기 + picker icon)은 theme rule(COMPONENT_RULES_TABLE.DateInput) —
 *     variant{default/accent/negative} text/border/fill + sizes{fontSize/borderRadius/height}.
 *     Skia generic(datefield_segments replace) ↔ DOM RAC DateInput 시각 대칭.
 */
export const dateInputBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "dateinput",
  },
  props: {
    accepts: {
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
        editorHidden: true,
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      // ADR-253: RAC's named slot of a range picker's pair (`start` · `end`) — written on the
      //   template position, never edited.
      slot: {
        kind: "string",
        label: "Slot",
        section: "content",
        editorHidden: true,
      },
    },
    toRacProps: "default",
  },
  skiaPrimitive: "datefield_segments",
};

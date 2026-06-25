/**
 * ADR-142 family ⑦(date) — Calendar primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) RAC-controller-backed primitive. composition wrapper(`Calendar.tsx`)가 RAC
 * Calendar + CalendarGrid/CalendarHeader/CalendarCell 합성(internal source). 날짜 grid 는
 * 비-box 시각(6주 × 7일 cell + 헤더) → DOM 은 RAC 가 grid 자동 합성, Skia 는 `calendar_grid`
 * skiaPrimitive(replace) escape 로 grid 시각 재현(ADR-912 단계 5 (1b) — skiaLegacy 제거).
 *
 * color 계열은 ADR-912 단계5에서 leaf/container 별도 slice 로 catalog cutover 완료.
 */
export const calendarBinding = {
    source: {
        kind: "internal",
        renderer: "calendar",
    },
    // ADR-912 단계 5 (1b): 날짜 grid(6주×7일) Skia 시각을 `calendar_grid` skiaPrimitive(replace)로
    // 이전(spec.render.shapes → escape hatch). skiaLegacy 제거 → isCatalogSkiaCutover=true 경로.
    skiaPrimitive: "calendar_grid",
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
            isReadOnly: { kind: "boolean", label: "Read Only", section: "state" },
        },
        toRacProps: "default",
    },
};
//# sourceMappingURL=Calendar.binding.js.map
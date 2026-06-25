/**
 * CalendarGrid — Calendar compound 의 **요일 헤더 + 날짜 셀 그리드** 자식 leaf (nav 제외 — nav 는
 * CalendarHeader 자식이 담당). today indicator dot circle 포함.
 *
 * **ADR-912 (A/2D) CalendarGrid 발효 (calendar_month_grid generic replace, 2026-06-08)**:
 *   recon(6축 병렬) 으로 즉시 차단 absent 확정 — day cell 을 spec self-render(List 의 ListItem
 *   NO_SPEC 같은 자식 차단 없음, CalendarGrid.spec.ts:132-233 weekday+day+today circle unconditional,
 *   factory 자식 0개 → Plain 분기 미주입). date state = static props 자기충족(dayOffset/totalDays/
 *   todayDate + Date fallback, RAC CalendarState 비의존 — SliderTrack controller-free 동형). CalendarHeader
 *   동형 standalone replace escape. (A) parent projector(items SSOT) 는 date 가 algorithmic grid
 *   (dayOffset/totalDays 계산)라 schema overfit → 부적합. 코드 변경 0 recon: inventory
 *   "CalendarGrid (A/2D) recon" 참조.
 *
 * **Skia = calendar_month_grid replace**: `skiaPrimitive: "calendar_month_grid"`(skiaPrimitives.ts, replace)가
 *   요일 헤더 7 text + 날짜 셀 text(totalDays) + today circle dot 를 함께 그린다. nav(월/년 + chevron)는
 *   포함 안 함 — Calendar 부모용 `calendar_grid`(nav 포함)와 별개. 좌표 = CalendarGrid.spec.ts:132-233
 *   1:1(cellSize=iconSize+4, weekdayY=cellSize/2, gridStartY=cellSize, today circle radius:3 accent).
 *   - **circle(today dot) + 2D 절대좌표 self-positioning** → generic buildCatalogShapes box+text 로 재현
 *     불가 → replace 모드(자체 grid box 생성, StatusLight circle / ProgressCircle arc 선례 동형).
 *   - 색 = rule variant text({color.neutral}, transparent fill), 요일은 {color.neutral-subdued}.
 *   - spec-free: visual rule + props(dayOffset/totalDays/todayDate/locale/calendarSystem) 만 읽음.
 *
 * **DOM = 부모 Calendar/RangeCalendar self-compose(독립 노드 0)**: Calendar wrapper(Calendar.tsx:122-128)
 *   가 `<div className="calendar-grids"><CalendarGrid offset>{(date)=><CalendarCell/>}</CalendarGrid>` 를
 *   self-compose 하고 canonical CalendarGrid 자식을 DOM 트리에 순회하지 않는다 → CalendarGrid 자식 노드는
 *   DOM 미렌더. 따라서 catalog 등록 후에도 DOM 변화 0 — 발효 가치는 Skia 대칭 한정. source.renderer
 *   ="calendargrid" 는 단독 배치 edge case fallback 안전망(평시 미진입).
 *
 * D1: composition — DOM 은 부모 Calendar/RangeCalendar 가 `<CalendarGrid>` self-compose(독립 DOM 노드 없음).
 *     RAC Calendar D1/ARIA 권위 보존(role="grid" + CalendarCell 키보드 네비게이션).
 * D2: dayOffset/totalDays/todayDate(month grid 데이터) + defaultToday + locale/calendarSystem(Intl) + size.
 * D3: 시각(요일/날짜 text 색·크기 + today dot)은 theme rule(COMPONENT_RULES_TABLE.CalendarGrid) —
 *     variant text({color.neutral}, transparent fill) + sizes{fontSize/iconSize/gap/borderRadius}.
 *     Skia generic(calendar_month_grid replace) ↔ DOM 부모 self-compose 시각 대칭.
 */
export const calendarGridBinding = {
    source: {
        kind: "internal",
        renderer: "calendargrid",
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
            defaultToday: {
                kind: "boolean",
                label: "Show Today",
                section: "content",
            },
            dayOffset: { kind: "number", label: "Day Offset", section: "content" },
            totalDays: { kind: "number", label: "Total Days", section: "content" },
            todayDate: { kind: "number", label: "Today Date", section: "content" },
            locale: { kind: "string", label: "Locale", section: "content" },
            calendarSystem: {
                kind: "string",
                label: "Calendar System",
                section: "content",
            },
        },
        toRacProps: "default",
    },
    skiaPrimitive: "calendar_month_grid",
};
//# sourceMappingURL=CalendarGrid.binding.js.map
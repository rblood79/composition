import type { PrimitiveBinding } from "../types";

/**
 * CalendarGrid — Calendar compound 의 **요일 헤더 + 날짜 셀 그리드** 자식 leaf (nav 제외 — nav 는
 * CalendarHeader 자식이 담당). today indicator dot circle 포함.
 *
 * **ADR-912 (A/2D) CalendarGrid 전환 (calendar_month_grid generic replace, 2026-06-08)**:
 *   date state = static props 자기충족(dayOffset/totalDays/todayDate + Date fallback, RAC CalendarState
 *   비의존 — SliderTrack controller-free 동형). CalendarHeader 동형 standalone replace escape.
 *
 * **Skia = calendar_month_grid replace**: `skiaPrimitive: "calendar_month_grid"`(skiaPrimitives.ts, replace)가
 *   요일 헤더 7 text + 날짜 셀 text(totalDays) + today circle dot 를 함께 그린다. nav(월/년 + chevron)는
 *   포함 안 함 — Calendar 부모용 `calendar_grid`(nav 포함)와 별개. 좌표 = cellSize=iconSize+4,
 *   weekdayY=cellSize/2, gridStartY=cellSize, today circle radius:3 accent.
 *   - **circle(today dot) + 2D 절대좌표 self-positioning** → generic buildCatalogShapes box+text 로 재현
 *     불가 → replace 모드(자체 grid box 생성, StatusLight circle / ProgressCircle arc 선례 동형).
 *   - 색 = rule variant text({color.neutral}, transparent fill), 요일은 {color.neutral-subdued}.
 *   - visual rule + props(dayOffset/totalDays/todayDate/locale/calendarSystem) 만 읽음.
 *
 * **DOM = 부모 Calendar/RangeCalendar self-compose(독립 노드 0)**: `CATALOG_DELEGATED_DOM.calendar` ·
 *   `rangecalendar` 는 자식 노드를 모두 소유(`ownsChild: ownsAll`)하고 shared `Calendar.tsx` 가
 *   `<div className="calendar-grids"><CalendarGrid offset>…</CalendarGrid>` 를 스스로 그린다 →
 *   CalendarGrid 노드는 DOM 에 따로 그려지지 않는다. source.renderer="calendargrid" 는 단독 배치
 *   edge case fallback 안전망(평시 미진입).
 *
 * D1: composition — DOM 은 부모 Calendar/RangeCalendar 가 `<CalendarGrid>` self-compose(독립 DOM 노드 없음).
 *     RAC Calendar D1/ARIA 권위 보존(role="grid" + CalendarCell 키보드 네비게이션).
 * D2: dayOffset/totalDays/todayDate(month grid 데이터) + defaultToday + variant + size.
 * D3: 시각(요일/날짜 text 색·크기 + today dot)은 theme rule(COMPONENT_RULES_TABLE.CalendarGrid) —
 *     variant text({color.neutral}, transparent fill) + sizes{fontSize/iconSize/gap/borderRadius}.
 *     Skia generic(calendar_month_grid replace) ↔ DOM 부모 self-compose 시각 대칭.
 */
export const calendarGridBinding: PrimitiveBinding = {
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
        default: "M",
        editorHidden: true,
      },
      defaultToday: {
        kind: "boolean",
        label: "Show Today",
        section: "content",
        editorHidden: true,
      },
      dayOffset: { kind: "number", label: "Day Offset", section: "content", editorHidden: true },
      totalDays: { kind: "number", label: "Total Days", section: "content", editorHidden: true },
      todayDate: { kind: "number", label: "Today Date", section: "content", editorHidden: true },
    },
    toRacProps: "default",
  },
  skiaPrimitive: "calendar_month_grid",
};

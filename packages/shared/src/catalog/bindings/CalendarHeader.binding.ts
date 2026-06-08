import type { PrimitiveBinding } from "../types";

/**
 * CalendarHeader — Calendar 네비게이션 헤더 leaf (좌 chevron + 중앙 월/년 text + 우 chevron).
 *
 * **ADR-912 (B+icon) CalendarHeader 발효 (inline_icon_text generic replace, 2026-06-08)**:
 *   DisclosureHeader 의 leading_icon(append) 확장. DisclosureHeader 는 "좌측 single icon + left text"
 *   였지만 CalendarHeader 는 "좌 icon + center text + 우 icon" 으로 **다른 레이아웃 가정** →
 *   별도 `inline_icon_text` skiaPrimitive(replace 모드)로 전체 3-shape 자기 생성(buildCatalogShapes
 *   box+text 대체 — center text 가 좌측/center 단일 text 와 충돌하므로 base 미생성). recon 옵션 B
 *   채택(별도 module — leading_icon mode flag 확장 시 단일 책임 붕괴). 코드 변경 0 recon: inventory
 *   "CalendarHeader (B+icon) 확장 recon" 참조.
 *
 * **Skia = inline_icon_text replace**: `skiaPrimitive: "inline_icon_text"`(skiaPrimitives.ts, replace)가
 *   visual.leadingIcon(chevron-left) + center text(Intl 현재월) + visual.trailingIcon(chevron-right) 를
 *   함께 그린다. 우측 chevron 은 containerWidth 의존(CONTAINER_DIMENSION_TAGS=CalendarHeader 등록 →
 *   `_containerWidth` 주입). 색 = rule variant text({color.neutral}), 좌표 = CalendarHeader.spec.ts
 *   render.shapes 와 1:1 대칭(cellSize=iconSize+4 / 좌 cellSize/2 / text cellSize center / 우 width-cellSize/2).
 *   icon/text 데이터 분기만 — 컴포넌트별 if 없음(ADR-142 §3).
 *
 * **DOM = 부모 Calendar/RangeCalendar self-compose (독립 노드 0)**: Calendar wrapper(Calendar.tsx:113-122)
 *   가 `<header><Button slot="previous"><Heading /><Button slot="next"></header>` 를 자체 생성하고
 *   `props.children` 을 렌더하지 않는다 → CalendarHeader 가 canonical 자식으로 들어와도 RAC Calendar 가
 *   drop(DOM 독립 노드 미생성). 따라서 catalog 등록 후에도 DOM 변화 0 — 발효 가치는 Skia 대칭 한정.
 *   source.renderer="calendarheader" 는 단독 배치 edge case fallback 안전망(평시 미진입).
 *
 * D1: composition — DOM 은 부모 Calendar/RangeCalendar 가 `<header>` self-compose(독립 DOM 노드 없음).
 *     RAC Calendar D1/ARIA 권위 보존.
 * D2: children(현재월 text override) + locale/calendarSystem(Intl) + size 편집 surface.
 * D3: 시각(좌우 chevron + 월/년 text 색/크기/정렬)은 theme rule(COMPONENT_RULES_TABLE.CalendarHeader) —
 *     leadingIcon/trailingIcon{name/gap/color} + textAlign + sizes{fontSize/iconSize/gap/paddingX/height}.
 *     Skia generic(inline_icon_text replace) ↔ DOM 부모 self-compose 시각 대칭.
 */
export const calendarHeaderBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "calendarheader",
  },
  props: {
    accepts: {
      children: { kind: "string", label: "Month/Year", section: "content" },
      locale: { kind: "string", label: "Locale", section: "content" },
      calendarSystem: {
        kind: "string",
        label: "Calendar System",
        section: "content",
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
    },
    toRacProps: "default",
  },
  skiaPrimitive: "inline_icon_text",
};

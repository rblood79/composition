import type { PrimitiveBinding } from "../types";
import { ITEM_KEY_PROP_CONTRACT } from "../document/itemLinks";

/**
 * ADR-323 Phase 2 — Timeline · TimelineItem: 날짜 순서의 이력 띠 (breakdown §5.3). RAC 1.22.1 · S2
 * 1.8.2 · design-data · v3 3.47.7 에 없어 (Phase 0) prop 은 composition 확장이다 (`d2Provenance.ts`
 * — 이름은 ReUI · MUI · Ant Design 의 것: `orientation` · `position`). 상호작용이 없다 — RAC 부품도
 * D1 예외도 쓰지 않고 DOM 은 `ol > li` 다 (날짜는 `time`).
 *
 * Node tree: `Timeline > TimelineItem*`, 항목 = TimelineItem 원본 (`component-timelineitem`) 의
 * instance — 제목 Text `{label}` · 날짜 Text `{date}` · 설명 Text `{description}` (날짜 · 설명은 비면
 * 없음). 항목은 그 밖의 자식도 받는다 (자유 내용). 표식 · 연결선은 노드가 아니라 항목이 그린다.
 *
 * 상태 (사용자 결정 1, 2026-11-28 「항목마다 상태」): 항목의 `status` — 완료 · 진행 중 · 예정. 데이터에
 * 연결하면 항목이 행마다 반복되고, 바인딩의 날짜 축 역할 (`collections/dateAxisRoles.ts` — `start` ·
 * `title` · `color`) 이 날짜 · 제목 · 상태를 준다 (resolver `keyRowItem`).
 */
export const timelineBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "timeline" },
  props: {
    accepts: {
      // (Its rows: one item per row — the binding's date-axis roles name each item's date · title ·
      //  status, `CollectionBinding` · resolver `keyRowItem`.)
      dataBinding: {
        kind: "binding",
        label: "Data source",
        section: "collection",
      },
      orientation: {
        kind: "enum",
        label: "Orientation",
        section: "appearance",
        default: "vertical",
        options: [
          { value: "vertical", label: "Vertical" },
          { value: "horizontal", label: "Horizontal" },
        ],
      },
      // (Where an item's content sits beside the line — `rule/timeline.ts`; `alternate` is vertical
      //  only, a horizontal list draws it as `end`. MUI Timeline's `position` — `placement` is the
      //  overlays' key in the panel's Overlay section.)
      position: {
        kind: "enum",
        label: "Placement",
        section: "appearance",
        default: "end",
        options: [
          { value: "end", label: "After line" },
          { value: "start", label: "Before line" },
          { value: "alternate", label: "Alternate" },
        ],
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
      },
    },
    toRacProps: "default",
  },
};

export const timelineItemBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "timelineitem" },
  props: {
    accepts: {
      // Its key — a data row's key when the list is bound.
      id: ITEM_KEY_PROP_CONTRACT,
      // (The texts the TimelineItem origin's Text nodes show — `{label}` · `{date}` · `{description}`.)
      label: { kind: "string", label: "Title", section: "content" },
      date: { kind: "string", label: "Date", section: "content" },
      description: {
        kind: "string",
        label: "Description",
        section: "content",
      },
      // 사용자 결정 1 — the item's status (its marker and the line after it).
      status: {
        kind: "enum",
        label: "Status",
        section: "state",
        default: "completed",
        options: [
          { value: "completed", label: "Completed" },
          { value: "current", label: "In progress" },
          { value: "upcoming", label: "Upcoming" },
        ],
      },
      // (The list's size, carried by the resolver — `CATALOG_SIZE_PROPAGATION`.)
      size: {
        editorHidden: true,
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
      },
    },
    toRacProps: "default",
  },
};

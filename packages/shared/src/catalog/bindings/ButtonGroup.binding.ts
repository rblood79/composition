import type { PrimitiveBinding } from "../types";

/**
 * ButtonGroup — 버튼 묶음 컨테이너 (Cancel/Save 류 Button 자식 묶음). composition 자체 추상.
 * origin template 이 자식 Button×2(Cancel / Save)를 둔다 (reusableOriginLibrary.ts).
 *
 * **ADR-912 R7 G1-c (container shell catalog cutover, 2026-06-15)**:
 *   DOM CSS · Skia 시각 모두 `COMPONENT_RULES_TABLE.ButtonGroup`(variant default transparent + sizes
 *   height/radius) 이 정본이다. AvatarGroup/CardView/TableView/Pagination(R7 G1-a/b/c) shell 과 동형.
 *
 * **시각 = 투명 generic shell(자식 Button 이 내용 렌더)**: variant default fill/border 가 전부
 *   transparent 라 Canvas 는 투명 box 를 그리고 자식 Button 노드가 시각을 담당한다. container
 *   layout(`display:flex` / `flexDirection:row` / gap)은 origin template 의 layout · visual 값이다.
 *
 * **DOM 렌더 = `CATALOG_DELEGATED_DOM.buttongroup` (delegatedDom.tsx)**: 자식 Button 노드를
 *   `<div role="group">` 안에 그린다 (orientation · align · size 를 flex 방향 · 정렬 · gap 으로).
 *   고유 renderer id(`"buttongroup"`)가 그 항목의 key 다.
 *
 * D1: composition `<div role="group">` (internal source — delegatedDom 이 role 을 부여).
 * D2: size(appearance) + orientation/align(appearance) + isDisabled(state) 편집 surface (자식 제외).
 * D3: 시각(variant transparent + radius)은 theme rule(COMPONENT_RULES_TABLE.ButtonGroup).
 *     Skia generic box shell ↔ DOM `div[role=group]` (delegatedDom) 시각 대칭.
 */
export const buttonGroupBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    // 고유 renderer id — CATALOG_DELEGATED_DOM.buttongroup 이 자식 Button 노드를 `<div role="group">`
    //   안에 그린다.
    renderer: "buttongroup",
  },
  props: {
    accepts: {
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
      },
      orientation: {
        kind: "enum",
        label: "Orientation",
        section: "appearance",
        default: "horizontal",
        options: [
          { value: "horizontal", label: "Horizontal" },
          { value: "vertical", label: "Vertical" },
        ],
      },
      align: {
        kind: "enum",
        label: "Align",
        section: "appearance",
        default: "end",
        options: [
          { value: "start", label: "Start" },
          { value: "center", label: "Center" },
          { value: "end", label: "End" },
        ],
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
};

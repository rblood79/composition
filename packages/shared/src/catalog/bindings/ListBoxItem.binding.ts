import type { PrimitiveBinding } from "../types";

/**
 * ListBoxItem — ListBox 행 항목 (selection bg + icon + label + description + check).
 *
 * **노드**: ListBoxItem origin template (`reusableOriginLibrary.ts` `component-listbox-item-default`)
 *   이 icon · label · description 을 자식 노드로 둔다.
 *
 * **Canvas**: rule(`COMPONENT_RULES_TABLE.ListBoxItem`: variants.default.fill{base transparent /
 *   hover layer-1 / selected accent-subtle} + colors.text + textWeight 600 + sizes.M{paddingX 12/
 *   paddingY 4/gap 2/iconSize 16/borderRadius radius.xs}) + `listbox_item` skiaPrimitive(replace 모드 —
 *   icon|label/description|check 의 multi-slot 행은 box+single-text 가정으로 재현 불가). 자식 노드가
 *   있으면 (`_hasChildren`) escape 는 shell(selection row-bg + check)만 그리고 내용은 자식 노드가
 *   그린다. selection 은 props.isSelected(보편 축, ADR-142 §3).
 *
 * **DOM**: `INTERNAL_RENDERERS.listboxitem` (`ListBoxItem` — `components/ListBox.tsx`) 가 RAC
 *   `<ListBoxItem>` 을 감싸 render props 를 넘긴다 (`RENDER_PROPS_INTERNAL_RENDERERS`). 부모 ListBox
 *   의 RAC collection 안에서 항목이 된다.
 *
 * D1: composition — DOM 은 RAC `<ListBox>`/`<ListBoxItem>` + ARIA(role=option, aria-selected).
 *     RAC D1/ARIA 권위 보존.
 * D2: children(label) + size + isDisabled 편집 surface.
 * D3: 시각(selection bg + icon + label + description 색/크기)은 theme rule
 *     (COMPONENT_RULES_TABLE.ListBoxItem). Canvas escape(listbox_item) ↔ DOM RAC 항목 시각 대칭.
 */
export const listBoxItemBinding: PrimitiveBinding = {
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
        default: "M",
      },
      // ADR-237 Phase 2 — RAC/RSP 항목 `isDisabled`. Canvas 는 이미 읽는데 (상태 층 disabled) accepts 미선언이라
      //   DOM 에만 닿지 않았다 (두 leg 발산) — Tag 와 같은 선언.
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
  skiaPrimitive: "listbox_item",
};

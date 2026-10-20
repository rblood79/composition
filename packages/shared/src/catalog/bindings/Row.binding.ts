import type { PrimitiveBinding } from "../types";
import {
  ITEM_LINK_PROP_CONTRACTS,
  ITEM_SELECTED_PROP_CONTRACT,
} from "../document/itemLinks";

/**
 * Row — Table 데이터 행 컨테이너 (자식 Cell×N flex row).
 *
 * **노드**: Table origin template (`reusableOriginLibrary.ts`) 은 TableBody 아래 Row 원본
 *   (`component-table-row`) 의 instance 하나 (자식 Cell×3 — starter, ADR-277) 를 두고, "+" 로 넣는
 *   행도 같은 원본의 instance 다.
 *   PALETTE_ORDER 미포함(Table 가족 전용 자식).
 *
 * **Canvas**: `COMPONENT_RULES_TABLE.Row`(containerStyles flex row, variant transparent) → shell
 *   box(자식 Cell 이 내용 담당). children/text 미보유 → shell-only.
 *
 * **DOM**: Table 안에서 `INTERNAL_RENDERERS.row` (RAC `Row`, ADR-256 Phase 5i).
 *
 * D1: RAC `Row`.
 * D2: 편집 surface 최소(컨테이너 — 자식 Cell 이 내용).
 * D3: 시각(행 배경 transparent + flex row 배치)은 theme rule(COMPONENT_RULES_TABLE.Row).
 */
export const rowBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "row",
  },
  props: {
    accepts: {
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
      },
      // S2 · RAC Row `isDisabled` (2026-10-09): RAC's disabled row; the Row rule's disabled opacity.
      // ADR-259 Phase 1: S2 · RAC item link (`href` · `target` · `rel` — RAC draws the link).
      ...ITEM_LINK_PROP_CONTRACTS,
      // Its collection's selection starts from it (2026-10-13 — `ITEM_SELECTED_PROP_CONTRACT`).
      isSelected: ITEM_SELECTED_PROP_CONTRACT,
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
};

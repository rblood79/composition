import type { PrimitiveBinding } from "../types";

/**
 * TabList — Tabs 안의 탭 컨테이너 (하단/우측 구분선, RAC `TabList`).
 *
 * **노드 트리**: Tabs origin template 은 `Tabs > TabList > Tab… + TabPanels` 이고 TabList 의 Tab 은
 *   자식 노드다 (`reusableOriginLibrary.ts`).
 *
 * **Canvas**: rule(`COMPONENT_RULES_TABLE.TabList`: transparent shell + sizes.{height}) 의 상자 +
 *   `tablist_divider` skiaPrimitive(append, 구분선 line). orientation 데이터 분기만(ADR-142 §3).
 *
 * **DOM**: `delegatedDom.tsx` `tablist` 가 shared `components/Tabs` 의 TabList 를 Tabs 의 RAC context
 *   안에서 그린다 (density · size 는 Tabs 조상 값).
 *
 * D1: RAC `<TabList>` — ARIA(role=tablist) 는 RAC 권위.
 * D2: size 편집 surface.
 * D3: 시각(하단/우측 구분선)은 tablist_divider escape ↔ DOM generated CSS 시각 대칭.
 */
export const tabListBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "tablist",
  },
  props: {
    accepts: {
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
      },
    },
    toRacProps: "default",
  },
  skiaPrimitive: "tablist_divider",
};

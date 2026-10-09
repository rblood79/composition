/**
 * ADR-142 family ④(collections) — Tabs primitive 의 `PrimitiveBinding`.
 *
 * DOM 은 `delegatedDom.tsx` `tabs` 가 shared `components/Tabs` 의 Tabs 를 그리고 그 안의 노드 트리
 * (TabList > Tab… · TabPanels > TabPanel) 를 순서대로 그린다. Canvas 시각은 catalog rule
 * (`COMPONENT_RULES_TABLE.Tabs`).
 */

import type { PrimitiveBinding } from "../types";

export const tabsBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "tabs",
  },
  props: {
    accepts: {
      dataBinding: { kind: "binding", label: "Data", section: "content" },
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
      // live consumer: `delegatedDom.tsx` `tabs` · `tablist` (Tabs + TabList)
      density: {
        kind: "enum",
        label: "Density",
        section: "appearance",
        default: "regular",
        options: [
          { value: "compact", label: "Compact" },
          { value: "regular", label: "Regular" },
        ],
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
};

/**
 * ADR-142 family ④(collections) — Tabs primitive 의 `PrimitiveBinding`.
 *
 * composition wrapper(`Tabs.tsx`)가 useCollectionData(dataBinding → tab items)로 채우고
 * RAC Tabs + TabList/Tab/TabPanel 합성(internal source). Skia generic 발효(skiaLegacy 제거, ADR-912 단계 4).
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
        default: "md",
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
      // live consumer: LayoutRenderers.tsx renderTabs line 143/167 (Tabs + TabList)
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
      // live consumer: LayoutRenderers.tsx renderTabs line 171 (TabList showIndicator)
      showIndicator: {
        kind: "boolean",
        label: "Show Indicator",
        section: "appearance",
        default: true,
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
};

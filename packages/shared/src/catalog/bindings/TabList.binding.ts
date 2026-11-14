import type { PrimitiveBinding } from "../types";

/** S2 Tabs의 TabList. 시각 context는 Tabs에서 상속하며 구분선을 그리지 않는다. */
export const tabListBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "tablist",
  },
  props: {
    accepts: {
      orientation: {
        kind: "enum",
        label: "Orientation",
        section: "appearance",
        editorHidden: true,
        options: [
          { value: "horizontal", label: "Horizontal" },
          { value: "vertical", label: "Vertical" },
        ],
      },
      labelBehavior: {
        kind: "enum",
        label: "Label behavior",
        section: "appearance",
        editorHidden: true,
        options: [
          { value: "show", label: "Show" },
          { value: "hide", label: "Hide" },
        ],
      },
      size: {
        editorHidden: true,
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
      },
      // Tabs 의 density 내부 운반 값 (resolver 전파 — 패널 미노출). densities 채널 (탭 사이 gap).
      density: {
        kind: "enum",
        label: "Density",
        section: "appearance",
        editorHidden: true,
        options: [
          { value: "compact", label: "Compact" },
          { value: "regular", label: "Regular" },
        ],
      },
    },
    toRacProps: "default",
  },
};

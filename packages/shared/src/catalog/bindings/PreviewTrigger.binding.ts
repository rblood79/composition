import type { PrimitiveBinding } from "../types";

/** Hover · focus · long press로 여는 RAC preview와 작성한 Popover의 연결. */
export const previewTriggerBinding: PrimitiveBinding = {
  source: {
    kind: "rac",
    package: "react-aria-components",
    importPath: "react-aria-components/PreviewTrigger",
    component: "PreviewTrigger",
  },
  props: {
    accepts: {
      isOpen: { kind: "boolean", label: "Open", section: "state" },
      defaultOpen: {
        kind: "boolean",
        label: "Initially Open",
        section: "state",
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      delay: { kind: "number", label: "Delay", section: "state", default: 600 },
      closeDelay: {
        kind: "number",
        label: "Close Delay",
        section: "state",
        default: 200,
      },
    },
    toRacProps: "default",
  },
};

import type { PrimitiveBinding, PropContract } from "../types";

const openProps: Record<string, PropContract> = {
  isOpen: { kind: "boolean", label: "Open", section: "value" },
  defaultOpen: {
    editorHidden: true,
    kind: "boolean",
    label: "Initially open",
    section: "value",
  },
};

function sheetPart(
  component: string,
  accepts: Record<string, PropContract>,
): PrimitiveBinding {
  return {
    source: {
      kind: "rac",
      package: "react-aria-components",
      importPath: "react-aria-components/Sheet",
      component,
    },
    props: { accepts, toRacProps: "default" },
  };
}

export const sheetTriggerBinding = sheetPart("SheetTrigger", openProps);
export const sheetOverlayBinding = sheetPart("SheetOverlay", {
  ...openProps,
  position: {
    kind: "enum",
    label: "Position",
    section: "appearance",
    default: "bottom",
    options: ["bottom", "top", "left", "right", "start", "end", "center"].map(
      (value) => ({ value, label: value }),
    ),
  },
  swipeDirection: {
    kind: "enum",
    label: "Swipe direction",
    section: "appearance",
    options: [
      "bottom",
      "top",
      "vertical",
      "left",
      "right",
      "start",
      "end",
      "horizontal",
    ].map((value) => ({ value, label: value })),
  },
  snapPoints: {
    kind: "string-array",
    label: "Snap points",
    section: "appearance",
  },
  preventDismissal: {
    kind: "boolean",
    label: "Prevent dismissal",
    section: "state",
  },
});
export const sheetBinding = sheetPart("Sheet", {
  overscrollPadding: {
    kind: "boolean",
    label: "Overscroll padding",
    section: "appearance",
  },
});
export const sheetBackdropBinding = sheetPart("SheetBackdrop", {});
export const sheetContentBinding = sheetPart("SheetContent", {
  "aria-label": {
    kind: "string",
    label: "Aria Label",
    section: "content",
    editorHidden: true,
  },
});

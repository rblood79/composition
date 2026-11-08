import type { PrimitiveBinding, PropContract } from "../types";

const openProps: Record<string, PropContract> = {
  isOpen: { kind: "boolean", label: "Open", section: "state" },
  defaultOpen: { kind: "boolean", label: "Initially Open", section: "state" },
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
    label: "Swipe Direction",
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
    label: "Snap Points",
    section: "appearance",
  },
  preventDismissal: {
    kind: "boolean",
    label: "Prevent Dismissal",
    section: "state",
  },
});
export const sheetBinding = sheetPart("Sheet", {
  overscrollPadding: {
    kind: "boolean",
    label: "Overscroll Padding",
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

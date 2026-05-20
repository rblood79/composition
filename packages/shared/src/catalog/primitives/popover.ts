import type { PrimitiveBinding } from "../types";
import {
  POPOVER_PLACEMENT_VALUES,
  POPOVER_SIZE_VALUES,
  POPOVER_VARIANT_VALUES,
  toPopoverRacProps,
  type PopoverCanonicalProps,
  type PopoverRacProps,
} from "../outputs/toRacProps";

const popoverAccepts = {
  children: {
    kind: "string",
    label: "Text",
    section: "content",
    default: "Popover content",
  },
  text: {
    kind: "string",
    label: "Text",
    section: "content",
    inspector: false,
  },
  variant: {
    kind: "enum",
    label: "Variant",
    section: "appearance",
    default: "surface",
    options: POPOVER_VARIANT_VALUES.map((value) => ({
      value,
      label: value[0]!.toUpperCase() + value.slice(1),
    })),
  },
  size: {
    kind: "enum",
    label: "Size",
    section: "appearance",
    default: "md",
    options: POPOVER_SIZE_VALUES.map((value) => ({
      value,
      label: value.toUpperCase(),
    })),
  },
  placement: {
    kind: "enum",
    label: "Placement",
    section: "position",
    default: "bottom",
    options: POPOVER_PLACEMENT_VALUES.map((value) => ({
      value,
      label: value
        .split(" ")
        .map((part) => part[0]!.toUpperCase() + part.slice(1))
        .join(" "),
    })),
  },
  offset: {
    kind: "number",
    label: "Offset",
    section: "position",
    default: 8,
    min: 0,
    step: 1,
  },
  containerPadding: {
    kind: "number",
    label: "Padding",
    section: "position",
    default: 12,
    min: 0,
    step: 1,
  },
  crossOffset: {
    kind: "number",
    label: "Cross offset",
    section: "position",
    default: 0,
    step: 1,
  },
  shouldFlip: {
    kind: "boolean",
    label: "Should flip",
    section: "position",
    default: true,
  },
  showArrow: {
    kind: "boolean",
    label: "Arrow",
    section: "appearance",
    default: true,
  },
  containFocus: {
    kind: "boolean",
    label: "Contain focus",
    section: "state",
    default: false,
  },
  autoFocus: {
    kind: "boolean",
    label: "Auto focus",
    section: "state",
    default: true,
  },
  restoreFocus: {
    kind: "boolean",
    label: "Restore focus",
    section: "state",
    default: true,
  },
  isOpen: {
    kind: "boolean",
    label: "Open",
    section: "state",
    default: true,
  },
  className: {
    kind: "string",
    label: "Class name",
    section: "appearance",
    inspector: false,
  },
  style: {
    kind: "string",
    label: "Style",
    section: "appearance",
    inspector: false,
  },
} as const;

export const popoverPrimitiveBinding: PrimitiveBinding<
  PopoverCanonicalProps,
  PopoverRacProps
> = {
  tag: "Popover",
  family: "overlays",
  runtime: {
    source: "react-aria-components",
    exportName: "Popover",
  },
  defaultProps: {
    children: "Popover content",
    variant: "surface",
    size: "md",
    placement: "bottom",
    offset: 8,
    containerPadding: 12,
    crossOffset: 0,
    shouldFlip: true,
    showArrow: true,
    containFocus: false,
    autoFocus: true,
    restoreFocus: true,
    isOpen: true,
  },
  props: {
    accepts: popoverAccepts,
  },
  toRacProps: toPopoverRacProps,
  skiaPrimitive: { kind: "popover" },
};

export const popoverInspectorThemeValues = {
  variants: {
    Popover: POPOVER_VARIANT_VALUES,
  },
  sizes: {
    Popover: POPOVER_SIZE_VALUES,
  },
};

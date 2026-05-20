import type { PrimitiveBinding } from "../types";
import {
  TOOLTIP_PLACEMENT_VALUES,
  TOOLTIP_SIZE_VALUES,
  TOOLTIP_VARIANT_VALUES,
  toTooltipRacProps,
  type TooltipCanonicalProps,
  type TooltipRacProps,
} from "../outputs/toRacProps";

const tooltipAccepts = {
  children: {
    kind: "string",
    label: "Text",
    section: "content",
    default: "Helpful tip",
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
    default: "neutral",
    options: TOOLTIP_VARIANT_VALUES.map((value) => ({
      value,
      label: value[0]!.toUpperCase() + value.slice(1),
    })),
  },
  size: {
    kind: "enum",
    label: "Size",
    section: "appearance",
    default: "md",
    options: TOOLTIP_SIZE_VALUES.map((value) => ({
      value,
      label: value.toUpperCase(),
    })),
  },
  placement: {
    kind: "enum",
    label: "Placement",
    section: "position",
    default: "top",
    options: TOOLTIP_PLACEMENT_VALUES.map((value) => ({
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

export const tooltipPrimitiveBinding: PrimitiveBinding<
  TooltipCanonicalProps,
  TooltipRacProps
> = {
  tag: "Tooltip",
  family: "overlays",
  runtime: {
    source: "react-aria-components",
    exportName: "Tooltip",
  },
  defaultProps: {
    children: "Helpful tip",
    variant: "neutral",
    size: "md",
    placement: "top",
    offset: 8,
    containerPadding: 12,
    crossOffset: 0,
    shouldFlip: true,
    showArrow: true,
  },
  props: {
    accepts: tooltipAccepts,
  },
  toRacProps: toTooltipRacProps,
  skiaPrimitive: { kind: "tooltip" },
};

export const tooltipInspectorThemeValues = {
  variants: {
    Tooltip: TOOLTIP_VARIANT_VALUES,
  },
  sizes: {
    Tooltip: TOOLTIP_SIZE_VALUES,
  },
};

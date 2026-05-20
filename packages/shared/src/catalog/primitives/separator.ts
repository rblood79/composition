import type { PrimitiveBinding } from "../types";
import {
  SEPARATOR_ORIENTATION_VALUES,
  SEPARATOR_SIZE_VALUES,
  SEPARATOR_VARIANT_VALUES,
  toSeparatorRacProps,
  type SeparatorCanonicalProps,
  type SeparatorRacProps,
} from "../outputs/toRacProps";

const separatorAccepts = {
  orientation: {
    kind: "enum",
    label: "Orientation",
    section: "appearance",
    default: "horizontal",
    options: SEPARATOR_ORIENTATION_VALUES.map((value) => ({
      value,
      label: value[0]!.toUpperCase() + value.slice(1),
    })),
  },
  variant: {
    kind: "enum",
    label: "Variant",
    section: "appearance",
    default: "default",
    options: SEPARATOR_VARIANT_VALUES.map((value) => ({
      value,
      label:
        value === "default"
          ? "Default"
          : value[0]!.toUpperCase() + value.slice(1),
    })),
  },
  size: {
    kind: "enum",
    label: "Size",
    section: "appearance",
    default: "md",
    options: SEPARATOR_SIZE_VALUES.map((value) => ({
      value,
      label: value.toUpperCase(),
    })),
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

export const separatorPrimitiveBinding: PrimitiveBinding<
  SeparatorCanonicalProps,
  SeparatorRacProps
> = {
  tag: "Separator",
  family: "primitives/actions",
  runtime: {
    source: "react-aria-components",
    exportName: "Separator",
  },
  defaultProps: {
    orientation: "horizontal",
    variant: "default",
    size: "md",
  },
  props: {
    accepts: separatorAccepts,
  },
  toRacProps: toSeparatorRacProps,
  skiaPrimitive: { kind: "separator" },
};

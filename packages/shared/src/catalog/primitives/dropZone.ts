import type { PrimitiveBinding } from "../types";
import {
  DROP_ZONE_SIZE_VALUES,
  toDropZoneRacProps,
  type DropZoneCanonicalProps,
  type DropZoneRacProps,
} from "../outputs/toRacProps";

const dropZoneAccepts = {
  label: {
    kind: "string",
    label: "Label",
    section: "content",
    default: "Drop files here",
  },
  description: {
    kind: "string",
    label: "Description",
    section: "content",
    default: "Upload files by dropping them in this area.",
  },
  size: {
    kind: "enum",
    label: "Size",
    section: "appearance",
    default: "md",
    options: DROP_ZONE_SIZE_VALUES.map((value) => ({
      value,
      label: value.toUpperCase(),
    })),
  },
  isDropTarget: {
    kind: "boolean",
    label: "Drop target",
    section: "state",
    default: false,
  },
  isDisabled: {
    kind: "boolean",
    label: "Disabled",
    section: "state",
    default: false,
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

export const dropZonePrimitiveBinding: PrimitiveBinding<
  DropZoneCanonicalProps,
  DropZoneRacProps
> = {
  tag: "DropZone",
  family: "overlays",
  runtime: {
    source: "react-aria-components",
    exportName: "DropZone",
  },
  defaultProps: {
    label: "Drop files here",
    description: "Upload files by dropping them in this area.",
    size: "md",
    isDropTarget: false,
    isDisabled: false,
  },
  props: {
    accepts: dropZoneAccepts,
  },
  toRacProps: toDropZoneRacProps,
  skiaPrimitive: { kind: "drop-zone" },
};

export const dropZoneInspectorThemeValues = {
  sizes: {
    DropZone: DROP_ZONE_SIZE_VALUES,
  },
  variants: {},
};

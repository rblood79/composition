import type { PrimitiveBinding } from "../types";
import {
  TOAST_POSITION_VALUES,
  TOAST_SIZE_VALUES,
  TOAST_VARIANT_VALUES,
  toToastRacProps,
  type ToastCanonicalProps,
  type ToastRacProps,
} from "../outputs/toRacProps";

const toastAccepts = {
  defaultTitle: {
    kind: "string",
    label: "Default title",
    section: "content",
    default: "Notification",
  },
  defaultDescription: {
    kind: "string",
    label: "Default description",
    section: "content",
    default: "Toast message content.",
    multiline: true,
    emptyToUndefined: true,
  },
  message: {
    kind: "string",
    label: "Message",
    section: "content",
    inspector: false,
  },
  variant: {
    kind: "enum",
    label: "Variant",
    section: "appearance",
    default: "info",
    options: TOAST_VARIANT_VALUES.map((value) => ({
      value,
      label: value[0]!.toUpperCase() + value.slice(1),
    })),
  },
  size: {
    kind: "enum",
    label: "Size",
    section: "appearance",
    default: "md",
    options: TOAST_SIZE_VALUES.map((value) => ({
      value,
      label: value.toUpperCase(),
    })),
  },
  position: {
    kind: "enum",
    label: "Position",
    section: "appearance",
    default: "bottom",
    options: TOAST_POSITION_VALUES.map((value) => ({
      value,
      label: value
        .split(" ")
        .map((part) => part[0]!.toUpperCase() + part.slice(1))
        .join(" "),
    })),
  },
  timeout: {
    kind: "number",
    label: "Timeout",
    section: "state",
    default: 5000,
    min: 0,
    step: 250,
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

export const toastPrimitiveBinding: PrimitiveBinding<
  ToastCanonicalProps,
  ToastRacProps
> = {
  tag: "Toast",
  family: "overlays",
  runtime: {
    source: "react-aria-components",
    exportName: "UNSTABLE_Toast",
  },
  defaultProps: {
    defaultTitle: "Notification",
    defaultDescription: "Toast message content.",
    variant: "info",
    size: "md",
    position: "bottom",
    timeout: 5000,
  },
  props: {
    accepts: toastAccepts,
  },
  toRacProps: toToastRacProps,
  skiaPrimitive: { kind: "toast" },
};

export const toastInspectorThemeValues = {
  variants: {
    Toast: TOAST_VARIANT_VALUES,
  },
  sizes: {
    Toast: TOAST_SIZE_VALUES,
  },
};

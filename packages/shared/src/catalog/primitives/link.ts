import type { PrimitiveBinding } from "../types";
import {
  LINK_SIZE_VALUES,
  LINK_STATIC_COLOR_VALUES,
  LINK_TARGET_VALUES,
  LINK_VARIANT_VALUES,
  toLinkRacProps,
  type LinkCanonicalProps,
  type LinkRacProps,
} from "../outputs/toRacProps";

const linkAccepts = {
  children: {
    kind: "string",
    label: "Text",
    section: "content",
    default: "Link",
  },
  text: {
    kind: "string",
    label: "Text",
    section: "content",
    inspector: false,
  },
  label: {
    kind: "string",
    label: "Label",
    section: "content",
    inspector: false,
  },
  href: {
    kind: "string",
    label: "Href",
    section: "content",
    placeholder: "https://example.com",
    emptyToUndefined: true,
  },
  variant: {
    kind: "variant",
    label: "Variant",
    section: "appearance",
    default: "primary",
  },
  size: {
    kind: "size",
    label: "Size",
    section: "appearance",
    default: "md",
  },
  staticColor: {
    kind: "enum",
    label: "Static color",
    section: "appearance",
    default: "auto",
    options: LINK_STATIC_COLOR_VALUES.map((value) => ({
      value,
      label: value[0]!.toUpperCase() + value.slice(1),
    })),
  },
  target: {
    kind: "enum",
    label: "Target",
    section: "state",
    options: LINK_TARGET_VALUES.map((value) => ({
      value,
      label: value,
    })),
  },
  rel: {
    kind: "string",
    label: "Rel",
    section: "state",
    emptyToUndefined: true,
  },
  isQuiet: {
    kind: "boolean",
    label: "Quiet",
    section: "state",
    default: false,
  },
  isExternal: {
    kind: "boolean",
    label: "External",
    section: "state",
    default: false,
  },
  showExternalIcon: {
    kind: "boolean",
    label: "Show external icon",
    section: "state",
    default: true,
  },
  isLoading: {
    kind: "boolean",
    label: "Loading",
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

export const linkPrimitiveBinding: PrimitiveBinding<
  LinkCanonicalProps,
  LinkRacProps
> = {
  tag: "Link",
  family: "primitives/actions",
  runtime: {
    source: "react-aria-components",
    exportName: "Link",
  },
  defaultProps: {
    children: "Link",
    href: "#",
    variant: "primary",
    size: "md",
    staticColor: "auto",
    showExternalIcon: true,
  },
  props: {
    accepts: linkAccepts,
  },
  toRacProps: toLinkRacProps,
  skiaPrimitive: { kind: "link" },
};

export const linkInspectorThemeValues = {
  variants: {
    Link: LINK_VARIANT_VALUES,
  },
  sizes: {
    Link: LINK_SIZE_VALUES,
  },
};

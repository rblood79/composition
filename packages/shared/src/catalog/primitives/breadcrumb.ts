import type { PrimitiveBinding } from "../types";
import {
  toBreadcrumbRacProps,
  type BreadcrumbCanonicalProps,
  type BreadcrumbRacProps,
} from "../outputs/toRacProps";

const breadcrumbAccepts = {
  children: {
    kind: "string",
    label: "Text",
    section: "content",
    default: "Breadcrumb",
  },
  label: {
    kind: "string",
    label: "Label",
    section: "content",
    inspector: false,
  },
  title: {
    kind: "string",
    label: "Title",
    section: "content",
    inspector: false,
  },
  href: {
    kind: "string",
    label: "Href",
    section: "content",
    default: "/",
    emptyToUndefined: true,
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

export const breadcrumbPrimitiveBinding: PrimitiveBinding<
  BreadcrumbCanonicalProps,
  BreadcrumbRacProps
> = {
  tag: "Breadcrumb",
  family: "primitives/actions",
  runtime: {
    source: "react-aria-components",
    exportName: "Breadcrumb",
  },
  defaultProps: {
    children: "Breadcrumb",
    href: "/",
    isDisabled: false,
  },
  props: {
    accepts: breadcrumbAccepts,
  },
  toRacProps: toBreadcrumbRacProps,
  skiaPrimitive: { kind: "breadcrumb" },
};

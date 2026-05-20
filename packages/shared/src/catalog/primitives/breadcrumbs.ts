import type { PrimitiveBinding } from "../types";
import {
  BREADCRUMBS_SIZE_VALUES,
  toBreadcrumbsRacProps,
  type BreadcrumbsCanonicalProps,
  type BreadcrumbsRacProps,
} from "../outputs/toRacProps";

const breadcrumbsAccepts = {
  "aria-label": {
    kind: "string",
    label: "ARIA label",
    section: "content",
    default: "Breadcrumbs",
  },
  size: {
    kind: "enum",
    label: "Size",
    section: "appearance",
    default: "M",
    options: BREADCRUMBS_SIZE_VALUES.map((value) => ({
      value,
      label: value,
    })),
  },
  showRoot: {
    kind: "boolean",
    label: "Show Root",
    section: "appearance",
    default: false,
  },
  isMultiline: {
    kind: "boolean",
    label: "Multiline",
    section: "appearance",
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

export const breadcrumbsPrimitiveBinding: PrimitiveBinding<
  BreadcrumbsCanonicalProps,
  BreadcrumbsRacProps
> = {
  tag: "Breadcrumbs",
  family: "primitives/actions",
  runtime: {
    source: "react-aria-components",
    exportName: "Breadcrumbs",
  },
  defaultProps: {
    "aria-label": "Breadcrumbs",
    size: "M",
    isDisabled: false,
  },
  props: {
    accepts: breadcrumbsAccepts,
  },
  toRacProps: toBreadcrumbsRacProps,
  placement: {
    kind: "node-with-children",
    children: [
      {
        type: "Breadcrumb",
        props: {
          children: "Home",
          href: "/",
          isDisabled: false,
        },
      },
      {
        type: "Breadcrumb",
        props: {
          children: "Category",
          href: "/category",
          isDisabled: false,
        },
      },
      {
        type: "Breadcrumb",
        props: {
          children: "Page",
          href: "/category/page",
          isDisabled: false,
        },
      },
    ],
  },
};

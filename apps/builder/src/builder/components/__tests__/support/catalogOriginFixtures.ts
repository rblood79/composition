import type { LegacyNodeFixture } from "../../../../lib/db/__tests__/support/legacyPayload";

/**
 * ADR-248 4e-13: the default origins the old catalog origin builder (`buildCatalogOrigin`, removed
 * with the old canonical store) produced for these types — frozen as the state variant tests'
 * input (same bytes as before).
 */
const ORIGINS: Record<string, LegacyNodeFixture> = {
  ToggleButton: {
    id: "component-togglebutton",
    type: "ToggleButton",
    name: "ToggleButton",
    reusable: true,
    props: {
      size: "md",
      staticColor: "auto",
      children: "Toggle Button",
      isEmphasized: false,
      isQuiet: false,
      isSelected: false,
      isDisabled: false,
    },
    metadata: {
      type: "catalog-origin",
      systemOwned: true,
      componentFamily: "ToggleButton",
    },
  },
  Switch: {
    id: "component-switch",
    type: "Switch",
    name: "Switch",
    reusable: true,
    props: {
      children: "Switch",
      name: "",
      isSelected: false,
      isDisabled: false,
      isReadOnly: false,
      style: {},
    },
    children: [
      {
        id: "component-switch__1",
        type: "Label",
        props: {
          children: "Switch",
        },
      },
    ],
    metadata: {
      type: "catalog-origin",
      systemOwned: true,
      componentFamily: "Switch",
    },
  },
  Button: {
    id: "component-button",
    type: "Button",
    name: "Button",
    reusable: true,
    props: {
      variant: "primary",
      size: "md",
      fillStyle: "fill",
      staticColor: "auto",
      type: "button",
      children: "Button",
      name: "",
      isDisabled: false,
      isPending: false,
    },
    metadata: {
      type: "catalog-origin",
      systemOwned: true,
      componentFamily: "Button",
    },
  },
  Link: {
    id: "component-link",
    type: "Link",
    name: "Link",
    reusable: true,
    props: {
      variant: "primary",
      size: "md",
      staticColor: "auto",
      children: "Link",
      href: "#",
      isDisabled: false,
    },
    metadata: {
      type: "catalog-origin",
      systemOwned: true,
      componentFamily: "Link",
    },
  },
  Checkbox: {
    id: "component-checkbox",
    type: "Checkbox",
    name: "Checkbox",
    reusable: true,
    props: {
      children: "Checkbox",
      name: "",
      value: "",
      isSelected: false,
      isDisabled: false,
      isIndeterminate: false,
      isInvalid: false,
      isReadOnly: false,
      isRequired: false,
      style: {},
    },
    children: [
      {
        id: "component-checkbox__1",
        type: "Label",
        props: {
          children: "Checkbox",
        },
      },
    ],
    metadata: {
      type: "catalog-origin",
      systemOwned: true,
      componentFamily: "Checkbox",
    },
  },
} as unknown as Record<string, LegacyNodeFixture>;

export function catalogOriginFixture(type: string): LegacyNodeFixture {
  const origin = ORIGINS[type];
  if (!origin) throw new Error(`no origin fixture for ${type}`);
  return structuredClone(origin);
}

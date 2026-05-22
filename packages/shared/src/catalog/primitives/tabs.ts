import type { PrimitiveBinding } from "../types";
import {
  TABS_DENSITY_VALUES,
  TABS_KEYBOARD_ACTIVATION_VALUES,
  TABS_ORIENTATION_VALUES,
  TABS_SIZE_VALUES,
  toTabsRacProps,
  type TabsCanonicalProps,
  type TabsRacProps,
} from "../outputs/toRacProps";

const tabsAccepts = {
  items: {
    kind: "binding",
    label: "Items",
    section: "content",
  },
  "aria-label": {
    kind: "string",
    label: "ARIA label",
    section: "content",
    default: "Tabs",
  },
  density: {
    kind: "enum",
    label: "Density",
    section: "appearance",
    default: "regular",
    options: TABS_DENSITY_VALUES.map((value) => ({
      value,
      label: value[0].toUpperCase() + value.slice(1),
    })),
  },
  size: {
    kind: "enum",
    label: "Size",
    section: "appearance",
    default: "md",
    options: TABS_SIZE_VALUES.map((value) => ({
      value,
      label: value.toUpperCase(),
    })),
  },
  orientation: {
    kind: "enum",
    label: "Orientation",
    section: "appearance",
    default: "horizontal",
    options: TABS_ORIENTATION_VALUES.map((value) => ({
      value,
      label: value[0].toUpperCase() + value.slice(1),
    })),
  },
  showIndicator: {
    kind: "boolean",
    label: "Show indicator",
    section: "appearance",
    default: true,
  },
  selectedKey: {
    kind: "string",
    label: "Selected key",
    section: "state",
  },
  defaultSelectedKey: {
    kind: "string",
    label: "Default selected key",
    section: "state",
  },
  isDisabled: {
    kind: "boolean",
    label: "Disabled",
    section: "state",
    default: false,
  },
  keyboardActivation: {
    kind: "enum",
    label: "Keyboard activation",
    section: "state",
    default: "automatic",
    options: TABS_KEYBOARD_ACTIVATION_VALUES.map((value) => ({
      value,
      label: value[0].toUpperCase() + value.slice(1),
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

export const tabsPrimitiveBinding: PrimitiveBinding<
  TabsCanonicalProps,
  TabsRacProps
> = {
  tag: "Tabs",
  family: "collections",
  runtime: {
    source: "react-aria-components",
    exportName: "Tabs",
  },
  defaultProps: {
    "aria-label": "Tabs",
    density: "regular",
    size: "md",
    orientation: "horizontal",
    selectedKey: "overview",
    showIndicator: true,
    isDisabled: false,
    keyboardActivation: "automatic",
    items: [
      {
        id: "overview",
        label: "Overview",
        content: "Overview content",
      },
      {
        id: "details",
        label: "Details",
        content: "Details content",
      },
      {
        id: "settings",
        label: "Settings",
        content: "Settings content",
      },
    ],
  },
  props: {
    accepts: tabsAccepts,
  },
  toRacProps: toTabsRacProps,
  placement: {
    kind: "node-with-children",
    children: [
      {
        type: "TabList",
        props: {},
        children: [
          { type: "Tab", props: { id: "overview", children: "Overview" } },
          { type: "Tab", props: { id: "details", children: "Details" } },
          { type: "Tab", props: { id: "settings", children: "Settings" } },
        ],
      },
      {
        type: "TabPanels",
        props: {},
        children: [
          { type: "TabPanel", props: { itemId: "overview" } },
          { type: "TabPanel", props: { itemId: "details" } },
          { type: "TabPanel", props: { itemId: "settings" } },
        ],
      },
    ],
  },
  skiaPrimitive: { kind: "tabs" },
};

export const tabsInspectorThemeValues = {
  sizes: {
    Tabs: TABS_SIZE_VALUES,
  },
};

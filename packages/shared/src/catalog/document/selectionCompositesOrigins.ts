import type { LibraryDefinition, LibraryTemplateNode } from "./types";

export const SELECTION_COMPOSITE_DEFINITIONS: readonly LibraryDefinition[] = [
  {
    id: "lib:definition:origin-component-actionbar",
    name: "ActionBar",
    mode: "composite",
    accepts: {
      selectedItemCount: "selectionCount",
      isEmphasized: "boolean",
    },
    defaults: {
      selectedItemCount: 1,
      isEmphasized: false,
    },
    visual: {},
    stateRules: {},
    templateRootId: "lib:template:component-actionbar",
  },
  {
    id: "lib:definition:origin-component-selectboxgroup",
    name: "SelectBoxGroup",
    mode: "composite",
    accepts: {
      orientation: "string",
      selectionMode: "string",
      isDisabled: "boolean",
    },
    defaults: {
      orientation: "vertical",
      selectionMode: "single",
      isDisabled: false,
    },
    visual: {},
    stateRules: {},
    templateRootId: "lib:template:component-selectboxgroup",
  },
  {
    id: "lib:definition:origin-component-selectbox",
    name: "SelectBox",
    mode: "composite",
    accepts: {
      label: "string",
      description: "string",
      icon: "string",
      id: "string",
      isSelected: "boolean",
      isDisabled: "boolean",
    },
    defaults: {
      label: "Option",
      description: "Description",
      icon: "image",
      isSelected: false,
      isDisabled: false,
    },
    visual: {},
    stateRules: {},
    templateRootId: "lib:template:component-selectbox",
  },
  {
    id: "lib:definition:origin-component-actionbutton",
    name: "ActionButton",
    mode: "composite",
    accepts: {
      label: "string",
      icon: "string",
      size: "string",
      staticColor: "string",
      type: "string",
      isQuiet: "boolean",
      isDisabled: "boolean",
      isPending: "boolean",
    },
    defaults: {
      label: "Action",
      size: "M",
      staticColor: "auto",
      type: "button",
      isQuiet: false,
      isPending: false,
    },
    visual: {},
    stateRules: {},
    templateRootId: "lib:template:component-actionbutton",
  },
  {
    id: "lib:definition:origin-component-checkbox",
    name: "Checkbox",
    mode: "composite",
    accepts: {
      slot: "slot",
      children: "string",
      description: "string",
      errorMessage: "string",
    },
    defaults: {
      children: "Checkbox",
      description: "",
      errorMessage: "",
    },
    visual: {},
    stateRules: {},
    templateRootId: "lib:template:component-checkbox",
  },
];

export const SELECTION_COMPOSITE_TEMPLATES: readonly LibraryTemplateNode[] = [
  {
    id: "lib:template:component-actionbar",
    definitionId: "lib:definition:type-ActionBar",
    children: [
      "lib:template:component-actionbar__summary",
      "lib:template:component-actionbar__actions",
    ],
    props: {
      selectedItemCount: 1,
    },
    visual: {},
  },
  {
    id: "lib:template:component-actionbar__summary",
    definitionId: "lib:definition:type-frame",
    children: [
      "lib:template:component-actionbar__clear",
      "lib:template:component-actionbar__count",
    ],
    props: {},
    visual: {},
    layout: {
      display: "flex",
      alignItems: "center",
      columnGap: "4px",
    },
  },
  {
    id: "lib:template:component-actionbar__clear",
    definitionId: "lib:definition:origin-component-actionbutton",
    children: [],
    props: {
      slot: "clear",
      label: "",
      icon: "x",
      isQuiet: true,
    },
    visual: {},
  },
  {
    id: "lib:template:component-actionbar__count",
    definitionId: "lib:definition:text",
    children: [],
    props: {
      children: "{selectedCountText}",
    },
    visual: {},
  },
  {
    id: "lib:template:component-actionbar__actions",
    definitionId: "lib:definition:type-ActionButtonGroup",
    children: [
      "lib:template:component-actionbar__action1",
      "lib:template:component-actionbar__action2",
    ],
    props: {
      isQuiet: true,
    },
    visual: {},
    layout: {
      flexGrow: "1",
      justifyContent: "flex-end",
    },
  },
  {
    id: "lib:template:component-actionbar__action1",
    definitionId: "lib:definition:origin-component-actionbutton",
    children: [],
    props: {
      label: "Edit",
      isQuiet: true,
    },
    visual: {},
  },
  {
    id: "lib:template:component-actionbar__action2",
    definitionId: "lib:definition:origin-component-actionbutton",
    children: [],
    props: {
      label: "Delete",
      isQuiet: true,
    },
    visual: {},
  },
  {
    id: "lib:template:component-selectboxgroup",
    definitionId: "lib:definition:type-SelectBoxGroup",
    children: [
      "lib:template:component-selectboxgroup__one",
      "lib:template:component-selectboxgroup__two",
    ],
    props: {
      orientation: "vertical",
      selectionMode: "single",
      "aria-label": "Options",
    },
    visual: {},
  },
  {
    id: "lib:template:component-selectboxgroup__one",
    definitionId: "lib:definition:origin-component-selectbox",
    children: [],
    props: {
      label: "Option one",
      id: "one",
      isSelected: true,
    },
    visual: {},
  },
  {
    id: "lib:template:component-selectboxgroup__two",
    definitionId: "lib:definition:origin-component-selectbox",
    children: [],
    props: {
      label: "Option two",
      id: "two",
    },
    visual: {},
  },
  {
    id: "lib:template:component-selectbox",
    definitionId: "lib:definition:type-SelectBox",
    children: [
      "lib:template:component-selectbox__selection",
      "lib:template:component-selectbox__icon",
      "lib:template:component-selectbox__content",
    ],
    props: {},
    visual: {},
  },
  {
    id: "lib:template:component-selectbox__content",
    definitionId: "lib:definition:type-frame",
    children: [
      "lib:template:component-selectbox__label",
      "lib:template:component-selectbox__description",
    ],
    props: {},
    visual: {},
    layout: {
      display: "flex",
      flexDirection: "column",
      rowGap: "2px",
    },
  },
  {
    id: "lib:template:component-selectbox__selection",
    definitionId: "lib:definition:origin-component-checkbox",
    children: [],
    props: {
      slot: "selection",
      children: "",
    },
    visual: {},
    layout: {
      position: "absolute",
      insetTop: "8px",
      insetLeft: "8px",
    },
  },
  {
    id: "lib:template:component-selectbox__icon",
    definitionId: "lib:definition:type-Icon",
    children: [],
    props: {
      slot: "illustration",
      iconName: "{icon}",
    },
    visual: {
      width: 48,
      height: 48,
    },
  },
  {
    id: "lib:template:component-selectbox__label",
    definitionId: "lib:definition:text",
    children: [],
    props: {
      slot: "label",
      children: "{label}",
    },
    visual: {
      textAlign: "center",
      whiteSpace: "nowrap",
    },
  },
  {
    id: "lib:template:component-selectbox__description",
    definitionId: "lib:definition:text",
    children: [],
    props: {
      slot: "description",
      children: "{description}",
    },
    visual: {
      textAlign: "left",
    },
  },
  {
    id: "lib:template:component-actionbutton",
    definitionId: "lib:definition:type-ActionButton",
    children: [
      "lib:template:component-actionbutton__icon",
      "lib:template:component-actionbutton__label",
    ],
    props: {
      size: "M",
      staticColor: "auto",
      type: "button",
      isQuiet: false,
      isPending: false,
    },
    visual: {},
  },
  {
    id: "lib:template:component-actionbutton__icon",
    definitionId: "lib:definition:type-Icon",
    children: [],
    props: {
      slot: "icon",
      iconName: "{icon}",
    },
    visual: {},
  },
  {
    id: "lib:template:component-actionbutton__label",
    definitionId: "lib:definition:text",
    children: [],
    props: {
      slot: "label",
      children: "{label}",
    },
    visual: {},
    presentWhen: "nonEmptyText",
  },
  {
    id: "lib:template:component-checkbox",
    definitionId: "lib:definition:type-Checkbox",
    children: [
      "lib:template:component-checkbox__button",
      "lib:template:component-checkbox__description",
      "lib:template:component-checkbox__error",
    ],
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
    },
    visual: {},
    displayState: "selected",
  },
  {
    id: "lib:template:component-checkbox__button",
    definitionId: "lib:definition:type-CheckboxButton",
    children: [
      "lib:template:component-checkbox__indicator",
      "lib:template:component-checkbox__1",
    ],
    props: {},
    visual: {},
  },
  {
    id: "lib:template:component-checkbox__indicator",
    definitionId: "lib:definition:type-CheckboxIndicator",
    children: [],
    props: {},
    visual: {},
  },
  {
    id: "lib:template:component-checkbox__1",
    definitionId: "lib:definition:type-Label",
    children: [],
    props: {
      children: "{children}",
    },
    presentWhen: "nonEmptyText",
    visual: {},
  },
  {
    id: "lib:template:component-checkbox__description",
    definitionId: "lib:definition:origin-component-description",
    children: [],
    props: {
      children: "{description}",
    },
    presentWhen: "nonEmptyText",
    visual: {},
  },
  {
    id: "lib:template:component-checkbox__error",
    definitionId: "lib:definition:origin-component-fielderror",
    children: [],
    props: {
      children: "{errorMessage}",
    },
    visual: {},
  },
];

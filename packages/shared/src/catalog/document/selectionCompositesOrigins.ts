import type { LibraryDefinition, LibraryTemplateNode } from "./types";

export const SELECTION_COMPOSITE_DEFINITIONS: readonly LibraryDefinition[] = [
  {
    id: "lib:definition:origin-component-actionbar",
    name: "ActionBar",
    mode: "composite",
    accepts: {
      slot: "slot",
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
      slot: "slot",
      selectedKeys: "selectionKeys",
      defaultSelectedKeys: "selectionKeys",
      disabledKeys: "string[]",
      autoFocus: "autoFocus",
      escapeKeyBehavior: "string",
      disallowEmptySelection: "boolean",
      "aria-label": "string",
      "aria-labelledby": "string",
      "aria-describedby": "string",
      "aria-details": "string",
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
      textValue: "string",
      "aria-label": "string",
      label: "string",
      description: "string",
      icon: "string",
      id: "string",
      isDisabled: "boolean",
    },
    defaults: {
      label: "Option",
      description: "Description",
      icon: "image",
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
      slot: "slot",
      label: "string",
      icon: "string",
      // (2026-11-14) S2 Avatar · NotificationBadge children — the image URL and the count.
      avatar: "string",
      badge: "number",
      size: "string",
      staticColor: "string",
      type: "string",
      isQuiet: "boolean",
      isDisabled: "boolean",
      isPending: "boolean",
    },
    defaults: {
      label: "Action",
      avatar: "",
      size: "M",
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
    slot: { name: "Actions", required: false },
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
    slot: { name: "Items", required: false },
    children: [
      "lib:template:component-selectboxgroup__one",
      "lib:template:component-selectboxgroup__two",
    ],
    props: {
      orientation: "vertical",
      selectionMode: "single",
      // (ADR-308: the group holds its selection — Option one.)
      defaultSelectedKeys: ["one"],
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
    // S2 `SelectBox`: the illustration, label and description are the item's own children (its grid
    // places them — the rule's orientation blocks), as a ListBoxItem's label and description are; no
    // wrapper frame (2026-11-08 사용자 「frame 으로 wrap 할 필요가 없다」).
    children: [
      "lib:template:component-selectbox__selection",
      "lib:template:component-selectbox__icon",
      "lib:template:component-selectbox__label",
      "lib:template:component-selectbox__description",
    ],
    props: {},
    visual: {},
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
    // S2 `IllustrationContext` size S (`illustrationStyles` 48, `minSize: 48`) — the glyph size, its
    // box follows (`glyphSize.ts`). A box alone (width · height 48) left the glyph at the Icon's
    // M step 18 (2026-11-07 사용자 보고).
    visual: {
      fontSize: 48,
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
    // (Its alignment is the rule's per orientation — S2 `labelText` center · horizontal start.)
    visual: {
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
    visual: {},
  },
  {
    id: "lib:template:component-actionbutton",
    definitionId: "lib:definition:type-ActionButton",
    children: [
      // (2026-11-14) S2 order: `<Icon /> or <Avatar />`, `<Text />`, `<NotificationBadge />`.
      "lib:template:component-actionbutton__avatar",
      "lib:template:component-actionbutton__icon",
      "lib:template:component-actionbutton__label",
      "lib:template:component-actionbutton__badge",
    ],
    props: {
      size: "M",
      type: "button",
      isQuiet: false,
      isPending: false,
    },
    visual: {},
  },
  {
    // (S2 `AvatarContext` in the button: one line tall — `size: '1lh'`; there with an image.)
    id: "lib:template:component-actionbutton__avatar",
    definitionId: "lib:definition:type-Avatar",
    children: [],
    props: {
      slot: "avatar",
      src: "{avatar}",
      size: "1lh",
    },
    visual: {},
  },
  {
    // (S2 NotificationBadge — the count; there with a value, `catalogNotificationBadgeText`.)
    id: "lib:template:component-actionbutton__badge",
    definitionId: "lib:definition:type-Badge",
    children: [],
    props: {
      value: "{badge}",
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
    // (2026-11-15: S2 — a toggle's label wraps in its `1fr` column; a Label binding is one line otherwise.)
    visual: { whiteSpace: "normal" },
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

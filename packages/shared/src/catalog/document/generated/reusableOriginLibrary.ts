// ADR-248 Phase 3 — typed reusable origin library (code-catalog source of truth).
// Converted once from the Builder origin seed (catalogOrigins.ts + template ensurers) by
// apps/builder/src/builder/catalogRuntime/__tests__/phase3ReusableOriginTemplates.test.ts
// (ADR248_WRITE_REUSABLE_ORIGINS=1), which also compares it against that seed. The runtime
// reads only this module — never canonical nodes. Canonical-only fields are listed in
// docs/adr/design/248-phase3-reusable-origin-contract-gaps.json.
import type { LibraryDefinition, LibraryTemplateNode } from "../types";

export const REUSABLE_ORIGIN_DEFINITIONS: readonly LibraryDefinition[] = [
  {
    "id": "lib:definition:origin-component-listbox-item-default",
    "name": "ListBoxItem/Selected",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-listbox-item-default"
  },
  {
    "id": "lib:definition:origin-component-listbox-item-default--unselected",
    "name": "ListBoxItem/Default",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-listbox-item-default--unselected"
  },
  {
    "id": "lib:definition:origin-component-listbox-item-default--disabled",
    "name": "ListBoxItem/Selected/Disabled",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-listbox-item-default--disabled"
  },
  {
    "id": "lib:definition:origin-component-listbox-item-default--hover",
    "name": "ListBoxItem/Selected/Hover",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-listbox-item-default--hover"
  },
  {
    "id": "lib:definition:origin-component-listbox-item-default--pressed",
    "name": "ListBoxItem/Selected/Pressed",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-listbox-item-default--pressed"
  },
  {
    "id": "lib:definition:origin-component-listbox-item-default--focus-visible",
    "name": "ListBoxItem/Selected/Focus",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-listbox-item-default--focus-visible"
  },
  {
    "id": "lib:definition:origin-component-listbox",
    "name": "ListBox",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-listbox"
  },
  {
    "id": "lib:definition:origin-component-gridlist-item-default",
    "name": "GridListItem/Default",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-gridlist-item-default"
  },
  {
    "id": "lib:definition:origin-component-gridlist-item-default--unselected",
    "name": "GridListItem/Default/Unselected",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-gridlist-item-default--unselected"
  },
  {
    "id": "lib:definition:origin-component-gridlist-item-default--disabled",
    "name": "GridListItem/Default/Disabled",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-gridlist-item-default--disabled"
  },
  {
    "id": "lib:definition:origin-component-gridlist-item-default--hover",
    "name": "GridListItem/Default/Hover",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-gridlist-item-default--hover"
  },
  {
    "id": "lib:definition:origin-component-gridlist-item-default--pressed",
    "name": "GridListItem/Default/Pressed",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-gridlist-item-default--pressed"
  },
  {
    "id": "lib:definition:origin-component-gridlist-item-default--focus-visible",
    "name": "GridListItem/Default/Focus",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-gridlist-item-default--focus-visible"
  },
  {
    "id": "lib:definition:origin-component-gridlist",
    "name": "GridList",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-gridlist"
  },
  {
    "id": "lib:definition:origin-component-menu-item-default",
    "name": "MenuItem/Default",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-menu-item-default"
  },
  {
    "id": "lib:definition:origin-component-menu-item-default--disabled",
    "name": "MenuItem/Default/Disabled",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-menu-item-default--disabled"
  },
  {
    "id": "lib:definition:origin-component-menu-item-default--hover",
    "name": "MenuItem/Default/Hover",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-menu-item-default--hover"
  },
  {
    "id": "lib:definition:origin-component-menu-item-default--pressed",
    "name": "MenuItem/Default/Pressed",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-menu-item-default--pressed"
  },
  {
    "id": "lib:definition:origin-component-menu-item-default--focus-visible",
    "name": "MenuItem/Default/Focus",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-menu-item-default--focus-visible"
  },
  {
    "id": "lib:definition:origin-component-toolbar",
    "name": "Toolbar",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-toolbar"
  },
  {
    "id": "lib:definition:origin-component-form",
    "name": "Form",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-form"
  },
  {
    "id": "lib:definition:origin-component-iconbutton",
    "name": "IconButton",
    "mode": "composite",
    "accepts": {
      "label": "string",
      "icon": "string",
      "variant": "string",
      "size": "string",
      "staticColor": "string",
      "isDisabled": "boolean"
    },
    "defaults": {
      "label": "Button",
      "icon": "star",
      "variant": "primary",
      "size": "md",
      "staticColor": "auto",
      "isDisabled": false
    },
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-iconbutton"
  },
  {
    "id": "lib:definition:origin-component-iconbutton--disabled",
    "name": "IconButton/Disabled",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-iconbutton--disabled"
  },
  {
    "id": "lib:definition:origin-component-iconbutton--hover",
    "name": "IconButton/Hover",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-iconbutton--hover"
  },
  {
    "id": "lib:definition:origin-component-iconbutton--pressed",
    "name": "IconButton/Pressed",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-iconbutton--pressed"
  },
  {
    "id": "lib:definition:origin-component-iconbutton--focus-visible",
    "name": "IconButton/Focus",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-iconbutton--focus-visible"
  },
  {
    "id": "lib:definition:origin-component-inline-alert",
    "name": "InlineAlert",
    "mode": "composite",
    "accepts": {
      "title": "string",
      "description": "string",
      "variant": "string"
    },
    "defaults": {
      "title": "Alert Heading",
      "description": "There was an error processing your request. Please try again.",
      "variant": "info"
    },
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-inline-alert"
  },
  {
    "id": "lib:definition:origin-component-card",
    "name": "Card",
    "mode": "composite",
    "accepts": {
      "title": "string",
      "description": "string",
      "variant": "string",
      "size": "string"
    },
    "defaults": {
      "title": "Card Title",
      "description": "Card description text goes here.",
      "variant": "primary",
      "size": "md"
    },
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-card"
  },
  {
    "id": "lib:definition:origin-component-badge",
    "name": "Badge",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-badge"
  },
  {
    "id": "lib:definition:origin-component-progressbar",
    "name": "ProgressBar",
    "mode": "composite",
    "accepts": {
      "label": "string"
    },
    "defaults": {
      "label": "Progress"
    },
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-progressbar"
  },
  {
    "id": "lib:definition:origin-component-avatar",
    "name": "Avatar",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-avatar"
  },
  {
    "id": "lib:definition:origin-component-avatargroup",
    "name": "AvatarGroup",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-avatargroup"
  },
  {
    "id": "lib:definition:origin-component-statuslight",
    "name": "StatusLight",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-statuslight"
  },
  {
    "id": "lib:definition:origin-component-progresscircle",
    "name": "ProgressCircle",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-progresscircle"
  },
  {
    "id": "lib:definition:origin-component-breadcrumb-item-default",
    "name": "Breadcrumb/Default",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-breadcrumb-item-default"
  },
  {
    "id": "lib:definition:origin-component-breadcrumb-item-default--current",
    "name": "Breadcrumb/Default/Current",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-breadcrumb-item-default--current"
  },
  {
    "id": "lib:definition:origin-component-breadcrumbs",
    "name": "Breadcrumbs",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-breadcrumbs"
  },
  {
    "id": "lib:definition:origin-component-link",
    "name": "Link",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-link"
  },
  {
    "id": "lib:definition:origin-component-link--disabled",
    "name": "Link/Disabled",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-link--disabled"
  },
  {
    "id": "lib:definition:origin-component-link--hover",
    "name": "Link/Hover",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-link--hover"
  },
  {
    "id": "lib:definition:origin-component-link--pressed",
    "name": "Link/Pressed",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-link--pressed"
  },
  {
    "id": "lib:definition:origin-component-link--focus-visible",
    "name": "Link/Focus",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-link--focus-visible"
  },
  {
    "id": "lib:definition:origin-component-nav",
    "name": "Nav",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-nav"
  },
  {
    "id": "lib:definition:origin-component-pagination",
    "name": "Pagination",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-pagination"
  },
  {
    "id": "lib:definition:origin-component-disclosuregroup",
    "name": "DisclosureGroup",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-disclosuregroup"
  },
  {
    "id": "lib:definition:origin-component-disclosure",
    "name": "Disclosure",
    "mode": "composite",
    "accepts": {
      "title": "string"
    },
    "defaults": {
      "title": "Section Title"
    },
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-disclosure"
  },
  {
    "id": "lib:definition:origin-component-disclosure--collapsed",
    "name": "Disclosure/Collapsed",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-disclosure--collapsed"
  },
  {
    "id": "lib:definition:origin-component-cardview",
    "name": "CardView",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-cardview"
  },
  {
    "id": "lib:definition:origin-component-button",
    "name": "Button",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-button"
  },
  {
    "id": "lib:definition:origin-component-button--disabled",
    "name": "Button/Disabled",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-button--disabled"
  },
  {
    "id": "lib:definition:origin-component-button--hover",
    "name": "Button/Hover",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-button--hover"
  },
  {
    "id": "lib:definition:origin-component-button--pressed",
    "name": "Button/Pressed",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-button--pressed"
  },
  {
    "id": "lib:definition:origin-component-button--focus-visible",
    "name": "Button/Focus",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-button--focus-visible"
  },
  {
    "id": "lib:definition:origin-component-togglebutton",
    "name": "ToggleButton",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-togglebutton"
  },
  {
    "id": "lib:definition:origin-component-togglebutton--unselected",
    "name": "ToggleButton/Unselected",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-togglebutton--unselected"
  },
  {
    "id": "lib:definition:origin-component-togglebutton--disabled",
    "name": "ToggleButton/Disabled",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-togglebutton--disabled"
  },
  {
    "id": "lib:definition:origin-component-togglebutton--hover",
    "name": "ToggleButton/Hover",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-togglebutton--hover"
  },
  {
    "id": "lib:definition:origin-component-togglebutton--pressed",
    "name": "ToggleButton/Pressed",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-togglebutton--pressed"
  },
  {
    "id": "lib:definition:origin-component-togglebutton--focus-visible",
    "name": "ToggleButton/Focus",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-togglebutton--focus-visible"
  },
  {
    "id": "lib:definition:origin-component-togglebuttongroup",
    "name": "ToggleButtonGroup",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-togglebuttongroup"
  },
  {
    "id": "lib:definition:origin-component-buttongroup",
    "name": "ButtonGroup",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-buttongroup"
  },
  {
    "id": "lib:definition:origin-component-menu",
    "name": "Menu",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-menu"
  },
  {
    "id": "lib:definition:origin-component-textfield",
    "name": "TextField",
    "mode": "composite",
    "accepts": {
      "label": "string",
      "placeholder": "string",
      "type": "string",
      "errorMessage": "string"
    },
    "defaults": {
      "label": "Text Field",
      "placeholder": "Enter text...",
      "type": "text",
      "errorMessage": ""
    },
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-textfield"
  },
  {
    "id": "lib:definition:origin-component-textarea",
    "name": "TextArea",
    "mode": "composite",
    "accepts": {
      "label": "string",
      "placeholder": "string",
      "errorMessage": "string"
    },
    "defaults": {
      "label": "Text Area",
      "placeholder": "Enter text...",
      "errorMessage": ""
    },
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-textarea"
  },
  {
    "id": "lib:definition:origin-component-numberfield",
    "name": "NumberField",
    "mode": "composite",
    "accepts": {
      "label": "string",
      "errorMessage": "string"
    },
    "defaults": {
      "label": "Number",
      "errorMessage": ""
    },
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-numberfield"
  },
  {
    "id": "lib:definition:origin-component-searchfield",
    "name": "SearchField",
    "mode": "composite",
    "accepts": {
      "label": "string"
    },
    "defaults": {
      "label": "Search"
    },
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-searchfield"
  },
  {
    "id": "lib:definition:origin-component-colorfield",
    "name": "ColorField",
    "mode": "composite",
    "accepts": {
      "label": "string"
    },
    "defaults": {
      "label": "Color"
    },
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-colorfield"
  },
  {
    "id": "lib:definition:origin-component-checkbox",
    "name": "Checkbox",
    "mode": "composite",
    "accepts": {
      "children": "string"
    },
    "defaults": {
      "children": "Checkbox"
    },
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-checkbox"
  },
  {
    "id": "lib:definition:origin-component-checkbox--unselected",
    "name": "Checkbox/Unselected",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-checkbox--unselected"
  },
  {
    "id": "lib:definition:origin-component-checkbox--disabled",
    "name": "Checkbox/Disabled",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-checkbox--disabled"
  },
  {
    "id": "lib:definition:origin-component-checkbox--hover",
    "name": "Checkbox/Hover",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-checkbox--hover"
  },
  {
    "id": "lib:definition:origin-component-checkbox--pressed",
    "name": "Checkbox/Pressed",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-checkbox--pressed"
  },
  {
    "id": "lib:definition:origin-component-checkbox--focus-visible",
    "name": "Checkbox/Focus",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-checkbox--focus-visible"
  },
  {
    "id": "lib:definition:origin-component-checkboxgroup",
    "name": "CheckboxGroup",
    "mode": "composite",
    "accepts": {
      "label": "string"
    },
    "defaults": {
      "label": "Checkbox Group"
    },
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-checkboxgroup"
  },
  {
    "id": "lib:definition:origin-component-radiogroup",
    "name": "RadioGroup",
    "mode": "composite",
    "accepts": {
      "label": "string"
    },
    "defaults": {
      "label": "Radio Group"
    },
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-radiogroup"
  },
  {
    "id": "lib:definition:origin-component-select",
    "name": "Select",
    "mode": "composite",
    "accepts": {
      "label": "string"
    },
    "defaults": {
      "label": "Select"
    },
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-select"
  },
  {
    "id": "lib:definition:origin-component-combobox",
    "name": "ComboBox",
    "mode": "composite",
    "accepts": {
      "label": "string"
    },
    "defaults": {
      "label": "Combo Box"
    },
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-combobox"
  },
  {
    "id": "lib:definition:origin-component-switch",
    "name": "Switch",
    "mode": "composite",
    "accepts": {
      "children": "string"
    },
    "defaults": {
      "children": "Switch"
    },
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-switch"
  },
  {
    "id": "lib:definition:origin-component-switch--unselected",
    "name": "Switch/Unselected",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-switch--unselected"
  },
  {
    "id": "lib:definition:origin-component-switch--disabled",
    "name": "Switch/Disabled",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-switch--disabled"
  },
  {
    "id": "lib:definition:origin-component-switch--hover",
    "name": "Switch/Hover",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-switch--hover"
  },
  {
    "id": "lib:definition:origin-component-switch--pressed",
    "name": "Switch/Pressed",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-switch--pressed"
  },
  {
    "id": "lib:definition:origin-component-switch--focus-visible",
    "name": "Switch/Focus",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-switch--focus-visible"
  },
  {
    "id": "lib:definition:origin-component-slider",
    "name": "Slider",
    "mode": "composite",
    "accepts": {
      "label": "string"
    },
    "defaults": {
      "label": "Slider"
    },
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-slider"
  },
  {
    "id": "lib:definition:origin-component-meter",
    "name": "Meter",
    "mode": "composite",
    "accepts": {
      "label": "string"
    },
    "defaults": {
      "label": "Storage"
    },
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-meter"
  },
  {
    "id": "lib:definition:origin-component-dropzone",
    "name": "DropZone",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-dropzone"
  },
  {
    "id": "lib:definition:origin-component-filetrigger",
    "name": "FileTrigger",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-filetrigger"
  },
  {
    "id": "lib:definition:origin-component-fileupload",
    "name": "FileUpload",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-fileupload"
  },
  {
    "id": "lib:definition:origin-component-table",
    "name": "Table",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-table"
  },
  {
    "id": "lib:definition:origin-component-tree",
    "name": "Tree",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-tree"
  },
  {
    "id": "lib:definition:origin-component-tableview",
    "name": "TableView",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-tableview"
  },
  {
    "id": "lib:definition:origin-component-chart",
    "name": "Chart",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-chart"
  },
  {
    "id": "lib:definition:origin-component-calendar",
    "name": "Calendar",
    "mode": "composite",
    "accepts": {
      "locale": "string",
      "calendarSystem": "string"
    },
    "defaults": {
      "locale": "ko-KR",
      "calendarSystem": ""
    },
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-calendar"
  },
  {
    "id": "lib:definition:origin-component-datepicker",
    "name": "DatePicker",
    "mode": "composite",
    "accepts": {
      "label": "string"
    },
    "defaults": {
      "label": "Date Picker"
    },
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-datepicker"
  },
  {
    "id": "lib:definition:origin-component-daterangepicker",
    "name": "DateRangePicker",
    "mode": "composite",
    "accepts": {
      "label": "string"
    },
    "defaults": {
      "label": "Date Range"
    },
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-daterangepicker"
  },
  {
    "id": "lib:definition:origin-component-datefield",
    "name": "DateField",
    "mode": "composite",
    "accepts": {
      "label": "string",
      "errorMessage": "string"
    },
    "defaults": {
      "label": "Date Field",
      "errorMessage": ""
    },
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-datefield"
  },
  {
    "id": "lib:definition:origin-component-timefield",
    "name": "TimeField",
    "mode": "composite",
    "accepts": {
      "label": "string",
      "errorMessage": "string"
    },
    "defaults": {
      "label": "Time",
      "errorMessage": ""
    },
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-timefield"
  },
  {
    "id": "lib:definition:origin-component-rangecalendar",
    "name": "RangeCalendar",
    "mode": "composite",
    "accepts": {
      "locale": "string",
      "calendarSystem": "string"
    },
    "defaults": {
      "locale": "ko-KR",
      "calendarSystem": ""
    },
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-rangecalendar"
  },
  {
    "id": "lib:definition:origin-component-dialog",
    "name": "Dialog",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-dialog"
  },
  {
    "id": "lib:definition:origin-component-popover",
    "name": "Popover",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-popover"
  },
  {
    "id": "lib:definition:origin-component-tooltip",
    "name": "Tooltip",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-tooltip"
  },
  {
    "id": "lib:definition:origin-component-label",
    "name": "Label",
    "mode": "composite",
    "accepts": {
      "children": "string"
    },
    "defaults": {
      "children": "Label"
    },
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-label"
  },
  {
    "id": "lib:definition:origin-component-radio",
    "name": "Radio",
    "mode": "composite",
    "accepts": {
      "children": "string"
    },
    "defaults": {
      "children": "Radio"
    },
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-radio"
  },
  {
    "id": "lib:definition:origin-component-radio--unselected",
    "name": "Radio/Unselected",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-radio--unselected"
  },
  {
    "id": "lib:definition:origin-component-radio--disabled",
    "name": "Radio/Disabled",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-radio--disabled"
  },
  {
    "id": "lib:definition:origin-component-radio--hover",
    "name": "Radio/Hover",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-radio--hover"
  },
  {
    "id": "lib:definition:origin-component-radio--pressed",
    "name": "Radio/Pressed",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-radio--pressed"
  },
  {
    "id": "lib:definition:origin-component-radio--focus-visible",
    "name": "Radio/Focus",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-radio--focus-visible"
  },
  {
    "id": "lib:definition:origin-component-colorswatchpicker",
    "name": "ColorSwatchPicker",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-colorswatchpicker"
  },
  {
    "id": "lib:definition:origin-component-colorswatch",
    "name": "ColorSwatch",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-colorswatch"
  },
  {
    "id": "lib:definition:origin-component-tab-item-default",
    "name": "Tab/Selected",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-tab-item-default"
  },
  {
    "id": "lib:definition:origin-component-tab-item-default--unselected",
    "name": "Tab/Default",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-tab-item-default--unselected"
  },
  {
    "id": "lib:definition:origin-component-tab-item-default--disabled",
    "name": "Tab/Selected/Disabled",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-tab-item-default--disabled"
  },
  {
    "id": "lib:definition:origin-component-tab-item-default--hover",
    "name": "Tab/Selected/Hover",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-tab-item-default--hover"
  },
  {
    "id": "lib:definition:origin-component-tab-item-default--pressed",
    "name": "Tab/Selected/Pressed",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-tab-item-default--pressed"
  },
  {
    "id": "lib:definition:origin-component-tab-item-default--focus-visible",
    "name": "Tab/Selected/Focus",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-tab-item-default--focus-visible"
  },
  {
    "id": "lib:definition:origin-component-tabs",
    "name": "Tabs",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-tabs"
  },
  {
    "id": "lib:definition:origin-component-tag-item-default",
    "name": "Tag/Selected",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-tag-item-default"
  },
  {
    "id": "lib:definition:origin-component-tag-item-default--unselected",
    "name": "Tag/Default",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-tag-item-default--unselected"
  },
  {
    "id": "lib:definition:origin-component-tag-item-default--disabled",
    "name": "Tag/Selected/Disabled",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-tag-item-default--disabled"
  },
  {
    "id": "lib:definition:origin-component-tag-item-default--hover",
    "name": "Tag/Selected/Hover",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-tag-item-default--hover"
  },
  {
    "id": "lib:definition:origin-component-tag-item-default--pressed",
    "name": "Tag/Selected/Pressed",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-tag-item-default--pressed"
  },
  {
    "id": "lib:definition:origin-component-tag-item-default--focus-visible",
    "name": "Tag/Selected/Focus",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-tag-item-default--focus-visible"
  },
  {
    "id": "lib:definition:origin-component-taggroup",
    "name": "TagGroup",
    "mode": "composite",
    "accepts": {
      "label": "string"
    },
    "defaults": {
      "label": "Tag Group"
    },
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-taggroup"
  },
  {
    "id": "lib:definition:origin-component-tree-item-default",
    "name": "TreeItem/Default",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-tree-item-default"
  },
  {
    "id": "lib:definition:origin-component-tree-item-default--unselected",
    "name": "TreeItem/Default/Unselected",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-tree-item-default--unselected"
  },
  {
    "id": "lib:definition:origin-component-tree-item-default--disabled",
    "name": "TreeItem/Default/Disabled",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-tree-item-default--disabled"
  },
  {
    "id": "lib:definition:origin-component-tree-item-default--hover",
    "name": "TreeItem/Default/Hover",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-tree-item-default--hover"
  },
  {
    "id": "lib:definition:origin-component-tree-item-default--pressed",
    "name": "TreeItem/Default/Pressed",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-tree-item-default--pressed"
  },
  {
    "id": "lib:definition:origin-component-tree-item-default--focus-visible",
    "name": "TreeItem/Default/Focus",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-tree-item-default--focus-visible"
  },
  {
    "id": "lib:definition:origin-component-tree-item-default--collapsed",
    "name": "TreeItem/Default/Collapsed",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-tree-item-default--collapsed"
  },
  {
    "id": "lib:definition:origin-component-listbox-section",
    "name": "ListBoxSection",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-listbox-section"
  },
  {
    "id": "lib:definition:origin-component-menu-section",
    "name": "MenuSection",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-menu-section"
  },
  {
    "id": "lib:definition:origin-component-gridlist-section",
    "name": "GridListSection",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-gridlist-section"
  },
  {
    "id": "lib:definition:origin-component-table-column",
    "name": "Column",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-table-column"
  },
  {
    "id": "lib:definition:origin-component-table-row",
    "name": "Row",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-table-row"
  },
  {
    "id": "lib:definition:origin-component-modal",
    "name": "Modal",
    "mode": "composite",
    "accepts": {},
    "defaults": {},
    "visual": {},
    "stateRules": {},
    "templateRootId": "lib:template:component-modal"
  }
];

export const REUSABLE_ORIGIN_TEMPLATES: readonly LibraryTemplateNode[] = [
  {
    "id": "lib:template:component-listbox-item-default",
    "definitionId": "lib:definition:type-ListBoxItem",
    "children": [
      "lib:template:component-listbox-item-default__icon",
      "lib:template:component-listbox-item-default__label",
      "lib:template:component-listbox-item-default__description"
    ],
    "props": {
      "children": "{label}"
    },
    "visual": {},
    "displayState": "selected",
    "stateRules": {
      "selected": {
        "backgroundColor": {
          "kind": "set",
          "value": "var(--accent-subtle)"
        }
      }
    }
  },
  {
    "id": "lib:template:component-listbox-item-default__icon",
    "definitionId": "lib:definition:type-Icon",
    "children": [],
    "props": {
      "slot": "icon",
      "iconName": "{icon}"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-listbox-item-default__label",
    "definitionId": "lib:definition:text",
    "children": [],
    "props": {
      "slot": "label",
      "children": "{label}"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-listbox-item-default__description",
    "definitionId": "lib:definition:text",
    "children": [],
    "props": {
      "slot": "description",
      "children": "{description}"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-listbox-item-default--unselected",
    "definitionId": "lib:definition:origin-component-listbox-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "unselected"
  },
  {
    "id": "lib:template:component-listbox-item-default--disabled",
    "definitionId": "lib:definition:origin-component-listbox-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "disabled"
  },
  {
    "id": "lib:template:component-listbox-item-default--hover",
    "definitionId": "lib:definition:origin-component-listbox-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "hover"
  },
  {
    "id": "lib:template:component-listbox-item-default--pressed",
    "definitionId": "lib:definition:origin-component-listbox-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "pressed"
  },
  {
    "id": "lib:template:component-listbox-item-default--focus-visible",
    "definitionId": "lib:definition:origin-component-listbox-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "focusVisible"
  },
  {
    "id": "lib:template:component-listbox",
    "definitionId": "lib:definition:type-ListBox",
    "slot": {
      "name": "Items",
      "required": false
    },
    "children": [
      "lib:template:component-listbox__item-1",
      "lib:template:component-listbox__item-2",
      "lib:template:component-listbox__item-3"
    ],
    "props": {
      "selectionMode": "single"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-listbox__item-1",
    "definitionId": "lib:definition:origin-component-listbox-item-default",
    "children": [],
    "props": {
      "id": "inbox"
    },
    "visual": {},
    "descendantPatches": [
      {
        "templatePath": [
          "lib:template:component-listbox-item-default",
          "lib:template:component-listbox-item-default__icon"
        ],
        "props": {
          "iconName": "inbox"
        }
      },
      {
        "templatePath": [
          "lib:template:component-listbox-item-default",
          "lib:template:component-listbox-item-default__label"
        ],
        "props": {
          "children": "Inbox"
        }
      },
      {
        "templatePath": [
          "lib:template:component-listbox-item-default",
          "lib:template:component-listbox-item-default__description"
        ],
        "props": {
          "children": "Unread messages"
        }
      }
    ]
  },
  {
    "id": "lib:template:component-listbox__item-2",
    "definitionId": "lib:definition:origin-component-listbox-item-default",
    "children": [],
    "props": {
      "id": "starred"
    },
    "visual": {},
    "descendantPatches": [
      {
        "templatePath": [
          "lib:template:component-listbox-item-default",
          "lib:template:component-listbox-item-default__icon"
        ],
        "props": {
          "iconName": "star"
        }
      },
      {
        "templatePath": [
          "lib:template:component-listbox-item-default",
          "lib:template:component-listbox-item-default__label"
        ],
        "props": {
          "children": "Starred"
        }
      },
      {
        "templatePath": [
          "lib:template:component-listbox-item-default",
          "lib:template:component-listbox-item-default__description"
        ],
        "props": {
          "children": "Marked as important"
        }
      }
    ]
  },
  {
    "id": "lib:template:component-listbox__item-3",
    "definitionId": "lib:definition:origin-component-listbox-item-default",
    "children": [],
    "props": {
      "id": "archive"
    },
    "visual": {},
    "descendantPatches": [
      {
        "templatePath": [
          "lib:template:component-listbox-item-default",
          "lib:template:component-listbox-item-default__icon"
        ],
        "props": {
          "iconName": "archive"
        }
      },
      {
        "templatePath": [
          "lib:template:component-listbox-item-default",
          "lib:template:component-listbox-item-default__label"
        ],
        "props": {
          "children": "Archive"
        }
      },
      {
        "templatePath": [
          "lib:template:component-listbox-item-default",
          "lib:template:component-listbox-item-default__description"
        ],
        "props": {
          "children": "Stored for later"
        }
      }
    ]
  },
  {
    "id": "lib:template:component-gridlist-item-default",
    "definitionId": "lib:definition:type-GridListItem",
    "children": [
      "lib:template:component-gridlist-item-default__label",
      "lib:template:component-gridlist-item-default__description"
    ],
    "props": {
      "children": "{label}"
    },
    "visual": {},
    "displayState": "selected"
  },
  {
    "id": "lib:template:component-gridlist-item-default__label",
    "definitionId": "lib:definition:text",
    "children": [],
    "props": {
      "children": "{label}"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-gridlist-item-default__description",
    "definitionId": "lib:definition:text",
    "children": [],
    "props": {
      "slot": "description",
      "children": "{description}"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-gridlist-item-default--unselected",
    "definitionId": "lib:definition:origin-component-gridlist-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "unselected"
  },
  {
    "id": "lib:template:component-gridlist-item-default--disabled",
    "definitionId": "lib:definition:origin-component-gridlist-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "disabled"
  },
  {
    "id": "lib:template:component-gridlist-item-default--hover",
    "definitionId": "lib:definition:origin-component-gridlist-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "hover"
  },
  {
    "id": "lib:template:component-gridlist-item-default--pressed",
    "definitionId": "lib:definition:origin-component-gridlist-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "pressed"
  },
  {
    "id": "lib:template:component-gridlist-item-default--focus-visible",
    "definitionId": "lib:definition:origin-component-gridlist-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "focusVisible"
  },
  {
    "id": "lib:template:component-gridlist",
    "definitionId": "lib:definition:type-GridList",
    "slot": {
      "name": "Items",
      "required": false
    },
    "children": [
      "lib:template:component-gridlist__item-1",
      "lib:template:component-gridlist__item-2",
      "lib:template:component-gridlist__item-3"
    ],
    "props": {
      "layout": "grid",
      "selectionMode": "none"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-gridlist__item-1",
    "definitionId": "lib:definition:origin-component-gridlist-item-default",
    "children": [],
    "props": {
      "id": "documents"
    },
    "visual": {},
    "descendantPatches": [
      {
        "templatePath": [
          "lib:template:component-gridlist-item-default",
          "lib:template:component-gridlist-item-default__label"
        ],
        "props": {
          "children": "Documents"
        }
      },
      {
        "templatePath": [
          "lib:template:component-gridlist-item-default",
          "lib:template:component-gridlist-item-default__description"
        ],
        "props": {
          "children": "12 files"
        }
      }
    ]
  },
  {
    "id": "lib:template:component-gridlist__item-2",
    "definitionId": "lib:definition:origin-component-gridlist-item-default",
    "children": [],
    "props": {
      "id": "images"
    },
    "visual": {},
    "descendantPatches": [
      {
        "templatePath": [
          "lib:template:component-gridlist-item-default",
          "lib:template:component-gridlist-item-default__label"
        ],
        "props": {
          "children": "Images"
        }
      },
      {
        "templatePath": [
          "lib:template:component-gridlist-item-default",
          "lib:template:component-gridlist-item-default__description"
        ],
        "props": {
          "children": "48 files"
        }
      }
    ]
  },
  {
    "id": "lib:template:component-gridlist__item-3",
    "definitionId": "lib:definition:origin-component-gridlist-item-default",
    "children": [],
    "props": {
      "id": "downloads"
    },
    "visual": {},
    "descendantPatches": [
      {
        "templatePath": [
          "lib:template:component-gridlist-item-default",
          "lib:template:component-gridlist-item-default__label"
        ],
        "props": {
          "children": "Downloads"
        }
      },
      {
        "templatePath": [
          "lib:template:component-gridlist-item-default",
          "lib:template:component-gridlist-item-default__description"
        ],
        "props": {
          "children": "5 files"
        }
      }
    ]
  },
  {
    "id": "lib:template:component-menu-item-default",
    "definitionId": "lib:definition:type-MenuItem",
    "children": [
      "lib:template:component-menu-item-default__icon",
      "lib:template:component-menu-item-default__label",
      "lib:template:component-menu-item-default__shortcut",
      "lib:template:component-menu-item-default__description"
    ],
    "props": {},
    "visual": {}
  },
  {
    "id": "lib:template:component-menu-item-default__icon",
    "definitionId": "lib:definition:type-Icon",
    "children": [],
    "props": {
      "slot": "icon",
      "iconName": "{icon}"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-menu-item-default__label",
    "definitionId": "lib:definition:text",
    "children": [],
    "props": {
      "slot": "label",
      "children": "{label}"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-menu-item-default__shortcut",
    "definitionId": "lib:definition:text",
    "children": [],
    "props": {
      "slot": "shortcut",
      "children": "{shortcut}"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-menu-item-default__description",
    "definitionId": "lib:definition:text",
    "children": [],
    "props": {
      "slot": "description",
      "children": "{description}"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-menu-item-default--disabled",
    "definitionId": "lib:definition:origin-component-menu-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "disabled"
  },
  {
    "id": "lib:template:component-menu-item-default--hover",
    "definitionId": "lib:definition:origin-component-menu-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "hover"
  },
  {
    "id": "lib:template:component-menu-item-default--pressed",
    "definitionId": "lib:definition:origin-component-menu-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "pressed"
  },
  {
    "id": "lib:template:component-menu-item-default--focus-visible",
    "definitionId": "lib:definition:origin-component-menu-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "focusVisible"
  },
  {
    "id": "lib:template:component-toolbar",
    "definitionId": "lib:definition:type-Toolbar",
    "slot": {
      "name": "Actions",
      "required": false
    },
    "children": [
      "lib:template:component-toolbar__button-1",
      "lib:template:component-toolbar__button-2",
      "lib:template:component-toolbar__separator",
      "lib:template:component-toolbar__button-3"
    ],
    "props": {},
    "visual": {}
  },
  {
    "id": "lib:template:component-toolbar__button-1",
    "definitionId": "lib:definition:origin-component-button",
    "children": [],
    "props": {
      "children": "Action 1",
      "size": "sm"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-toolbar__button-2",
    "definitionId": "lib:definition:origin-component-button",
    "children": [],
    "props": {
      "children": "Action 2",
      "size": "sm"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-toolbar__separator",
    "definitionId": "lib:definition:type-Separator",
    "children": [],
    "props": {
      "orientation": "vertical"
    },
    "visual": {
      "width": "1px",
      "height": "20px"
    }
  },
  {
    "id": "lib:template:component-toolbar__button-3",
    "definitionId": "lib:definition:origin-component-button",
    "children": [],
    "props": {
      "children": "Action 3",
      "size": "sm"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-form",
    "definitionId": "lib:definition:type-Form",
    "slot": {
      "name": "Fields",
      "required": false
    },
    "children": [
      "lib:template:component-form__field-1",
      "lib:template:component-form__field-2",
      "lib:template:component-form__actions"
    ],
    "props": {
      "labelPosition": "top"
    },
    "visual": {
      "width": "100%"
    }
  },
  {
    "id": "lib:template:component-form__field-1",
    "definitionId": "lib:definition:origin-component-textfield",
    "children": [],
    "props": {
      "label": "Name",
      "placeholder": "Enter your full name",
      "isRequired": true
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-form__field-2",
    "definitionId": "lib:definition:origin-component-textfield",
    "children": [],
    "props": {
      "label": "Email",
      "placeholder": "Enter your email",
      "type": "email",
      "isRequired": true
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-form__actions",
    "definitionId": "lib:definition:origin-component-buttongroup",
    "children": [],
    "props": {},
    "visual": {}
  },
  {
    "id": "lib:template:component-iconbutton",
    "definitionId": "lib:definition:type-Button",
    "children": [
      "lib:template:component-iconbutton__icon",
      "lib:template:component-iconbutton__label"
    ],
    "props": {
      "variant": "primary",
      "size": "md",
      "staticColor": "auto",
      "isDisabled": false
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-iconbutton__icon",
    "definitionId": "lib:definition:type-Icon",
    "children": [],
    "props": {
      "slot": "icon",
      "iconName": "{icon}",
      "size": "md"
    },
    "visual": {
      "fontSize": 18,
      "height": 18
    }
  },
  {
    "id": "lib:template:component-iconbutton__label",
    "definitionId": "lib:definition:text",
    "children": [],
    "props": {
      "slot": "label",
      "children": "{label}",
      "size": "md"
    },
    "visual": {
      "fontSize": 14,
      "lineHeight": 1.4285714285714286
    }
  },
  {
    "id": "lib:template:component-iconbutton--disabled",
    "definitionId": "lib:definition:origin-component-iconbutton",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "disabled"
  },
  {
    "id": "lib:template:component-iconbutton--hover",
    "definitionId": "lib:definition:origin-component-iconbutton",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "hover"
  },
  {
    "id": "lib:template:component-iconbutton--pressed",
    "definitionId": "lib:definition:origin-component-iconbutton",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "pressed"
  },
  {
    "id": "lib:template:component-iconbutton--focus-visible",
    "definitionId": "lib:definition:origin-component-iconbutton",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "focusVisible"
  },
  {
    "id": "lib:template:component-inline-alert",
    "definitionId": "lib:definition:type-InlineAlert",
    "children": [
      "lib:template:component-inline-alert__title",
      "lib:template:component-inline-alert__description"
    ],
    "props": {
      "variant": "info"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-inline-alert__title",
    "definitionId": "lib:definition:heading",
    "children": [],
    "props": {
      "slot": "label",
      "children": "{title}"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-inline-alert__description",
    "definitionId": "lib:definition:type-Description",
    "children": [],
    "props": {
      "slot": "description",
      "children": "{description}"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-card",
    "definitionId": "lib:definition:type-Card",
    "children": [
      "lib:template:component-card__preview",
      "lib:template:component-card__header",
      "lib:template:component-card__content",
      "lib:template:component-card__footer"
    ],
    "props": {
      "variant": "primary",
      "size": "md",
      "orientation": "vertical"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-card__preview",
    "definitionId": "lib:definition:type-CardPreview",
    "slot": {
      "name": "Preview",
      "required": false
    },
    "children": [
      "lib:template:component-card__preview-image"
    ],
    "props": {},
    "visual": {
      "height": "fit-content"
    }
  },
  {
    "id": "lib:template:component-card__preview-image",
    "definitionId": "lib:definition:type-Image",
    "children": [],
    "props": {},
    "visual": {
      "width": "100%",
      "height": 200
    }
  },
  {
    "id": "lib:template:component-card__header",
    "definitionId": "lib:definition:type-CardHeader",
    "slot": {
      "name": "Header",
      "required": false
    },
    "children": [
      "lib:template:component-card__title"
    ],
    "props": {},
    "visual": {}
  },
  {
    "id": "lib:template:component-card__title",
    "definitionId": "lib:definition:heading",
    "children": [],
    "props": {
      "children": "{title}",
      "size": "md"
    },
    "visual": {
      "fontWeight": "600"
    },
    "layout": {
      "marginTop": "0",
      "marginRight": "0",
      "marginBottom": "0",
      "marginLeft": "0",
      "flexGrow": "1",
      "flexShrink": "1",
      "flexBasis": "0%"
    }
  },
  {
    "id": "lib:template:component-card__content",
    "definitionId": "lib:definition:type-CardContent",
    "slot": {
      "name": "Content",
      "required": false
    },
    "children": [
      "lib:template:component-card__description"
    ],
    "props": {},
    "visual": {}
  },
  {
    "id": "lib:template:component-card__description",
    "definitionId": "lib:definition:type-Description",
    "children": [],
    "props": {
      "children": "{description}",
      "size": "lg"
    },
    "visual": {
      "width": "100%",
      "color": "#49454f"
    }
  },
  {
    "id": "lib:template:component-card__footer",
    "definitionId": "lib:definition:type-CardFooter",
    "slot": {
      "name": "Footer",
      "required": false
    },
    "children": [],
    "props": {},
    "visual": {
      "paddingTop": 8
    }
  },
  {
    "id": "lib:template:component-badge",
    "definitionId": "lib:definition:type-Badge",
    "children": [],
    "props": {
      "variant": "accent",
      "size": "sm",
      "fillStyle": "bold",
      "children": "Badge",
      "isDot": false,
      "isPulsing": false
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-progressbar",
    "definitionId": "lib:definition:type-ProgressBar",
    "children": [
      "lib:template:component-progressbar__1",
      "lib:template:component-progressbar__2",
      "lib:template:component-progressbar__3"
    ],
    "props": {
      "label": "Progress",
      "value": 50,
      "showValueLabel": true,
      "size": "md"
    },
    "visual": {},
    "layout": {
      "rowGap": "4px",
      "columnGap": "12px"
    }
  },
  {
    "id": "lib:template:component-progressbar__1",
    "definitionId": "lib:definition:origin-component-label",
    "children": [],
    "props": {
      "children": "{label}"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-progressbar__2",
    "definitionId": "lib:definition:type-ProgressBarValue",
    "children": [],
    "props": {
      "children": "50%",
      "size": "md"
    },
    "visual": {
      "width": "fit-content"
    },
    "layout": {
      "gridColumnStart": "2",
      "gridColumnEnd": "3",
      "gridRowStart": "1",
      "gridRowEnd": "2",
      "justifySelf": "end"
    }
  },
  {
    "id": "lib:template:component-progressbar__3",
    "definitionId": "lib:definition:type-ProgressBarTrack",
    "children": [],
    "props": {
      "size": "md"
    },
    "visual": {
      "width": "100%"
    },
    "layout": {
      "gridColumnStart": "1",
      "gridColumnEnd": "3",
      "gridRowStart": "2",
      "gridRowEnd": "3"
    }
  },
  {
    "id": "lib:template:component-avatar",
    "definitionId": "lib:definition:type-Avatar",
    "children": [],
    "props": {
      "src": "",
      "alt": "Avatar",
      "initials": "A",
      "size": "md",
      "isDisabled": false
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-avatargroup",
    "definitionId": "lib:definition:type-AvatarGroup",
    "slot": {
      "name": "Avatars",
      "required": false
    },
    "children": [
      "lib:template:component-avatargroup__1",
      "lib:template:component-avatargroup__2",
      "lib:template:component-avatargroup__3"
    ],
    "props": {
      "size": "md",
      "label": "Team"
    },
    "visual": {},
    "layout": {
      "display": "flex",
      "flexDirection": "row",
      "alignItems": "center"
    }
  },
  {
    "id": "lib:template:component-avatargroup__1",
    "definitionId": "lib:definition:origin-component-avatar",
    "children": [],
    "props": {},
    "visual": {},
    "layout": {
      "marginLeft": "-8px"
    }
  },
  {
    "id": "lib:template:component-avatargroup__2",
    "definitionId": "lib:definition:origin-component-avatar",
    "children": [],
    "props": {
      "initials": "B"
    },
    "visual": {},
    "layout": {
      "marginLeft": "-8px"
    }
  },
  {
    "id": "lib:template:component-avatargroup__3",
    "definitionId": "lib:definition:origin-component-avatar",
    "children": [],
    "props": {
      "initials": "C"
    },
    "visual": {},
    "layout": {
      "marginLeft": "-8px"
    }
  },
  {
    "id": "lib:template:component-statuslight",
    "definitionId": "lib:definition:type-StatusLight",
    "children": [],
    "props": {
      "variant": "positive",
      "children": "Available",
      "size": "md"
    },
    "visual": {
      "gap": 8
    },
    "layout": {
      "display": "inline-flex",
      "flexDirection": "row",
      "alignItems": "center"
    }
  },
  {
    "id": "lib:template:component-progresscircle",
    "definitionId": "lib:definition:type-ProgressCircle",
    "children": [],
    "props": {
      "value": 75,
      "size": "md",
      "isIndeterminate": false
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-breadcrumb-item-default",
    "definitionId": "lib:definition:type-Breadcrumb",
    "children": [
      "lib:template:component-breadcrumb-item-default__label",
      "lib:template:component-breadcrumb-item-default__separator"
    ],
    "props": {
      "href": "#"
    },
    "visual": {
      "width": "fit-content"
    }
  },
  {
    "id": "lib:template:component-breadcrumb-item-default__label",
    "definitionId": "lib:definition:text",
    "children": [],
    "props": {
      "children": "Breadcrumb"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-breadcrumb-item-default__separator",
    "definitionId": "lib:definition:type-Icon",
    "children": [],
    "props": {
      "slot": "separator",
      "iconName": "chevron-right"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-breadcrumb-item-default--current",
    "definitionId": "lib:definition:origin-component-breadcrumb-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "current"
  },
  {
    "id": "lib:template:component-breadcrumbs",
    "definitionId": "lib:definition:type-Breadcrumbs",
    "slot": {
      "name": "Items",
      "required": false
    },
    "children": [
      "lib:template:component-breadcrumbs__item-1",
      "lib:template:component-breadcrumbs__item-2",
      "lib:template:component-breadcrumbs__item-3"
    ],
    "props": {
      "size": "M",
      "isDisabled": false
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-breadcrumbs__item-1",
    "definitionId": "lib:definition:origin-component-breadcrumb-item-default",
    "children": [],
    "props": {
      "href": "/"
    },
    "visual": {},
    "descendantPatches": [
      {
        "templatePath": [
          "lib:template:component-breadcrumb-item-default",
          "lib:template:component-breadcrumb-item-default__label"
        ],
        "props": {
          "children": "Home"
        }
      }
    ]
  },
  {
    "id": "lib:template:component-breadcrumbs__item-2",
    "definitionId": "lib:definition:origin-component-breadcrumb-item-default",
    "children": [],
    "props": {
      "href": "/category"
    },
    "visual": {},
    "descendantPatches": [
      {
        "templatePath": [
          "lib:template:component-breadcrumb-item-default",
          "lib:template:component-breadcrumb-item-default__label"
        ],
        "props": {
          "children": "Category"
        }
      }
    ]
  },
  {
    "id": "lib:template:component-breadcrumbs__item-3",
    "definitionId": "lib:definition:origin-component-breadcrumb-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "descendantPatches": [
      {
        "templatePath": [
          "lib:template:component-breadcrumb-item-default",
          "lib:template:component-breadcrumb-item-default__label"
        ],
        "props": {
          "children": "Page"
        }
      }
    ]
  },
  {
    "id": "lib:template:component-link",
    "definitionId": "lib:definition:type-Link",
    "children": [],
    "props": {
      "variant": "primary",
      "size": "md",
      "staticColor": "auto",
      "children": "Link",
      "href": "#",
      "isDisabled": false
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-link--disabled",
    "definitionId": "lib:definition:origin-component-link",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "disabled"
  },
  {
    "id": "lib:template:component-link--hover",
    "definitionId": "lib:definition:origin-component-link",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "hover"
  },
  {
    "id": "lib:template:component-link--pressed",
    "definitionId": "lib:definition:origin-component-link",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "pressed"
  },
  {
    "id": "lib:template:component-link--focus-visible",
    "definitionId": "lib:definition:origin-component-link",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "focusVisible"
  },
  {
    "id": "lib:template:component-nav",
    "definitionId": "lib:definition:type-Nav",
    "slot": {
      "name": "Links",
      "required": false
    },
    "children": [
      "lib:template:component-nav__1",
      "lib:template:component-nav__2",
      "lib:template:component-nav__3"
    ],
    "props": {},
    "visual": {
      "width": "100%"
    },
    "layout": {
      "display": "flex",
      "flexDirection": "row",
      "alignItems": "center"
    }
  },
  {
    "id": "lib:template:component-nav__1",
    "definitionId": "lib:definition:origin-component-link",
    "children": [],
    "props": {
      "children": "Home",
      "href": "/"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-nav__2",
    "definitionId": "lib:definition:origin-component-link",
    "children": [],
    "props": {
      "children": "About",
      "href": "/about"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-nav__3",
    "definitionId": "lib:definition:origin-component-link",
    "children": [],
    "props": {
      "children": "Contact",
      "href": "/contact"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-pagination",
    "definitionId": "lib:definition:type-Pagination",
    "children": [
      "lib:template:component-pagination__1",
      "lib:template:component-pagination__2",
      "lib:template:component-pagination__3",
      "lib:template:component-pagination__4",
      "lib:template:component-pagination__5"
    ],
    "props": {
      "totalPages": 5,
      "currentPage": 1
    },
    "visual": {},
    "layout": {
      "flexDirection": "row",
      "alignItems": "center"
    }
  },
  {
    "id": "lib:template:component-pagination__1",
    "definitionId": "lib:definition:origin-component-button",
    "children": [],
    "props": {
      "children": "←",
      "variant": "secondary",
      "fillStyle": "outline",
      "size": "sm"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-pagination__2",
    "definitionId": "lib:definition:origin-component-button",
    "children": [],
    "props": {
      "children": "1",
      "variant": "accent",
      "size": "sm"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-pagination__3",
    "definitionId": "lib:definition:origin-component-button",
    "children": [],
    "props": {
      "children": "2",
      "variant": "secondary",
      "fillStyle": "outline",
      "size": "sm"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-pagination__4",
    "definitionId": "lib:definition:origin-component-button",
    "children": [],
    "props": {
      "children": "3",
      "variant": "secondary",
      "fillStyle": "outline",
      "size": "sm"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-pagination__5",
    "definitionId": "lib:definition:origin-component-button",
    "children": [],
    "props": {
      "children": "→",
      "variant": "secondary",
      "fillStyle": "outline",
      "size": "sm"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-disclosuregroup",
    "definitionId": "lib:definition:type-DisclosureGroup",
    "slot": {
      "name": "Sections",
      "required": false
    },
    "children": [
      "lib:template:component-disclosuregroup__1",
      "lib:template:component-disclosuregroup__2"
    ],
    "props": {},
    "visual": {}
  },
  {
    "id": "lib:template:component-disclosuregroup__1",
    "definitionId": "lib:definition:origin-component-disclosure",
    "children": [],
    "props": {},
    "visual": {},
    "descendantPatches": [
      {
        "templatePath": [
          "lib:template:component-disclosure",
          "lib:template:component-disclosure__1"
        ],
        "props": {
          "children": "Section 1"
        }
      },
      {
        "templatePath": [
          "lib:template:component-disclosure",
          "lib:template:component-disclosure__2"
        ],
        "props": {
          "children": "Content 1"
        }
      }
    ]
  },
  {
    "id": "lib:template:component-disclosuregroup__2",
    "definitionId": "lib:definition:origin-component-disclosure",
    "children": [],
    "props": {},
    "visual": {},
    "descendantPatches": [
      {
        "templatePath": [
          "lib:template:component-disclosure",
          "lib:template:component-disclosure__1"
        ],
        "props": {
          "children": "Section 2"
        }
      },
      {
        "templatePath": [
          "lib:template:component-disclosure",
          "lib:template:component-disclosure__2"
        ],
        "props": {
          "children": "Content 2"
        }
      }
    ]
  },
  {
    "id": "lib:template:component-disclosure",
    "definitionId": "lib:definition:type-Disclosure",
    "children": [
      "lib:template:component-disclosure__1",
      "lib:template:component-disclosure__2"
    ],
    "props": {},
    "visual": {}
  },
  {
    "id": "lib:template:component-disclosure__1",
    "definitionId": "lib:definition:type-DisclosureHeader",
    "children": [],
    "props": {
      "children": "{title}"
    },
    "visual": {
      "width": "100%"
    },
    "layout": {
      "display": "flex",
      "flexDirection": "row",
      "justifyContent": "flex-start",
      "alignItems": "center"
    }
  },
  {
    "id": "lib:template:component-disclosure__2",
    "definitionId": "lib:definition:type-DisclosureContent",
    "children": [],
    "props": {
      "children": "Section content goes here."
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-disclosure--collapsed",
    "definitionId": "lib:definition:origin-component-disclosure",
    "children": [],
    "props": {
      "isExpanded": false
    },
    "visual": {},
    "displayState": "collapsed"
  },
  {
    "id": "lib:template:component-cardview",
    "definitionId": "lib:definition:type-CardView",
    "slot": {
      "name": "Cards",
      "required": false
    },
    "children": [
      "lib:template:component-cardview__1",
      "lib:template:component-cardview__2",
      "lib:template:component-cardview__3"
    ],
    "props": {
      "layout": "grid",
      "size": "md",
      "density": "regular",
      "gap": 16
    },
    "visual": {
      "gap": 16,
      "width": "100%"
    },
    "layout": {
      "display": "flex",
      "flexWrap": "wrap"
    }
  },
  {
    "id": "lib:template:component-cardview__1",
    "definitionId": "lib:definition:origin-component-card",
    "children": [],
    "props": {},
    "visual": {
      "width": 200
    }
  },
  {
    "id": "lib:template:component-cardview__2",
    "definitionId": "lib:definition:origin-component-card",
    "children": [],
    "props": {},
    "visual": {
      "width": 200
    }
  },
  {
    "id": "lib:template:component-cardview__3",
    "definitionId": "lib:definition:origin-component-card",
    "children": [],
    "props": {},
    "visual": {
      "width": 200
    }
  },
  {
    "id": "lib:template:component-button",
    "definitionId": "lib:definition:type-Button",
    "children": [],
    "props": {
      "variant": "primary",
      "size": "md",
      "fillStyle": "fill",
      "staticColor": "auto",
      "type": "button",
      "children": "Button",
      "isDisabled": false,
      "isPending": false
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-button--disabled",
    "definitionId": "lib:definition:origin-component-button",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "disabled"
  },
  {
    "id": "lib:template:component-button--hover",
    "definitionId": "lib:definition:origin-component-button",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "hover"
  },
  {
    "id": "lib:template:component-button--pressed",
    "definitionId": "lib:definition:origin-component-button",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "pressed"
  },
  {
    "id": "lib:template:component-button--focus-visible",
    "definitionId": "lib:definition:origin-component-button",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "focusVisible"
  },
  {
    "id": "lib:template:component-togglebutton",
    "definitionId": "lib:definition:type-ToggleButton",
    "children": [],
    "props": {
      "size": "md",
      "staticColor": "auto",
      "children": "Toggle Button",
      "isEmphasized": false,
      "isQuiet": false,
      "isSelected": false,
      "isDisabled": false
    },
    "visual": {},
    "displayState": "selected"
  },
  {
    "id": "lib:template:component-togglebutton--unselected",
    "definitionId": "lib:definition:origin-component-togglebutton",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "unselected"
  },
  {
    "id": "lib:template:component-togglebutton--disabled",
    "definitionId": "lib:definition:origin-component-togglebutton",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "disabled"
  },
  {
    "id": "lib:template:component-togglebutton--hover",
    "definitionId": "lib:definition:origin-component-togglebutton",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "hover"
  },
  {
    "id": "lib:template:component-togglebutton--pressed",
    "definitionId": "lib:definition:origin-component-togglebutton",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "pressed"
  },
  {
    "id": "lib:template:component-togglebutton--focus-visible",
    "definitionId": "lib:definition:origin-component-togglebutton",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "focusVisible"
  },
  {
    "id": "lib:template:component-togglebuttongroup",
    "definitionId": "lib:definition:type-ToggleButtonGroup",
    "slot": {
      "name": "Buttons",
      "required": false
    },
    "children": [
      "lib:template:component-togglebuttongroup__1",
      "lib:template:component-togglebuttongroup__2"
    ],
    "props": {
      "size": "md",
      "orientation": "horizontal",
      "selectionMode": "single"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-togglebuttongroup__1",
    "definitionId": "lib:definition:origin-component-togglebutton",
    "children": [],
    "props": {
      "children": "Toggle 1"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-togglebuttongroup__2",
    "definitionId": "lib:definition:origin-component-togglebutton",
    "children": [],
    "props": {
      "children": "Toggle 2"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-buttongroup",
    "definitionId": "lib:definition:type-ButtonGroup",
    "slot": {
      "name": "Buttons",
      "required": false
    },
    "children": [
      "lib:template:component-buttongroup__1",
      "lib:template:component-buttongroup__2"
    ],
    "props": {
      "size": "md",
      "orientation": "horizontal",
      "align": "end"
    },
    "visual": {
      "gap": 8,
      "width": "fit-content"
    },
    "layout": {
      "display": "flex",
      "flexDirection": "row"
    }
  },
  {
    "id": "lib:template:component-buttongroup__1",
    "definitionId": "lib:definition:origin-component-button",
    "children": [],
    "props": {
      "children": "Cancel",
      "variant": "secondary",
      "fillStyle": "outline"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-buttongroup__2",
    "definitionId": "lib:definition:origin-component-button",
    "children": [],
    "props": {
      "children": "Save",
      "variant": "accent"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-menu",
    "definitionId": "lib:definition:type-Menu",
    "children": [
      "lib:template:component-menu__item-1",
      "lib:template:component-menu__item-2",
      "lib:template:component-menu__item-3"
    ],
    "props": {
      "label": "Menu",
      "variant": "primary",
      "size": "md",
      "selectionMode": "none"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-menu__item-1",
    "definitionId": "lib:definition:origin-component-menu-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "descendantPatches": [
      {
        "templatePath": [
          "lib:template:component-menu-item-default",
          "lib:template:component-menu-item-default__icon"
        ],
        "enabled": false
      },
      {
        "templatePath": [
          "lib:template:component-menu-item-default",
          "lib:template:component-menu-item-default__label"
        ],
        "props": {
          "children": "Menu Item 1"
        }
      },
      {
        "templatePath": [
          "lib:template:component-menu-item-default",
          "lib:template:component-menu-item-default__shortcut"
        ],
        "enabled": false
      },
      {
        "templatePath": [
          "lib:template:component-menu-item-default",
          "lib:template:component-menu-item-default__description"
        ],
        "enabled": false
      }
    ]
  },
  {
    "id": "lib:template:component-menu__item-2",
    "definitionId": "lib:definition:origin-component-menu-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "descendantPatches": [
      {
        "templatePath": [
          "lib:template:component-menu-item-default",
          "lib:template:component-menu-item-default__icon"
        ],
        "enabled": false
      },
      {
        "templatePath": [
          "lib:template:component-menu-item-default",
          "lib:template:component-menu-item-default__label"
        ],
        "props": {
          "children": "Menu Item 2"
        }
      },
      {
        "templatePath": [
          "lib:template:component-menu-item-default",
          "lib:template:component-menu-item-default__shortcut"
        ],
        "enabled": false
      },
      {
        "templatePath": [
          "lib:template:component-menu-item-default",
          "lib:template:component-menu-item-default__description"
        ],
        "enabled": false
      }
    ]
  },
  {
    "id": "lib:template:component-menu__item-3",
    "definitionId": "lib:definition:origin-component-menu-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "descendantPatches": [
      {
        "templatePath": [
          "lib:template:component-menu-item-default",
          "lib:template:component-menu-item-default__icon"
        ],
        "enabled": false
      },
      {
        "templatePath": [
          "lib:template:component-menu-item-default",
          "lib:template:component-menu-item-default__label"
        ],
        "props": {
          "children": "Menu Item 3"
        }
      },
      {
        "templatePath": [
          "lib:template:component-menu-item-default",
          "lib:template:component-menu-item-default__shortcut"
        ],
        "enabled": false
      },
      {
        "templatePath": [
          "lib:template:component-menu-item-default",
          "lib:template:component-menu-item-default__description"
        ],
        "enabled": false
      }
    ]
  },
  {
    "id": "lib:template:component-textfield",
    "definitionId": "lib:definition:type-TextField",
    "children": [
      "lib:template:component-textfield__1",
      "lib:template:component-textfield__2",
      "lib:template:component-textfield__3"
    ],
    "props": {
      "label": "Text Field",
      "name": "",
      "description": "",
      "errorMessage": "",
      "placeholder": "Enter text...",
      "value": "",
      "type": "text",
      "size": "md",
      "labelPosition": "top",
      "isRequired": false,
      "isDisabled": false,
      "isReadOnly": false,
      "isInvalid": false
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-textfield__1",
    "definitionId": "lib:definition:origin-component-label",
    "children": [],
    "props": {
      "children": "{label}"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-textfield__2",
    "definitionId": "lib:definition:type-Input",
    "children": [],
    "props": {
      "type": "{type}",
      "placeholder": "{placeholder}",
      "size": "md"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-textfield__3",
    "definitionId": "lib:definition:type-FieldError",
    "children": [],
    "props": {
      "children": "{errorMessage}"
    },
    "visual": {},
    "layout": {
      "display": "none"
    }
  },
  {
    "id": "lib:template:component-textarea",
    "definitionId": "lib:definition:type-TextArea",
    "children": [
      "lib:template:component-textarea__1",
      "lib:template:component-textarea__2",
      "lib:template:component-textarea__3"
    ],
    "props": {
      "label": "Text Area",
      "name": "",
      "description": "",
      "errorMessage": "",
      "placeholder": "Enter text...",
      "rows": 3,
      "labelPosition": "top",
      "isRequired": false,
      "isDisabled": false,
      "isReadOnly": false,
      "isInvalid": false
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-textarea__1",
    "definitionId": "lib:definition:origin-component-label",
    "children": [],
    "props": {
      "children": "{label}"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-textarea__2",
    "definitionId": "lib:definition:type-Input",
    "children": [],
    "props": {
      "type": "text",
      "placeholder": "{placeholder}"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-textarea__3",
    "definitionId": "lib:definition:type-FieldError",
    "children": [],
    "props": {
      "children": "{errorMessage}"
    },
    "visual": {},
    "layout": {
      "display": "none"
    }
  },
  {
    "id": "lib:template:component-numberfield",
    "definitionId": "lib:definition:type-NumberField",
    "children": [
      "lib:template:component-numberfield__1",
      "lib:template:component-numberfield__2",
      "lib:template:component-numberfield__3"
    ],
    "props": {
      "label": "Number",
      "name": "",
      "minValue": 0,
      "maxValue": 100,
      "step": 1,
      "labelPosition": "top",
      "isDisabled": false,
      "isInvalid": false,
      "isReadOnly": false,
      "isRequired": false
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-numberfield__1",
    "definitionId": "lib:definition:origin-component-label",
    "children": [],
    "props": {
      "children": "{label}"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-numberfield__2",
    "definitionId": "lib:definition:type-SelectTrigger",
    "children": [
      "lib:template:component-numberfield__2_1",
      "lib:template:component-numberfield__2_2",
      "lib:template:component-numberfield__2_3"
    ],
    "props": {},
    "visual": {},
    "layout": {
      "display": "flex"
    }
  },
  {
    "id": "lib:template:component-numberfield__2_1",
    "definitionId": "lib:definition:type-SelectValue",
    "children": [],
    "props": {
      "placeholder": "0"
    },
    "visual": {},
    "layout": {
      "display": "block"
    }
  },
  {
    "id": "lib:template:component-numberfield__2_2",
    "definitionId": "lib:definition:type-SelectIcon",
    "children": [],
    "props": {
      "iconName": "minus"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-numberfield__2_3",
    "definitionId": "lib:definition:type-SelectIcon",
    "children": [],
    "props": {
      "iconName": "plus"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-numberfield__3",
    "definitionId": "lib:definition:type-FieldError",
    "children": [],
    "props": {
      "children": "{errorMessage}"
    },
    "visual": {},
    "layout": {
      "display": "none"
    }
  },
  {
    "id": "lib:template:component-searchfield",
    "definitionId": "lib:definition:type-SearchField",
    "children": [
      "lib:template:component-searchfield__1",
      "lib:template:component-searchfield__2"
    ],
    "props": {
      "label": "Search",
      "name": "",
      "placeholder": "Search...",
      "labelPosition": "top",
      "isDisabled": false,
      "isInvalid": false,
      "isReadOnly": false,
      "isRequired": false
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-searchfield__1",
    "definitionId": "lib:definition:origin-component-label",
    "children": [],
    "props": {
      "children": "{label}"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-searchfield__2",
    "definitionId": "lib:definition:type-SelectTrigger",
    "children": [
      "lib:template:component-searchfield__2_1",
      "lib:template:component-searchfield__2_2",
      "lib:template:component-searchfield__2_3"
    ],
    "props": {},
    "visual": {},
    "layout": {
      "display": "flex"
    }
  },
  {
    "id": "lib:template:component-searchfield__2_1",
    "definitionId": "lib:definition:type-SelectIcon",
    "children": [],
    "props": {
      "iconName": "search"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-searchfield__2_2",
    "definitionId": "lib:definition:type-SelectValue",
    "children": [],
    "props": {
      "children": "",
      "placeholder": "Search..."
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-searchfield__2_3",
    "definitionId": "lib:definition:type-SelectIcon",
    "children": [],
    "props": {
      "iconName": "x"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-colorfield",
    "definitionId": "lib:definition:type-ColorField",
    "children": [
      "lib:template:component-colorfield__1",
      "lib:template:component-colorfield__2"
    ],
    "props": {
      "label": "Color",
      "labelPosition": "top",
      "isDisabled": false
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-colorfield__1",
    "definitionId": "lib:definition:origin-component-label",
    "children": [],
    "props": {
      "children": "{label}"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-colorfield__2",
    "definitionId": "lib:definition:type-Input",
    "children": [],
    "props": {
      "type": "text",
      "placeholder": "#000000"
    },
    "visual": {},
    "layout": {
      "display": "block"
    }
  },
  {
    "id": "lib:template:component-checkbox",
    "definitionId": "lib:definition:type-Checkbox",
    "children": [
      "lib:template:component-checkbox__indicator",
      "lib:template:component-checkbox__1"
    ],
    "props": {
      "children": "Checkbox",
      "name": "",
      "value": "",
      "isSelected": false,
      "isDisabled": false,
      "isIndeterminate": false,
      "isInvalid": false,
      "isReadOnly": false,
      "isRequired": false
    },
    "visual": {},
    "displayState": "selected"
  },
  {
    "id": "lib:template:component-checkbox__indicator",
    "definitionId": "lib:definition:type-CheckboxIndicator",
    "children": [],
    "props": {},
    "visual": {}
  },
  {
    "id": "lib:template:component-checkbox__1",
    "definitionId": "lib:definition:type-Label",
    "children": [],
    "props": {
      "children": "{children}"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-checkbox--unselected",
    "definitionId": "lib:definition:origin-component-checkbox",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "unselected"
  },
  {
    "id": "lib:template:component-checkbox--disabled",
    "definitionId": "lib:definition:origin-component-checkbox",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "disabled"
  },
  {
    "id": "lib:template:component-checkbox--hover",
    "definitionId": "lib:definition:origin-component-checkbox",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "hover"
  },
  {
    "id": "lib:template:component-checkbox--pressed",
    "definitionId": "lib:definition:origin-component-checkbox",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "pressed"
  },
  {
    "id": "lib:template:component-checkbox--focus-visible",
    "definitionId": "lib:definition:origin-component-checkbox",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "focusVisible"
  },
  {
    "id": "lib:template:component-checkboxgroup",
    "definitionId": "lib:definition:type-CheckboxGroup",
    "children": [
      "lib:template:component-checkboxgroup__1",
      "lib:template:component-checkboxgroup__2"
    ],
    "props": {
      "label": "Checkbox Group",
      "name": "",
      "labelPosition": "top",
      "orientation": "vertical",
      "isInvalid": false,
      "isDisabled": false,
      "isReadOnly": false,
      "isRequired": false
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-checkboxgroup__1",
    "definitionId": "lib:definition:origin-component-label",
    "children": [],
    "props": {
      "children": "{label}"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-checkboxgroup__2",
    "definitionId": "lib:definition:type-CheckboxItems",
    "slot": {
      "name": "Options",
      "required": false
    },
    "children": [
      "lib:template:component-checkboxgroup__2__checkbox-1",
      "lib:template:component-checkboxgroup__2__checkbox-2"
    ],
    "props": {},
    "visual": {}
  },
  {
    "id": "lib:template:component-checkboxgroup__2__checkbox-1",
    "definitionId": "lib:definition:origin-component-checkbox",
    "children": [],
    "props": {
      "children": "Option 1"
    },
    "visual": {},
    "descendantPatches": [
      {
        "templatePath": [
          "lib:template:component-checkbox",
          "lib:template:component-checkbox__1"
        ],
        "props": {
          "children": "Option 1"
        },
        "visual": {
          "width": "fit-content",
          "fontWeight": 600
        }
      }
    ]
  },
  {
    "id": "lib:template:component-checkboxgroup__2__checkbox-2",
    "definitionId": "lib:definition:origin-component-checkbox",
    "children": [],
    "props": {
      "children": "Option 2"
    },
    "visual": {},
    "descendantPatches": [
      {
        "templatePath": [
          "lib:template:component-checkbox",
          "lib:template:component-checkbox__1"
        ],
        "props": {
          "children": "Option 2"
        },
        "visual": {
          "width": "fit-content",
          "fontWeight": 600
        }
      }
    ]
  },
  {
    "id": "lib:template:component-radiogroup",
    "definitionId": "lib:definition:type-RadioGroup",
    "children": [
      "lib:template:component-radiogroup__1",
      "lib:template:component-radiogroup__2"
    ],
    "props": {
      "label": "Radio Group",
      "name": "",
      "labelPosition": "top",
      "orientation": "vertical",
      "value": "",
      "isInvalid": false,
      "isReadOnly": false,
      "isRequired": false
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-radiogroup__1",
    "definitionId": "lib:definition:origin-component-label",
    "children": [],
    "props": {
      "children": "{label}"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-radiogroup__2",
    "definitionId": "lib:definition:type-RadioItems",
    "slot": {
      "name": "Options",
      "required": false
    },
    "children": [
      "lib:template:component-radiogroup__2__radio-1",
      "lib:template:component-radiogroup__2__radio-2"
    ],
    "props": {},
    "visual": {}
  },
  {
    "id": "lib:template:component-radiogroup__2__radio-1",
    "definitionId": "lib:definition:origin-component-radio",
    "children": [],
    "props": {
      "children": "Option 1",
      "value": "option1"
    },
    "visual": {},
    "descendantPatches": [
      {
        "templatePath": [
          "lib:template:component-radio",
          "lib:template:component-radio__1"
        ],
        "props": {
          "children": "Option 1"
        },
        "visual": {
          "width": "fit-content"
        }
      }
    ]
  },
  {
    "id": "lib:template:component-radiogroup__2__radio-2",
    "definitionId": "lib:definition:origin-component-radio",
    "children": [],
    "props": {
      "children": "Option 2",
      "value": "option2"
    },
    "visual": {},
    "descendantPatches": [
      {
        "templatePath": [
          "lib:template:component-radio",
          "lib:template:component-radio__1"
        ],
        "props": {
          "children": "Option 2"
        },
        "visual": {
          "width": "fit-content"
        }
      }
    ]
  },
  {
    "id": "lib:template:component-select",
    "definitionId": "lib:definition:type-Select",
    "children": [
      "lib:template:component-select__1",
      "lib:template:component-select__2",
      "lib:template:component-select__item-1",
      "lib:template:component-select__item-2",
      "lib:template:component-select__item-3",
      "lib:template:component-select__item-4"
    ],
    "props": {
      "label": "Select",
      "name": "",
      "placeholder": "Choose an option...",
      "labelPosition": "top",
      "isDisabled": false,
      "isInvalid": false,
      "isRequired": false
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-select__1",
    "definitionId": "lib:definition:origin-component-label",
    "children": [],
    "props": {
      "children": "{label}"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-select__2",
    "definitionId": "lib:definition:type-SelectTrigger",
    "children": [
      "lib:template:component-select__2_1",
      "lib:template:component-select__2_2"
    ],
    "props": {},
    "visual": {},
    "layout": {
      "display": "flex"
    }
  },
  {
    "id": "lib:template:component-select__2_1",
    "definitionId": "lib:definition:type-SelectValue",
    "children": [],
    "props": {
      "placeholder": "Choose an option...",
      "children": "Choose an option..."
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-select__2_2",
    "definitionId": "lib:definition:type-SelectIcon",
    "children": [],
    "props": {},
    "visual": {}
  },
  {
    "id": "lib:template:component-select__item-1",
    "definitionId": "lib:definition:origin-component-listbox-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "descendantPatches": [
      {
        "templatePath": [
          "lib:template:component-listbox-item-default",
          "lib:template:component-listbox-item-default__icon"
        ],
        "enabled": false
      },
      {
        "templatePath": [
          "lib:template:component-listbox-item-default",
          "lib:template:component-listbox-item-default__label"
        ],
        "props": {
          "children": "Aardvark"
        }
      },
      {
        "templatePath": [
          "lib:template:component-listbox-item-default",
          "lib:template:component-listbox-item-default__description"
        ],
        "enabled": false
      }
    ]
  },
  {
    "id": "lib:template:component-select__item-2",
    "definitionId": "lib:definition:origin-component-listbox-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "descendantPatches": [
      {
        "templatePath": [
          "lib:template:component-listbox-item-default",
          "lib:template:component-listbox-item-default__icon"
        ],
        "enabled": false
      },
      {
        "templatePath": [
          "lib:template:component-listbox-item-default",
          "lib:template:component-listbox-item-default__label"
        ],
        "props": {
          "children": "Cat"
        }
      },
      {
        "templatePath": [
          "lib:template:component-listbox-item-default",
          "lib:template:component-listbox-item-default__description"
        ],
        "enabled": false
      }
    ]
  },
  {
    "id": "lib:template:component-select__item-3",
    "definitionId": "lib:definition:origin-component-listbox-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "descendantPatches": [
      {
        "templatePath": [
          "lib:template:component-listbox-item-default",
          "lib:template:component-listbox-item-default__icon"
        ],
        "enabled": false
      },
      {
        "templatePath": [
          "lib:template:component-listbox-item-default",
          "lib:template:component-listbox-item-default__label"
        ],
        "props": {
          "children": "Dog"
        }
      },
      {
        "templatePath": [
          "lib:template:component-listbox-item-default",
          "lib:template:component-listbox-item-default__description"
        ],
        "enabled": false
      }
    ]
  },
  {
    "id": "lib:template:component-select__item-4",
    "definitionId": "lib:definition:origin-component-listbox-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "descendantPatches": [
      {
        "templatePath": [
          "lib:template:component-listbox-item-default",
          "lib:template:component-listbox-item-default__icon"
        ],
        "enabled": false
      },
      {
        "templatePath": [
          "lib:template:component-listbox-item-default",
          "lib:template:component-listbox-item-default__label"
        ],
        "props": {
          "children": "Kangaroo"
        }
      },
      {
        "templatePath": [
          "lib:template:component-listbox-item-default",
          "lib:template:component-listbox-item-default__description"
        ],
        "enabled": false
      }
    ]
  },
  {
    "id": "lib:template:component-combobox",
    "definitionId": "lib:definition:type-ComboBox",
    "children": [
      "lib:template:component-combobox__1",
      "lib:template:component-combobox__2",
      "lib:template:component-combobox__item-1",
      "lib:template:component-combobox__item-2",
      "lib:template:component-combobox__item-3",
      "lib:template:component-combobox__item-4"
    ],
    "props": {
      "label": "Combo Box",
      "name": "",
      "placeholder": "Type or select...",
      "allowsCustomValue": true,
      "labelPosition": "top",
      "isDisabled": false,
      "isInvalid": false,
      "isReadOnly": false,
      "isRequired": false
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-combobox__1",
    "definitionId": "lib:definition:origin-component-label",
    "children": [],
    "props": {
      "children": "{label}"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-combobox__2",
    "definitionId": "lib:definition:type-SelectTrigger",
    "children": [
      "lib:template:component-combobox__2_1",
      "lib:template:component-combobox__2_2"
    ],
    "props": {},
    "visual": {},
    "layout": {
      "display": "flex"
    }
  },
  {
    "id": "lib:template:component-combobox__2_1",
    "definitionId": "lib:definition:type-SelectValue",
    "children": [],
    "props": {
      "children": "Type or select...",
      "placeholder": "Type or select..."
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-combobox__2_2",
    "definitionId": "lib:definition:type-SelectIcon",
    "children": [],
    "props": {},
    "visual": {}
  },
  {
    "id": "lib:template:component-combobox__item-1",
    "definitionId": "lib:definition:origin-component-listbox-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "descendantPatches": [
      {
        "templatePath": [
          "lib:template:component-listbox-item-default",
          "lib:template:component-listbox-item-default__icon"
        ],
        "enabled": false
      },
      {
        "templatePath": [
          "lib:template:component-listbox-item-default",
          "lib:template:component-listbox-item-default__label"
        ],
        "props": {
          "children": "Aardvark"
        }
      },
      {
        "templatePath": [
          "lib:template:component-listbox-item-default",
          "lib:template:component-listbox-item-default__description"
        ],
        "enabled": false
      }
    ]
  },
  {
    "id": "lib:template:component-combobox__item-2",
    "definitionId": "lib:definition:origin-component-listbox-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "descendantPatches": [
      {
        "templatePath": [
          "lib:template:component-listbox-item-default",
          "lib:template:component-listbox-item-default__icon"
        ],
        "enabled": false
      },
      {
        "templatePath": [
          "lib:template:component-listbox-item-default",
          "lib:template:component-listbox-item-default__label"
        ],
        "props": {
          "children": "Cat"
        }
      },
      {
        "templatePath": [
          "lib:template:component-listbox-item-default",
          "lib:template:component-listbox-item-default__description"
        ],
        "enabled": false
      }
    ]
  },
  {
    "id": "lib:template:component-combobox__item-3",
    "definitionId": "lib:definition:origin-component-listbox-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "descendantPatches": [
      {
        "templatePath": [
          "lib:template:component-listbox-item-default",
          "lib:template:component-listbox-item-default__icon"
        ],
        "enabled": false
      },
      {
        "templatePath": [
          "lib:template:component-listbox-item-default",
          "lib:template:component-listbox-item-default__label"
        ],
        "props": {
          "children": "Dog"
        }
      },
      {
        "templatePath": [
          "lib:template:component-listbox-item-default",
          "lib:template:component-listbox-item-default__description"
        ],
        "enabled": false
      }
    ]
  },
  {
    "id": "lib:template:component-combobox__item-4",
    "definitionId": "lib:definition:origin-component-listbox-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "descendantPatches": [
      {
        "templatePath": [
          "lib:template:component-listbox-item-default",
          "lib:template:component-listbox-item-default__icon"
        ],
        "enabled": false
      },
      {
        "templatePath": [
          "lib:template:component-listbox-item-default",
          "lib:template:component-listbox-item-default__label"
        ],
        "props": {
          "children": "Kangaroo"
        }
      },
      {
        "templatePath": [
          "lib:template:component-listbox-item-default",
          "lib:template:component-listbox-item-default__description"
        ],
        "enabled": false
      }
    ]
  },
  {
    "id": "lib:template:component-switch",
    "definitionId": "lib:definition:type-Switch",
    "children": [
      "lib:template:component-switch__indicator",
      "lib:template:component-switch__1"
    ],
    "props": {
      "children": "Switch",
      "name": "",
      "isSelected": false,
      "isDisabled": false,
      "isReadOnly": false
    },
    "visual": {},
    "displayState": "selected"
  },
  {
    "id": "lib:template:component-switch__indicator",
    "definitionId": "lib:definition:type-SwitchIndicator",
    "children": [],
    "props": {},
    "visual": {}
  },
  {
    "id": "lib:template:component-switch__1",
    "definitionId": "lib:definition:type-Label",
    "children": [],
    "props": {
      "children": "{children}"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-switch--unselected",
    "definitionId": "lib:definition:origin-component-switch",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "unselected"
  },
  {
    "id": "lib:template:component-switch--disabled",
    "definitionId": "lib:definition:origin-component-switch",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "disabled"
  },
  {
    "id": "lib:template:component-switch--hover",
    "definitionId": "lib:definition:origin-component-switch",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "hover"
  },
  {
    "id": "lib:template:component-switch--pressed",
    "definitionId": "lib:definition:origin-component-switch",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "pressed"
  },
  {
    "id": "lib:template:component-switch--focus-visible",
    "definitionId": "lib:definition:origin-component-switch",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "focusVisible"
  },
  {
    "id": "lib:template:component-slider",
    "definitionId": "lib:definition:type-Slider",
    "children": [
      "lib:template:component-slider__1",
      "lib:template:component-slider__2",
      "lib:template:component-slider__3"
    ],
    "props": {
      "label": "Slider",
      "value": 50,
      "minValue": 0,
      "maxValue": 100,
      "step": 1,
      "size": "md",
      "labelPosition": "top",
      "isDisabled": false,
      "showValueLabel": true
    },
    "visual": {
      "width": "100%"
    }
  },
  {
    "id": "lib:template:component-slider__1",
    "definitionId": "lib:definition:origin-component-label",
    "children": [],
    "props": {
      "children": "{label}"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-slider__2",
    "definitionId": "lib:definition:type-SliderOutput",
    "children": [],
    "props": {
      "children": "50",
      "size": "md"
    },
    "visual": {
      "width": "fit-content"
    }
  },
  {
    "id": "lib:template:component-slider__3",
    "definitionId": "lib:definition:type-SliderTrack",
    "children": [
      "lib:template:component-slider__3_1"
    ],
    "props": {
      "size": "md",
      "value": 50,
      "minValue": 0,
      "maxValue": 100
    },
    "visual": {
      "width": "100%"
    }
  },
  {
    "id": "lib:template:component-slider__3_1",
    "definitionId": "lib:definition:type-SliderThumb",
    "children": [],
    "props": {
      "size": "md"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-meter",
    "definitionId": "lib:definition:type-Meter",
    "children": [
      "lib:template:component-meter__1",
      "lib:template:component-meter__2",
      "lib:template:component-meter__3"
    ],
    "props": {
      "label": "Storage",
      "value": 75,
      "minValue": 0,
      "maxValue": 100,
      "showValueLabel": true,
      "variant": "informative",
      "size": "md"
    },
    "visual": {},
    "layout": {
      "rowGap": "4px",
      "columnGap": "12px"
    }
  },
  {
    "id": "lib:template:component-meter__1",
    "definitionId": "lib:definition:origin-component-label",
    "children": [],
    "props": {
      "children": "{label}"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-meter__2",
    "definitionId": "lib:definition:type-MeterValue",
    "children": [],
    "props": {
      "children": "75%",
      "size": "md"
    },
    "visual": {
      "width": "fit-content"
    },
    "layout": {
      "gridColumnStart": "2",
      "gridColumnEnd": "3",
      "gridRowStart": "1",
      "gridRowEnd": "2",
      "justifySelf": "end"
    }
  },
  {
    "id": "lib:template:component-meter__3",
    "definitionId": "lib:definition:type-MeterTrack",
    "children": [],
    "props": {
      "size": "md"
    },
    "visual": {
      "width": "100%"
    },
    "layout": {
      "gridColumnStart": "1",
      "gridColumnEnd": "3",
      "gridRowStart": "2",
      "gridRowEnd": "3"
    }
  },
  {
    "id": "lib:template:component-dropzone",
    "definitionId": "lib:definition:type-DropZone",
    "children": [],
    "props": {},
    "visual": {
      "paddingTop": 24,
      "paddingRight": 24,
      "paddingBottom": 24,
      "paddingLeft": 24
    },
    "layout": {
      "display": "inline-flex",
      "flexDirection": "column",
      "alignItems": "center",
      "justifyContent": "center",
      "rowGap": "12px",
      "columnGap": "12px"
    }
  },
  {
    "id": "lib:template:component-filetrigger",
    "definitionId": "lib:definition:type-FileTrigger",
    "children": [],
    "props": {
      "children": "Select files"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-fileupload",
    "definitionId": "lib:definition:type-FileUpload",
    "children": [
      "lib:template:component-fileupload__1",
      "lib:template:component-fileupload__2",
      "lib:template:component-fileupload__3",
      "lib:template:component-fileupload__4"
    ],
    "props": {
      "allowsMultiple": true,
      "chunkSize": 8388608,
      "parallelUploads": 1,
      "maxFileSize": 0,
      "autoProceed": true,
      "showPreview": false
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-fileupload__1",
    "definitionId": "lib:definition:origin-component-dropzone",
    "children": [],
    "props": {
      "label": "Drop files here",
      "description": "or use the button below to select files",
      "size": "md"
    },
    "visual": {
      "width": "100%",
      "height": "fit-content"
    },
    "layout": {
      "display": "flex"
    }
  },
  {
    "id": "lib:template:component-fileupload__2",
    "definitionId": "lib:definition:origin-component-filetrigger",
    "children": [],
    "props": {
      "children": "Select files",
      "variant": "default",
      "size": "md",
      "allowsMultiple": true
    },
    "visual": {
      "width": "fit-content"
    }
  },
  {
    "id": "lib:template:component-fileupload__3",
    "definitionId": "lib:definition:origin-component-progressbar",
    "children": [],
    "props": {
      "label": "report.pdf",
      "value": 60,
      "valueLabel": "2.4 MB · 60%"
    },
    "visual": {},
    "descendantPatches": [
      {
        "templatePath": [
          "lib:template:component-progressbar",
          "lib:template:component-progressbar__2"
        ],
        "props": {
          "children": "2.4 MB · 60%"
        }
      }
    ]
  },
  {
    "id": "lib:template:component-fileupload__4",
    "definitionId": "lib:definition:origin-component-progressbar",
    "children": [],
    "props": {
      "label": "photo.jpg",
      "value": 25,
      "valueLabel": "860 KB · 25%"
    },
    "visual": {},
    "descendantPatches": [
      {
        "templatePath": [
          "lib:template:component-progressbar",
          "lib:template:component-progressbar__2"
        ],
        "props": {
          "children": "860 KB · 25%"
        }
      }
    ]
  },
  {
    "id": "lib:template:component-table",
    "definitionId": "lib:definition:type-Table",
    "children": [
      "lib:template:component-table__1",
      "lib:template:component-table__2"
    ],
    "props": {
      "selectionMode": "none",
      "variant": "default",
      "size": "sm",
      "height": 400
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-table__1",
    "definitionId": "lib:definition:type-TableHeader",
    "slot": {
      "name": "Columns",
      "required": false
    },
    "children": [],
    "props": {},
    "visual": {}
  },
  {
    "id": "lib:template:component-table__2",
    "definitionId": "lib:definition:type-TableBody",
    "slot": {
      "name": "Rows",
      "required": false
    },
    "children": [],
    "props": {},
    "visual": {}
  },
  {
    "id": "lib:template:component-tree",
    "definitionId": "lib:definition:type-Tree",
    "slot": {
      "name": "Items",
      "required": false
    },
    "children": [
      "lib:template:component-tree__item-1",
      "lib:template:component-tree__item-2"
    ],
    "props": {
      "selectionMode": "single"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-tree__item-1",
    "definitionId": "lib:definition:origin-component-tree-item-default",
    "children": [
      "lib:template:component-tree__item-1-1"
    ],
    "props": {
      "id": "item-1"
    },
    "visual": {},
    "descendantPatches": [
      {
        "templatePath": [
          "lib:template:component-tree-item-default",
          "lib:template:component-tree-item-default__label"
        ],
        "props": {
          "children": "Node 1"
        }
      }
    ]
  },
  {
    "id": "lib:template:component-tree__item-1-1",
    "definitionId": "lib:definition:origin-component-tree-item-default",
    "children": [],
    "props": {
      "id": "item-1-1"
    },
    "visual": {},
    "descendantPatches": [
      {
        "templatePath": [
          "lib:template:component-tree-item-default",
          "lib:template:component-tree-item-default__label"
        ],
        "props": {
          "children": "Node 1.1"
        }
      }
    ]
  },
  {
    "id": "lib:template:component-tree__item-2",
    "definitionId": "lib:definition:origin-component-tree-item-default",
    "children": [],
    "props": {
      "id": "item-2"
    },
    "visual": {},
    "descendantPatches": [
      {
        "templatePath": [
          "lib:template:component-tree-item-default",
          "lib:template:component-tree-item-default__label"
        ],
        "props": {
          "children": "Node 2"
        }
      }
    ]
  },
  {
    "id": "lib:template:component-tableview",
    "definitionId": "lib:definition:type-TableView",
    "children": [
      "lib:template:component-tableview__1",
      "lib:template:component-tableview__2"
    ],
    "props": {
      "variant": "default",
      "density": "regular",
      "allowsSorting": true
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-tableview__1",
    "definitionId": "lib:definition:type-TableHeader",
    "slot": {
      "name": "Columns",
      "required": false
    },
    "children": [
      "lib:template:component-tableview__1_1",
      "lib:template:component-tableview__1_2",
      "lib:template:component-tableview__1_3"
    ],
    "props": {},
    "visual": {}
  },
  {
    "id": "lib:template:component-tableview__1_1",
    "definitionId": "lib:definition:origin-component-table-column",
    "children": [],
    "props": {
      "children": "Name"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-tableview__1_2",
    "definitionId": "lib:definition:origin-component-table-column",
    "children": [],
    "props": {
      "children": "Type"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-tableview__1_3",
    "definitionId": "lib:definition:origin-component-table-column",
    "children": [],
    "props": {
      "children": "Status"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-tableview__2",
    "definitionId": "lib:definition:type-TableBody",
    "slot": {
      "name": "Rows",
      "required": false
    },
    "children": [
      "lib:template:component-tableview__2_1"
    ],
    "props": {},
    "visual": {}
  },
  {
    "id": "lib:template:component-tableview__2_1",
    "definitionId": "lib:definition:origin-component-table-row",
    "children": [
      "lib:template:component-tableview__2_1_1",
      "lib:template:component-tableview__2_1_2",
      "lib:template:component-tableview__2_1_3"
    ],
    "props": {},
    "visual": {}
  },
  {
    "id": "lib:template:component-tableview__2_1_1",
    "definitionId": "lib:definition:type-Cell",
    "children": [],
    "props": {
      "children": "Item 1"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-tableview__2_1_2",
    "definitionId": "lib:definition:type-Cell",
    "children": [],
    "props": {
      "children": "File"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-tableview__2_1_3",
    "definitionId": "lib:definition:type-Cell",
    "children": [],
    "props": {
      "children": "Active"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-chart",
    "definitionId": "lib:definition:type-Chart",
    "children": [],
    "props": {
      "data": [
        {
          "category": "Mon",
          "value": 12,
          "series": "A"
        },
        {
          "category": "Tue",
          "value": 30,
          "series": "A"
        },
        {
          "category": "Wed",
          "value": 18,
          "series": "A"
        },
        {
          "category": "Thu",
          "value": 24,
          "series": "A"
        },
        {
          "category": "Mon",
          "value": 20,
          "series": "B"
        },
        {
          "category": "Tue",
          "value": 8,
          "series": "B"
        },
        {
          "category": "Wed",
          "value": 25,
          "series": "B"
        },
        {
          "category": "Thu",
          "value": 14,
          "series": "B"
        }
      ],
      "chartType": "bar",
      "dimension": "category",
      "metric": "value",
      "orientation": "vertical",
      "stackType": "dodged",
      "curve": "linear",
      "showDots": false,
      "showValueLabels": false,
      "colorBy": "series",
      "innerRadius": 0,
      "gridType": "polygon",
      "showSpokes": true,
      "gridRings": 0,
      "fillGrid": false,
      "fillArea": true,
      "startAngle": 0,
      "endAngle": 360,
      "labelKey": "value",
      "showTotal": false,
      "showTooltip": true,
      "showAxis": true,
      "showGrid": false,
      "showLegend": true,
      "legendPosition": "bottom",
      "color": "series",
      "variant": "default",
      "size": "md",
      "isAnimationActive": true,
      "animationBegin": 0,
      "animationDuration": 600,
      "animationEasing": "ease-out"
    },
    "visual": {
      "width": 320
    }
  },
  {
    "id": "lib:template:component-calendar",
    "definitionId": "lib:definition:type-Calendar",
    "children": [
      "lib:template:component-calendar__1",
      "lib:template:component-calendar__2"
    ],
    "props": {
      "variant": "default",
      "size": "md",
      "maxVisibleMonths": 1,
      "isDisabled": false,
      "isReadOnly": false
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-calendar__1",
    "definitionId": "lib:definition:type-CalendarHeader",
    "children": [],
    "props": {
      "children": "2026년 9월",
      "size": "md",
      "locale": "{locale}",
      "calendarSystem": "{calendarSystem}"
    },
    "visual": {},
    "layout": {
      "display": "flex",
      "flexDirection": "row",
      "justifyContent": "space-between",
      "alignItems": "center",
      "verticalAlign": "middle"
    }
  },
  {
    "id": "lib:template:component-calendar__2",
    "definitionId": "lib:definition:type-CalendarGrid",
    "children": [],
    "props": {
      "defaultToday": true,
      "locale": "{locale}",
      "variant": "default",
      "size": "md",
      "calendarSystem": "{calendarSystem}"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-datepicker",
    "definitionId": "lib:definition:type-DatePicker",
    "children": [
      "lib:template:component-datepicker__1",
      "lib:template:component-datepicker__2",
      "lib:template:component-datepicker__3"
    ],
    "props": {
      "label": "Date Picker",
      "size": "md",
      "labelPosition": "top",
      "maxVisibleMonths": 1,
      "hideTimeZone": true,
      "shouldForceLeadingZeros": true,
      "isDisabled": false,
      "isReadOnly": false,
      "iconName": "calendar"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-datepicker__1",
    "definitionId": "lib:definition:origin-component-label",
    "children": [],
    "props": {
      "children": "{label}"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-datepicker__2",
    "definitionId": "lib:definition:type-SelectTrigger",
    "children": [
      "lib:template:component-datepicker__2_1",
      "lib:template:component-datepicker__2_2"
    ],
    "props": {
      "size": "md"
    },
    "visual": {},
    "layout": {
      "display": "flex"
    }
  },
  {
    "id": "lib:template:component-datepicker__2_1",
    "definitionId": "lib:definition:type-DateInput",
    "children": [],
    "props": {
      "size": "md"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-datepicker__2_2",
    "definitionId": "lib:definition:type-SelectIcon",
    "children": [],
    "props": {
      "size": "md"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-datepicker__3",
    "definitionId": "lib:definition:origin-component-calendar",
    "children": [],
    "props": {},
    "visual": {}
  },
  {
    "id": "lib:template:component-daterangepicker",
    "definitionId": "lib:definition:type-DateRangePicker",
    "children": [
      "lib:template:component-daterangepicker__1",
      "lib:template:component-daterangepicker__2",
      "lib:template:component-daterangepicker__3"
    ],
    "props": {
      "label": "Date Range",
      "size": "md",
      "labelPosition": "top",
      "maxVisibleMonths": 1,
      "hideTimeZone": true,
      "shouldForceLeadingZeros": true,
      "isDisabled": false,
      "isReadOnly": false,
      "iconName": "calendar"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-daterangepicker__1",
    "definitionId": "lib:definition:origin-component-label",
    "children": [],
    "props": {
      "children": "{label}"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-daterangepicker__2",
    "definitionId": "lib:definition:type-SelectTrigger",
    "children": [
      "lib:template:component-daterangepicker__2_1",
      "lib:template:component-daterangepicker__2_2"
    ],
    "props": {
      "size": "md"
    },
    "visual": {},
    "layout": {
      "display": "flex"
    }
  },
  {
    "id": "lib:template:component-daterangepicker__2_1",
    "definitionId": "lib:definition:type-DateInput",
    "children": [],
    "props": {
      "size": "md"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-daterangepicker__2_2",
    "definitionId": "lib:definition:type-SelectIcon",
    "children": [],
    "props": {
      "size": "md"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-daterangepicker__3",
    "definitionId": "lib:definition:origin-component-calendar",
    "children": [],
    "props": {},
    "visual": {}
  },
  {
    "id": "lib:template:component-datefield",
    "definitionId": "lib:definition:type-DateField",
    "children": [
      "lib:template:component-datefield__1",
      "lib:template:component-datefield__2",
      "lib:template:component-datefield__3"
    ],
    "props": {
      "label": "Date Field",
      "size": "md",
      "labelPosition": "top",
      "hideTimeZone": true,
      "shouldForceLeadingZeros": true,
      "isDisabled": false,
      "isReadOnly": false,
      "isInvalid": false
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-datefield__1",
    "definitionId": "lib:definition:origin-component-label",
    "children": [],
    "props": {
      "children": "{label}"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-datefield__2",
    "definitionId": "lib:definition:type-DateInput",
    "children": [],
    "props": {
      "size": "md"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-datefield__3",
    "definitionId": "lib:definition:type-FieldError",
    "children": [],
    "props": {
      "children": "{errorMessage}"
    },
    "visual": {},
    "layout": {
      "display": "none"
    }
  },
  {
    "id": "lib:template:component-timefield",
    "definitionId": "lib:definition:type-TimeField",
    "children": [
      "lib:template:component-timefield__1",
      "lib:template:component-timefield__2",
      "lib:template:component-timefield__3"
    ],
    "props": {
      "label": "Time",
      "size": "md",
      "labelPosition": "top",
      "granularity": "minute",
      "hideTimeZone": true,
      "shouldForceLeadingZeros": true,
      "isDisabled": false,
      "isReadOnly": false,
      "isInvalid": false
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-timefield__1",
    "definitionId": "lib:definition:origin-component-label",
    "children": [],
    "props": {
      "children": "{label}"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-timefield__2",
    "definitionId": "lib:definition:type-DateInput",
    "children": [],
    "props": {
      "size": "md"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-timefield__3",
    "definitionId": "lib:definition:type-FieldError",
    "children": [],
    "props": {
      "children": "{errorMessage}"
    },
    "visual": {},
    "layout": {
      "display": "none"
    }
  },
  {
    "id": "lib:template:component-rangecalendar",
    "definitionId": "lib:definition:type-RangeCalendar",
    "children": [
      "lib:template:component-rangecalendar__1",
      "lib:template:component-rangecalendar__2"
    ],
    "props": {
      "variant": "default",
      "size": "md",
      "isDisabled": false,
      "isReadOnly": false
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-rangecalendar__1",
    "definitionId": "lib:definition:type-CalendarHeader",
    "children": [],
    "props": {
      "children": "2026년 9월",
      "size": "md",
      "locale": "{locale}",
      "calendarSystem": "{calendarSystem}"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-rangecalendar__2",
    "definitionId": "lib:definition:type-CalendarGrid",
    "children": [],
    "props": {
      "locale": "{locale}",
      "defaultToday": true,
      "variant": "default",
      "size": "md",
      "calendarSystem": "{calendarSystem}"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-dialog",
    "definitionId": "lib:definition:type-DialogTrigger",
    "children": [
      "lib:template:component-dialog__1",
      "lib:template:component-dialog__2"
    ],
    "props": {},
    "visual": {}
  },
  {
    "id": "lib:template:component-dialog__1",
    "definitionId": "lib:definition:origin-component-button",
    "children": [],
    "props": {
      "children": "Open Dialog"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-dialog__2",
    "definitionId": "lib:definition:type-Dialog",
    "children": [
      "lib:template:component-dialog__2_1",
      "lib:template:component-dialog__content-region",
      "lib:template:component-dialog__2_3"
    ],
    "props": {
      "size": "md",
      "isDismissable": false
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-dialog__2_1",
    "definitionId": "lib:definition:heading",
    "children": [],
    "props": {
      "children": "Dialog Title",
      "size": "lg"
    },
    "visual": {
      "fontWeight": "600"
    },
    "layout": {
      "display": "block"
    }
  },
  {
    "id": "lib:template:component-dialog__content-region",
    "definitionId": "lib:definition:type-frame",
    "children": [
      "lib:template:component-dialog__2_2"
    ],
    "props": {},
    "visual": {},
    "layout": {
      "display": "flex",
      "flexDirection": "column",
      "rowGap": "0",
      "columnGap": "0"
    }
  },
  {
    "id": "lib:template:component-dialog__2_2",
    "definitionId": "lib:definition:type-Description",
    "children": [],
    "props": {
      "children": "Dialog content goes here.",
      "size": "lg"
    },
    "visual": {},
    "layout": {
      "display": "block"
    }
  },
  {
    "id": "lib:template:component-dialog__2_3",
    "definitionId": "lib:definition:type-DialogFooter",
    "children": [
      "lib:template:component-dialog__actions-region",
      "lib:template:component-dialog__2_3_1"
    ],
    "props": {},
    "visual": {
      "gap": "8px"
    },
    "layout": {
      "display": "flex",
      "justifyContent": "flex-end"
    }
  },
  {
    "id": "lib:template:component-dialog__actions-region",
    "definitionId": "lib:definition:type-frame",
    "children": [],
    "props": {},
    "visual": {},
    "layout": {
      "display": "flex",
      "flexDirection": "row",
      "alignItems": "center",
      "rowGap": "0",
      "columnGap": "8px"
    }
  },
  {
    "id": "lib:template:component-dialog__2_3_1",
    "definitionId": "lib:definition:origin-component-button",
    "children": [],
    "props": {
      "children": "Close",
      "slot": "close",
      "variant": "secondary"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-popover",
    "definitionId": "lib:definition:type-Popover",
    "children": [
      "lib:template:component-popover__1",
      "lib:template:component-popover__2"
    ],
    "props": {
      "size": "md"
    },
    "visual": {
      "width": "240px"
    }
  },
  {
    "id": "lib:template:component-popover__1",
    "definitionId": "lib:definition:heading",
    "children": [],
    "props": {
      "children": "Popover Title",
      "size": "sm"
    },
    "visual": {
      "fontWeight": "600"
    },
    "layout": {
      "display": "block"
    }
  },
  {
    "id": "lib:template:component-popover__2",
    "definitionId": "lib:definition:type-Description",
    "children": [],
    "props": {
      "children": "Popover content goes here.",
      "size": "md"
    },
    "visual": {},
    "layout": {
      "display": "block"
    }
  },
  {
    "id": "lib:template:component-tooltip",
    "definitionId": "lib:definition:type-Tooltip",
    "children": [
      "lib:template:component-tooltip__1"
    ],
    "props": {},
    "visual": {}
  },
  {
    "id": "lib:template:component-tooltip__1",
    "definitionId": "lib:definition:type-Description",
    "children": [],
    "props": {
      "children": "Tooltip text",
      "size": "md"
    },
    "visual": {},
    "layout": {
      "display": "block"
    }
  },
  {
    "id": "lib:template:component-label",
    "definitionId": "lib:definition:type-Label",
    "children": [],
    "props": {
      "children": "{children}"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-radio",
    "definitionId": "lib:definition:type-Radio",
    "children": [
      "lib:template:component-radio__indicator",
      "lib:template:component-radio__1"
    ],
    "props": {
      "children": "Radio",
      "value": "radio",
      "isSelected": false,
      "isDisabled": false
    },
    "visual": {},
    "displayState": "selected"
  },
  {
    "id": "lib:template:component-radio__indicator",
    "definitionId": "lib:definition:type-RadioIndicator",
    "children": [],
    "props": {},
    "visual": {}
  },
  {
    "id": "lib:template:component-radio__1",
    "definitionId": "lib:definition:type-Label",
    "children": [],
    "props": {
      "children": "{children}"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-radio--unselected",
    "definitionId": "lib:definition:origin-component-radio",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "unselected"
  },
  {
    "id": "lib:template:component-radio--disabled",
    "definitionId": "lib:definition:origin-component-radio",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "disabled"
  },
  {
    "id": "lib:template:component-radio--hover",
    "definitionId": "lib:definition:origin-component-radio",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "hover"
  },
  {
    "id": "lib:template:component-radio--pressed",
    "definitionId": "lib:definition:origin-component-radio",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "pressed"
  },
  {
    "id": "lib:template:component-radio--focus-visible",
    "definitionId": "lib:definition:origin-component-radio",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "focusVisible"
  },
  {
    "id": "lib:template:component-colorswatchpicker",
    "definitionId": "lib:definition:type-ColorSwatchPicker",
    "children": [
      "lib:template:component-colorswatchpicker__1",
      "lib:template:component-colorswatchpicker__2",
      "lib:template:component-colorswatchpicker__3",
      "lib:template:component-colorswatchpicker__4",
      "lib:template:component-colorswatchpicker__5",
      "lib:template:component-colorswatchpicker__6"
    ],
    "props": {
      "columns": 6
    },
    "visual": {
      "gap": 4
    },
    "layout": {
      "display": "flex",
      "flexDirection": "row",
      "flexWrap": "wrap"
    }
  },
  {
    "id": "lib:template:component-colorswatchpicker__1",
    "definitionId": "lib:definition:origin-component-colorswatch",
    "children": [],
    "props": {
      "color": "#FF0000"
    },
    "visual": {
      "width": 28,
      "height": 28
    }
  },
  {
    "id": "lib:template:component-colorswatchpicker__2",
    "definitionId": "lib:definition:origin-component-colorswatch",
    "children": [],
    "props": {
      "color": "#00FF00"
    },
    "visual": {
      "width": 28,
      "height": 28
    }
  },
  {
    "id": "lib:template:component-colorswatchpicker__3",
    "definitionId": "lib:definition:origin-component-colorswatch",
    "children": [],
    "props": {
      "color": "#0000FF"
    },
    "visual": {
      "width": 28,
      "height": 28
    }
  },
  {
    "id": "lib:template:component-colorswatchpicker__4",
    "definitionId": "lib:definition:origin-component-colorswatch",
    "children": [],
    "props": {
      "color": "#FFFF00"
    },
    "visual": {
      "width": 28,
      "height": 28
    }
  },
  {
    "id": "lib:template:component-colorswatchpicker__5",
    "definitionId": "lib:definition:origin-component-colorswatch",
    "children": [],
    "props": {
      "color": "#FF00FF"
    },
    "visual": {
      "width": 28,
      "height": 28
    }
  },
  {
    "id": "lib:template:component-colorswatchpicker__6",
    "definitionId": "lib:definition:origin-component-colorswatch",
    "children": [],
    "props": {
      "color": "#00FFFF"
    },
    "visual": {
      "width": 28,
      "height": 28
    }
  },
  {
    "id": "lib:template:component-colorswatch",
    "definitionId": "lib:definition:type-ColorSwatch",
    "children": [],
    "props": {},
    "visual": {
      "borderWidth": "1px"
    },
    "layout": {
      "display": "inline-flex"
    }
  },
  {
    "id": "lib:template:component-tab-item-default",
    "definitionId": "lib:definition:type-Tab",
    "children": [
      "lib:template:component-tab-item-default__label"
    ],
    "props": {},
    "visual": {
      "width": "fit-content"
    },
    "layout": {
      "display": "flex",
      "alignItems": "center",
      "justifyContent": "center"
    },
    "displayState": "selected"
  },
  {
    "id": "lib:template:component-tab-item-default__label",
    "definitionId": "lib:definition:text",
    "children": [],
    "props": {
      "slot": "label",
      "children": "{label}"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-tab-item-default--unselected",
    "definitionId": "lib:definition:origin-component-tab-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "unselected"
  },
  {
    "id": "lib:template:component-tab-item-default--disabled",
    "definitionId": "lib:definition:origin-component-tab-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "disabled"
  },
  {
    "id": "lib:template:component-tab-item-default--hover",
    "definitionId": "lib:definition:origin-component-tab-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "hover"
  },
  {
    "id": "lib:template:component-tab-item-default--pressed",
    "definitionId": "lib:definition:origin-component-tab-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "pressed"
  },
  {
    "id": "lib:template:component-tab-item-default--focus-visible",
    "definitionId": "lib:definition:origin-component-tab-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "focusVisible"
  },
  {
    "id": "lib:template:component-tabs",
    "definitionId": "lib:definition:type-Tabs",
    "children": [
      "lib:template:component-tabs__1",
      "lib:template:component-tabs__2"
    ],
    "props": {
      "orientation": "horizontal",
      "showIndicator": true
    },
    "visual": {
      "width": "100%"
    }
  },
  {
    "id": "lib:template:component-tabs__1",
    "definitionId": "lib:definition:type-TabList",
    "slot": {
      "name": "Tabs",
      "required": false
    },
    "children": [
      "lib:template:component-tabs__1__tab-1",
      "lib:template:component-tabs__1__tab-2"
    ],
    "props": {},
    "visual": {}
  },
  {
    "id": "lib:template:component-tabs__1__tab-1",
    "definitionId": "lib:definition:origin-component-tab-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "descendantPatches": [
      {
        "templatePath": [
          "lib:template:component-tab-item-default",
          "lib:template:component-tab-item-default__label"
        ],
        "props": {
          "children": "Tab 1"
        }
      }
    ]
  },
  {
    "id": "lib:template:component-tabs__1__tab-2",
    "definitionId": "lib:definition:origin-component-tab-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "descendantPatches": [
      {
        "templatePath": [
          "lib:template:component-tab-item-default",
          "lib:template:component-tab-item-default__label"
        ],
        "props": {
          "children": "Tab 2"
        }
      }
    ]
  },
  {
    "id": "lib:template:component-tabs__2",
    "definitionId": "lib:definition:type-TabPanels",
    "slot": {
      "name": "Panels",
      "required": false
    },
    "children": [
      "lib:template:component-tabs__2_1",
      "lib:template:component-tabs__2_2"
    ],
    "props": {},
    "visual": {}
  },
  {
    "id": "lib:template:component-tabs__2_1",
    "definitionId": "lib:definition:type-TabPanel",
    "children": [],
    "props": {},
    "visual": {}
  },
  {
    "id": "lib:template:component-tabs__2_2",
    "definitionId": "lib:definition:type-TabPanel",
    "children": [],
    "props": {},
    "visual": {}
  },
  {
    "id": "lib:template:component-tag-item-default",
    "definitionId": "lib:definition:type-Tag",
    "children": [
      "lib:template:component-tag-item-default__icon",
      "lib:template:component-tag-item-default__avatar",
      "lib:template:component-tag-item-default__label"
    ],
    "props": {
      "children": "{label}"
    },
    "visual": {
      "gap": 4,
      "width": "fit-content"
    },
    "layout": {
      "display": "flex",
      "alignItems": "center"
    },
    "displayState": "selected"
  },
  {
    "id": "lib:template:component-tag-item-default__icon",
    "definitionId": "lib:definition:type-Icon",
    "children": [],
    "props": {
      "slot": "icon",
      "iconName": "{icon}"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-tag-item-default__avatar",
    "definitionId": "lib:definition:type-Avatar",
    "children": [],
    "props": {
      "slot": "avatar",
      "src": "{avatar}",
      "alt": ""
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-tag-item-default__label",
    "definitionId": "lib:definition:text",
    "children": [],
    "props": {
      "slot": "label",
      "children": "{label}"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-tag-item-default--unselected",
    "definitionId": "lib:definition:origin-component-tag-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "unselected"
  },
  {
    "id": "lib:template:component-tag-item-default--disabled",
    "definitionId": "lib:definition:origin-component-tag-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "disabled"
  },
  {
    "id": "lib:template:component-tag-item-default--hover",
    "definitionId": "lib:definition:origin-component-tag-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "hover"
  },
  {
    "id": "lib:template:component-tag-item-default--pressed",
    "definitionId": "lib:definition:origin-component-tag-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "pressed"
  },
  {
    "id": "lib:template:component-tag-item-default--focus-visible",
    "definitionId": "lib:definition:origin-component-tag-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "focusVisible"
  },
  {
    "id": "lib:template:component-taggroup",
    "definitionId": "lib:definition:type-TagGroup",
    "children": [
      "lib:template:component-taggroup__1",
      "lib:template:component-taggroup__2"
    ],
    "props": {
      "label": "Tag Group",
      "size": "md",
      "labelPosition": "top",
      "maxRows": 2,
      "allowsRemoving": false,
      "selectionMode": "multiple"
    },
    "visual": {
      "width": "100%"
    }
  },
  {
    "id": "lib:template:component-taggroup__1",
    "definitionId": "lib:definition:origin-component-label",
    "children": [],
    "props": {
      "children": "{label}"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-taggroup__2",
    "definitionId": "lib:definition:type-TagList",
    "slot": {
      "name": "Tags",
      "required": false
    },
    "children": [
      "lib:template:component-taggroup__2__tag-1",
      "lib:template:component-taggroup__2__tag-2",
      "lib:template:component-taggroup__2__tag-3",
      "lib:template:component-taggroup__2__tag-4"
    ],
    "props": {
      "size": "md"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-taggroup__2__tag-1",
    "definitionId": "lib:definition:origin-component-tag-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "descendantPatches": [
      {
        "templatePath": [
          "lib:template:component-tag-item-default",
          "lib:template:component-tag-item-default__label"
        ],
        "props": {
          "children": "Chocolate"
        }
      },
      {
        "templatePath": [
          "lib:template:component-tag-item-default",
          "lib:template:component-tag-item-default__icon"
        ],
        "enabled": false
      },
      {
        "templatePath": [
          "lib:template:component-tag-item-default",
          "lib:template:component-tag-item-default__avatar"
        ],
        "enabled": false
      }
    ]
  },
  {
    "id": "lib:template:component-taggroup__2__tag-2",
    "definitionId": "lib:definition:origin-component-tag-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "descendantPatches": [
      {
        "templatePath": [
          "lib:template:component-tag-item-default",
          "lib:template:component-tag-item-default__label"
        ],
        "props": {
          "children": "Mint"
        }
      },
      {
        "templatePath": [
          "lib:template:component-tag-item-default",
          "lib:template:component-tag-item-default__icon"
        ],
        "enabled": false
      },
      {
        "templatePath": [
          "lib:template:component-tag-item-default",
          "lib:template:component-tag-item-default__avatar"
        ],
        "enabled": false
      }
    ]
  },
  {
    "id": "lib:template:component-taggroup__2__tag-3",
    "definitionId": "lib:definition:origin-component-tag-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "descendantPatches": [
      {
        "templatePath": [
          "lib:template:component-tag-item-default",
          "lib:template:component-tag-item-default__label"
        ],
        "props": {
          "children": "Strawberry"
        }
      },
      {
        "templatePath": [
          "lib:template:component-tag-item-default",
          "lib:template:component-tag-item-default__icon"
        ],
        "enabled": false
      },
      {
        "templatePath": [
          "lib:template:component-tag-item-default",
          "lib:template:component-tag-item-default__avatar"
        ],
        "enabled": false
      }
    ]
  },
  {
    "id": "lib:template:component-taggroup__2__tag-4",
    "definitionId": "lib:definition:origin-component-tag-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "descendantPatches": [
      {
        "templatePath": [
          "lib:template:component-tag-item-default",
          "lib:template:component-tag-item-default__label"
        ],
        "props": {
          "children": "Vanilla"
        }
      },
      {
        "templatePath": [
          "lib:template:component-tag-item-default",
          "lib:template:component-tag-item-default__icon"
        ],
        "enabled": false
      },
      {
        "templatePath": [
          "lib:template:component-tag-item-default",
          "lib:template:component-tag-item-default__avatar"
        ],
        "enabled": false
      }
    ]
  },
  {
    "id": "lib:template:component-tree-item-default",
    "definitionId": "lib:definition:type-TreeItem",
    "children": [
      "lib:template:component-tree-item-default__chevron",
      "lib:template:component-tree-item-default__label"
    ],
    "props": {},
    "visual": {},
    "displayState": "selected"
  },
  {
    "id": "lib:template:component-tree-item-default__chevron",
    "definitionId": "lib:definition:type-TreeItemChevron",
    "children": [],
    "props": {},
    "visual": {}
  },
  {
    "id": "lib:template:component-tree-item-default__label",
    "definitionId": "lib:definition:text",
    "children": [],
    "props": {
      "children": "Tree item"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-tree-item-default--unselected",
    "definitionId": "lib:definition:origin-component-tree-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "unselected"
  },
  {
    "id": "lib:template:component-tree-item-default--disabled",
    "definitionId": "lib:definition:origin-component-tree-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "disabled"
  },
  {
    "id": "lib:template:component-tree-item-default--hover",
    "definitionId": "lib:definition:origin-component-tree-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "hover"
  },
  {
    "id": "lib:template:component-tree-item-default--pressed",
    "definitionId": "lib:definition:origin-component-tree-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "pressed"
  },
  {
    "id": "lib:template:component-tree-item-default--focus-visible",
    "definitionId": "lib:definition:origin-component-tree-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "focusVisible"
  },
  {
    "id": "lib:template:component-tree-item-default--collapsed",
    "definitionId": "lib:definition:origin-component-tree-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "displayState": "collapsed"
  },
  {
    "id": "lib:template:component-listbox-section",
    "definitionId": "lib:definition:type-ListBoxSection",
    "children": [
      "lib:template:component-listbox-section__header",
      "lib:template:component-listbox-section__item-1",
      "lib:template:component-listbox-section__item-2"
    ],
    "props": {},
    "visual": {}
  },
  {
    "id": "lib:template:component-listbox-section__header",
    "definitionId": "lib:definition:type-Header",
    "children": [],
    "props": {
      "children": "Section"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-listbox-section__item-1",
    "definitionId": "lib:definition:origin-component-listbox-item-default",
    "children": [],
    "props": {
      "id": "item-1"
    },
    "visual": {},
    "descendantPatches": [
      {
        "templatePath": [
          "lib:template:component-listbox-item-default",
          "lib:template:component-listbox-item-default__icon"
        ],
        "enabled": false
      },
      {
        "templatePath": [
          "lib:template:component-listbox-item-default",
          "lib:template:component-listbox-item-default__label"
        ],
        "props": {
          "children": "Item 1"
        }
      },
      {
        "templatePath": [
          "lib:template:component-listbox-item-default",
          "lib:template:component-listbox-item-default__description"
        ],
        "enabled": false
      }
    ]
  },
  {
    "id": "lib:template:component-listbox-section__item-2",
    "definitionId": "lib:definition:origin-component-listbox-item-default",
    "children": [],
    "props": {
      "id": "item-2"
    },
    "visual": {},
    "descendantPatches": [
      {
        "templatePath": [
          "lib:template:component-listbox-item-default",
          "lib:template:component-listbox-item-default__icon"
        ],
        "enabled": false
      },
      {
        "templatePath": [
          "lib:template:component-listbox-item-default",
          "lib:template:component-listbox-item-default__label"
        ],
        "props": {
          "children": "Item 2"
        }
      },
      {
        "templatePath": [
          "lib:template:component-listbox-item-default",
          "lib:template:component-listbox-item-default__description"
        ],
        "enabled": false
      }
    ]
  },
  {
    "id": "lib:template:component-menu-section",
    "definitionId": "lib:definition:type-MenuSection",
    "children": [
      "lib:template:component-menu-section__header",
      "lib:template:component-menu-section__item-1",
      "lib:template:component-menu-section__item-2"
    ],
    "props": {},
    "visual": {}
  },
  {
    "id": "lib:template:component-menu-section__header",
    "definitionId": "lib:definition:type-Header",
    "children": [],
    "props": {
      "children": "Section"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-menu-section__item-1",
    "definitionId": "lib:definition:origin-component-menu-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "descendantPatches": [
      {
        "templatePath": [
          "lib:template:component-menu-item-default",
          "lib:template:component-menu-item-default__icon"
        ],
        "enabled": false
      },
      {
        "templatePath": [
          "lib:template:component-menu-item-default",
          "lib:template:component-menu-item-default__label"
        ],
        "props": {
          "children": "Item 1"
        }
      },
      {
        "templatePath": [
          "lib:template:component-menu-item-default",
          "lib:template:component-menu-item-default__shortcut"
        ],
        "enabled": false
      },
      {
        "templatePath": [
          "lib:template:component-menu-item-default",
          "lib:template:component-menu-item-default__description"
        ],
        "enabled": false
      }
    ]
  },
  {
    "id": "lib:template:component-menu-section__item-2",
    "definitionId": "lib:definition:origin-component-menu-item-default",
    "children": [],
    "props": {},
    "visual": {},
    "descendantPatches": [
      {
        "templatePath": [
          "lib:template:component-menu-item-default",
          "lib:template:component-menu-item-default__icon"
        ],
        "enabled": false
      },
      {
        "templatePath": [
          "lib:template:component-menu-item-default",
          "lib:template:component-menu-item-default__label"
        ],
        "props": {
          "children": "Item 2"
        }
      },
      {
        "templatePath": [
          "lib:template:component-menu-item-default",
          "lib:template:component-menu-item-default__shortcut"
        ],
        "enabled": false
      },
      {
        "templatePath": [
          "lib:template:component-menu-item-default",
          "lib:template:component-menu-item-default__description"
        ],
        "enabled": false
      }
    ]
  },
  {
    "id": "lib:template:component-gridlist-section",
    "definitionId": "lib:definition:type-GridListSection",
    "children": [
      "lib:template:component-gridlist-section__header",
      "lib:template:component-gridlist-section__item-1",
      "lib:template:component-gridlist-section__item-2"
    ],
    "props": {},
    "visual": {}
  },
  {
    "id": "lib:template:component-gridlist-section__header",
    "definitionId": "lib:definition:type-Header",
    "children": [],
    "props": {
      "children": "Section"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-gridlist-section__item-1",
    "definitionId": "lib:definition:origin-component-gridlist-item-default",
    "children": [],
    "props": {
      "id": "item-1"
    },
    "visual": {},
    "descendantPatches": [
      {
        "templatePath": [
          "lib:template:component-gridlist-item-default",
          "lib:template:component-gridlist-item-default__label"
        ],
        "props": {
          "children": "Item 1"
        }
      },
      {
        "templatePath": [
          "lib:template:component-gridlist-item-default",
          "lib:template:component-gridlist-item-default__description"
        ],
        "enabled": false
      }
    ]
  },
  {
    "id": "lib:template:component-gridlist-section__item-2",
    "definitionId": "lib:definition:origin-component-gridlist-item-default",
    "children": [],
    "props": {
      "id": "item-2"
    },
    "visual": {},
    "descendantPatches": [
      {
        "templatePath": [
          "lib:template:component-gridlist-item-default",
          "lib:template:component-gridlist-item-default__label"
        ],
        "props": {
          "children": "Item 2"
        }
      },
      {
        "templatePath": [
          "lib:template:component-gridlist-item-default",
          "lib:template:component-gridlist-item-default__description"
        ],
        "enabled": false
      }
    ]
  },
  {
    "id": "lib:template:component-table-column",
    "definitionId": "lib:definition:type-Column",
    "children": [],
    "props": {
      "children": "Column"
    },
    "visual": {}
  },
  {
    "id": "lib:template:component-table-row",
    "definitionId": "lib:definition:type-Row",
    "children": [],
    "props": {},
    "visual": {}
  },
  {
    "id": "lib:template:component-modal",
    "definitionId": "lib:definition:type-Modal",
    "children": [],
    "props": {},
    "visual": {
      "borderWidth": "1px"
    }
  }
];

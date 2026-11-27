// ADR-322 Phase 1 — the Cascader origin (breakdown §4.1): Select's closed field — the label row
// (Label origin + necessity parts), the open Button (Button origin: `SelectValue` + chevron Icon),
// Description, FieldError — and a small static hierarchy of `CascaderItem`s (three levels, one
// branch shallower), so a placed Cascader has something to drill into.
import type { LibraryDefinition, LibraryTemplateNode } from "./types";

const T = "lib:template:component-cascader" as const;
type TemplateId = `lib:template:${string}`;

export const CASCADER_DEFINITIONS: readonly LibraryDefinition[] = [
  {
    id: "lib:definition:origin-component-cascader",
    name: "Cascader",
    mode: "composite",
    accepts: {
      label: "string",
      description: "string",
      errorMessage: "string",
      placeholder: "string",
      iconName: "string",
    },
    defaults: {
      label: "Category",
      description: "",
      errorMessage: "",
      placeholder: "Choose an option...",
      iconName: "chevron-down",
    },
    visual: {},
    stateRules: {},
    templateRootId: T,
  },
];

const item = (
  path: string,
  key: string,
  label: string,
  children: readonly string[] = [],
): LibraryTemplateNode => ({
  id: `${T}__item-${path}` as TemplateId,
  definitionId: "lib:definition:type-CascaderItem",
  children: children.map((child): TemplateId => `${T}__item-${child}`),
  props: { id: key, label },
  visual: {},
});

export const CASCADER_TEMPLATES: readonly LibraryTemplateNode[] = [
  {
    id: T,
    definitionId: "lib:definition:type-Cascader",
    children: [
      `${T}__1-row`,
      `${T}__2`,
      `${T}__description`,
      `${T}__error`,
      `${T}__item-1`,
      `${T}__item-2`,
      `${T}__item-3`,
    ],
    props: {
      label: "Category",
      name: "",
      placeholder: "Choose an option...",
      labelPosition: "top",
      mode: "columns",
      displayMode: "path",
      isDisabled: false,
      isInvalid: false,
      isRequired: false,
    },
    visual: {},
  },
  {
    id: `${T}__1-row`,
    definitionId: "lib:definition:type-FieldLabel",
    children: [`${T}__1`],
    props: {},
    visual: {},
  },
  {
    id: `${T}__1`,
    definitionId: "lib:definition:origin-component-label",
    children: [
      `${T}__1__label-content`,
      `${T}__1__necessity-space`,
      `${T}__1__necessity-icon`,
      `${T}__1__necessity-label`,
    ],
    props: { children: "{label}", size: "{size}" },
    presentWhen: "nonEmptyText",
    visual: {},
  },
  {
    id: `${T}__1__label-content`,
    definitionId: "lib:definition:text",
    children: [],
    props: { children: "{fieldLabel}", slot: "label-content" },
    visual: {},
  },
  {
    id: `${T}__1__necessity-space`,
    definitionId: "lib:definition:text",
    children: [],
    props: { children: " ", slot: "necessity-space" },
    visual: {},
  },
  {
    id: `${T}__1__necessity-icon`,
    definitionId: "lib:definition:type-Icon",
    children: [],
    props: { iconName: "s2-asterisk", slot: "necessity-icon" },
    visual: {},
  },
  {
    id: `${T}__1__necessity-label`,
    definitionId: "lib:definition:text",
    children: [],
    props: { children: "{necessityLabel}", slot: "necessity-label" },
    visual: {},
  },
  {
    id: `${T}__2`,
    definitionId: "lib:definition:origin-component-button",
    children: [`${T}__2_1`, `${T}__2_2`],
    props: { variant: "secondary", label: "" },
    visual: {},
  },
  {
    id: `${T}__2_1`,
    definitionId: "lib:definition:type-SelectValue",
    children: [],
    props: { children: "{placeholder}" },
    visual: {},
  },
  {
    id: `${T}__2_2`,
    definitionId: "lib:definition:type-Icon",
    children: [],
    props: { iconName: "{iconName}" },
    visual: {},
  },
  {
    id: `${T}__description`,
    definitionId: "lib:definition:origin-component-description",
    children: [],
    props: { children: "{description}" },
    presentWhen: "nonEmptyText",
    visual: {},
  },
  {
    id: `${T}__error`,
    definitionId: "lib:definition:origin-component-fielderror",
    children: [],
    props: { children: "{errorMessage}" },
    visual: {},
  },
  item("1", "electronics", "Electronics", ["1-1", "1-2"]),
  item("1-1", "computers", "Computers", ["1-1-1", "1-1-2"]),
  item("1-1-1", "laptops", "Laptops"),
  item("1-1-2", "desktops", "Desktops"),
  item("1-2", "phones", "Phones", ["1-2-1", "1-2-2"]),
  item("1-2-1", "smartphones", "Smartphones"),
  item("1-2-2", "accessories", "Accessories"),
  item("2", "clothing", "Clothing", ["2-1", "2-2"]),
  item("2-1", "men", "Men"),
  item("2-2", "women", "Women"),
  item("3", "books", "Books"),
];

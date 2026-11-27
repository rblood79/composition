// ADR-320 Phase 2 — the filter bar's origins (breakdown §5.4): the chip (`component-filterchip` — a
// condition's field text, its comparison · value buttons, its menu and its remove button; the texts
// are the chip's `field` · `comparison` · `value`, its row's once the bar is connected) and the
// palette's FilterBar (the chips' frame — slot 「Conditions」 — and 「Add filter」 · 「Edit conditions」
// · 「Clear」; the last is there while `showClear` is on).
import type { LibraryDefinition, LibraryTemplateNode } from "./types";

/** The palette FilterBar's origin (`filtersOf` stands on its instances only — graph). */
export const FILTER_BAR_ORIGIN_ID = "lib:definition:origin-component-filterbar";
export const FILTER_CHIP_ORIGIN_ID =
  "lib:definition:origin-component-filterchip";
const ACTION_BUTTON = "lib:definition:origin-component-actionbutton";

export const FILTER_BAR_DEFINITIONS: readonly LibraryDefinition[] = [
  {
    id: FILTER_CHIP_ORIGIN_ID,
    name: "FilterChip",
    mode: "composite",
    accepts: {
      field: "string",
      comparison: "string",
      value: "string",
      label: "string",
    },
    defaults: {
      field: "Field",
      comparison: "Contains",
      value: "Value",
      label: "Field Contains Value",
    },
    visual: {},
    stateRules: {},
    templateRootId: "lib:template:component-filterchip",
  },
  {
    id: FILTER_BAR_ORIGIN_ID,
    name: "FilterBar",
    mode: "composite",
    accepts: { showClear: "boolean" },
    defaults: { showClear: true },
    visual: {},
    stateRules: {},
    templateRootId: "lib:template:component-filterbar",
    // (「Clear」 stands while `showClear` is on — `presentWith` reads a text.)
    bindingMaps: {
      filterClearShown: {
        from: "showClear",
        values: { false: "" },
        otherwise: "true",
      },
    },
  },
];

const button = (
  id: string,
  props: Record<string, string | boolean>,
  extra: Partial<LibraryTemplateNode> = {},
): LibraryTemplateNode => ({
  id: `lib:template:${id}`,
  definitionId: ACTION_BUTTON,
  children: [],
  props: { isQuiet: true, ...props },
  visual: {},
  ...extra,
});

export const FILTER_BAR_TEMPLATES: readonly LibraryTemplateNode[] = [
  {
    id: "lib:template:component-filterchip",
    definitionId: "lib:definition:type-FilterChip",
    children: [
      "lib:template:component-filterchip__field",
      "lib:template:component-filterchip__comparison",
      "lib:template:component-filterchip__value",
      "lib:template:component-filterchip__menu",
      "lib:template:component-filterchip__remove",
    ],
    props: { label: "{label}" },
    visual: {},
  },
  {
    id: "lib:template:component-filterchip__field",
    definitionId: "lib:definition:text",
    children: [],
    props: { children: "{field}" },
    // (The field text's room before the quiet buttons — the chip's own padding is the buttons'.)
    visual: { paddingLeft: 6, paddingRight: 2 },
  },
  // (A group's chip has no comparison · value; `exists` · `notExists` no value — §5.5.)
  button(
    "component-filterchip__comparison",
    { label: "{comparison}" },
    { presentWith: "comparison" },
  ),
  button(
    "component-filterchip__value",
    { label: "{value}" },
    { presentWith: "value" },
  ),
  button("component-filterchip__menu", {
    label: "",
    icon: "ellipsis",
    "aria-label": "Condition menu",
  }),
  button("component-filterchip__remove", {
    label: "",
    icon: "x",
    "aria-label": "Remove condition",
  }),
  {
    id: "lib:template:component-filterbar",
    definitionId: "lib:definition:type-FilterBar",
    children: [
      "lib:template:component-filterbar__chips",
      "lib:template:component-filterbar__add",
      "lib:template:component-filterbar__edit",
      "lib:template:component-filterbar__clear",
    ],
    props: { size: "M", variant: "chips", showClear: "{showClear}" },
    visual: {},
  },
  {
    id: "lib:template:component-filterbar__chips",
    definitionId: "lib:definition:type-frame",
    slot: { name: "Conditions", required: false },
    children: ["lib:template:component-filterbar__chip"],
    props: {},
    visual: {},
    layout: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      rowGap: "8px",
      columnGap: "8px",
    },
  },
  {
    id: "lib:template:component-filterbar__chip",
    definitionId: FILTER_CHIP_ORIGIN_ID,
    children: [],
    props: {},
    visual: {},
  },
  button("component-filterbar__add", { label: "Add filter", icon: "plus" }),
  button("component-filterbar__edit", {
    label: "Edit conditions",
    icon: "list-filter",
  }),
  button(
    "component-filterbar__clear",
    { label: "Clear" },
    { presentWith: "filterClearShown" },
  ),
];

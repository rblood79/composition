// ADR-322 Phase 1 — the Cascader origin (breakdown §4.1): Select's closed field — the label row
// (Label origin + necessity parts), the open Button (Button origin: `SelectValue` + chevron Icon),
// Description, FieldError — and a small static hierarchy of `CascaderItem`s (three levels, one
// branch shallower), so a placed Cascader has something to drill into.
//
// ADR-326 Phase 1 (breakdown §4.1) — the open content is nodes, in Select's place: `Popover >
// (「Back」 ActionButton (drill) + SearchField) + Breadcrumbs (drill) + CascaderList > CascaderItem…`
// (the head row — 사용자 결정 2026-11-29).
// The mode does not change the structure — the two drill parts stand by `bindingMaps` +
// `presentWith` (the `mode` the origin accepts). The trail is four crumb positions, not repeated
// rows (a library position takes no `repeat` — ADR-326 F8; S2 Breadcrumbs draws four at most — F18).
// 사용자 결정 2 (2026-11-28 — the alternative): each item holds its name Text and its chevron Icon
// as child nodes (the item origin below — a TreeItem's · MenuItem's shape); the item's `label`
// stays the name the field reads, the Text binds it.
import type { LibraryDefinition, LibraryTemplateNode } from "./types";

const T = "lib:template:component-cascader" as const;
type TemplateId = `lib:template:${string}`;

/**
 * ADR-326 사용자 결정 2 — the item origin: `CascaderItem > Icon (check) + Text {label} + Icon
 * (chevron)` (the check mark — Phase 4 판독 1, 사용자 답 2026-11-28).
 */
export const CASCADER_ITEM_ORIGIN_ID =
  "lib:definition:origin-component-cascaderitem" as const;
const IT = "lib:template:component-cascaderitem" as const;
/** ADR-326 — the key `mode: "drill"` gives the drill-only parts (`presentWith`). */
export const CASCADER_DRILL_BINDING = "cascaderDrill";
/** ADR-326 §4.4 — the trail's crumb positions (S2 Breadcrumbs draws four at most). */
export const CASCADER_TRAIL_SLOTS = 4;

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
      // (ADR-326 Round 1 h4 — `bindingMaps.from` reads an accepted key: the template root's `mode`.)
      mode: "string",
    },
    defaults: {
      label: "Category",
      description: "",
      errorMessage: "",
      placeholder: "Choose an option...",
      iconName: "chevron-down",
      // (사용자 결정 2026-11-29 「가벼운 쪽」 — the reference's default: one level at a time.)
      mode: "drill",
    },
    visual: {},
    stateRules: {},
    templateRootId: T,
    // (ADR-326 §4.1 — the trail and 「Back」 stand while the mode is `drill`.)
    bindingMaps: {
      [CASCADER_DRILL_BINDING]: { from: "mode", values: { drill: "1" } },
    },
  },
  {
    id: CASCADER_ITEM_ORIGIN_ID,
    name: "CascaderItem",
    mode: "composite",
    accepts: { label: "string" },
    defaults: { label: "Item" },
    visual: {},
    stateRules: {},
    templateRootId: IT,
  },
];

const item = (
  path: string,
  key: string,
  label: string,
  children: readonly string[] = [],
): LibraryTemplateNode => ({
  id: `${T}__item-${path}` as TemplateId,
  definitionId: CASCADER_ITEM_ORIGIN_ID,
  children: children.map((child): TemplateId => `${T}__item-${child}`),
  props: { id: key, label },
  visual: {},
});

/** A trail crumb position (its text is the path's — derived, not authored: ADR-326 §4.4). */
const crumb = (index: number): LibraryTemplateNode => ({
  id: `${T}__crumb-${index}` as TemplateId,
  definitionId: "lib:definition:origin-component-breadcrumb-item-default",
  children: [],
  props: {},
  visual: {},
  descendantPatches: [
    {
      templatePath: [
        "lib:template:component-breadcrumb-item-default",
        "lib:template:component-breadcrumb-item-default__label",
      ],
      props: { children: "" },
    },
  ],
});

/** The item origin's template (사용자 결정 2): the check mark, the name Text, the chevron (MenuItem's). */
export const CASCADER_ITEM_TEMPLATES: readonly LibraryTemplateNode[] = [
  {
    id: IT,
    definitionId: "lib:definition:type-CascaderItem",
    children: [
      `${IT}__check`,
      `${IT}__label`,
      `${IT}__count`,
      `${IT}__chevron`,
    ],
    props: { label: "{label}" },
    visual: {},
  },
  // (ADR-326 Phase 4 판독 1 #1, 사용자 답 2026-11-28 「check Icon 부품」 — the selected row's mark
  //  is a node, as a Menu item's (`selectionItemTemplates` `__check`): S2 Menu's checkmark column,
  //  drawn on the picked row — the Canvas's `_selectionMarkHidden`, the DOM's RAC `isSelected`.
  //  Its grid column and margin are the item rule's (MenuItem's `[slot="selection"]` blocks).)
  {
    id: `${IT}__check`,
    definitionId: "lib:definition:type-Icon",
    children: [],
    props: { slot: "selection", iconName: "check", size: "S" },
    visual: {
      width: 16,
      height: 16,
      color: { kind: "token", tokenId: "lib:token:color_accent" },
    },
  },
  {
    id: `${IT}__label`,
    definitionId: "lib:definition:text",
    children: [],
    props: { slot: "label", children: "{label}" },
    visual: {},
  },
  // (사용자 결정 2026-11-29 — a branch row's item count, the reference's: how many items its next
  //  level holds, before the chevron — derived (`catalogCascaderCount`), not drawn on a leaf. Its
  //  place is the item rule's `[slot="count"]` block, its look written here: small and quieter.)
  {
    id: `${IT}__count`,
    definitionId: "lib:definition:text",
    children: [],
    props: { slot: "count", children: "" },
    visual: { fontSize: 12, opacity: 0.6 },
  },
  {
    id: `${IT}__chevron`,
    definitionId: "lib:definition:type-Icon",
    children: [],
    props: { slot: "descriptor", iconName: "chevron-right", size: "XS" },
    visual: {},
  },
];

export const CASCADER_TEMPLATES: readonly LibraryTemplateNode[] = [
  {
    id: T,
    definitionId: "lib:definition:type-Cascader",
    children: [
      `${T}__1-row`,
      `${T}__2`,
      `${T}__description`,
      `${T}__error`,
      `${T}__popover`,
    ],
    props: {
      label: "Category",
      name: "",
      placeholder: "Choose an option...",
      labelPosition: "top",
      mode: "drill",
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
  // ADR-326 §4.1 — the open content (Select's `__popover` place).
  {
    id: `${T}__popover`,
    definitionId: "lib:definition:type-Popover",
    children: [`${T}__head`, `${T}__trail`, `${T}__list`],
    props: {},
    visual: {},
  },
  // (사용자 결정 2026-11-29 — the reference's head row: 「Back」 before the search box, one row; on
  //  the top level — and off `drill` — the search box alone fills it.)
  {
    id: `${T}__head`,
    definitionId: "lib:definition:type-frame",
    children: [`${T}__back`, `${T}__search`],
    props: {},
    visual: {},
    layout: { display: "flex", alignItems: "center", columnGap: "4px" },
  },
  {
    // (No visible label — the field names the search box: ADR-322 Phase 5's 「검색」 i18n name.)
    id: `${T}__search`,
    definitionId: "lib:definition:origin-component-searchfield",
    children: [],
    props: { label: "" },
    // (In the head row it gives way to 「Back」 — its own content's width (a large size's input)
    //  does not hold it wider than the row: G5 live, XL.)
    visual: { minWidth: 0 },
  },
  {
    id: `${T}__trail`,
    definitionId: "lib:definition:type-Breadcrumbs",
    children: Array.from(
      { length: CASCADER_TRAIL_SLOTS },
      (_, index): TemplateId => `${T}__crumb-${index + 1}`,
    ),
    props: {},
    presentWith: CASCADER_DRILL_BINDING,
    visual: {},
  },
  ...Array.from({ length: CASCADER_TRAIL_SLOTS }, (_, index) =>
    crumb(index + 1),
  ),
  {
    // (Quiet, icon only — one level up; its name is the i18n 「Back」 the field's `back` slot gives.)
    id: `${T}__back`,
    definitionId: "lib:definition:origin-component-actionbutton",
    children: [],
    props: {
      slot: "back",
      isQuiet: true,
      label: "",
      icon: "chevron-left",
    },
    presentWith: CASCADER_DRILL_BINDING,
    visual: {},
  },
  {
    id: `${T}__list`,
    definitionId: "lib:definition:type-CascaderList",
    children: [`${T}__item-1`, `${T}__item-2`, `${T}__item-3`],
    props: {},
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
  ...CASCADER_ITEM_TEMPLATES,
];

import type { PrimitiveBinding } from "../types";
import { ITEM_KEY_PROP_CONTRACT } from "../document/itemLinks";
import { ITEM_DATA_BINDING_PROP } from "./loadingStateProps";
import { OVERLAY_OPEN_PROPS } from "./overlayOpenProps";

/**
 * ADR-322 — Cascader: a field that drills into a hierarchy. S2 1.8.2 · design-data · v3 have none
 * (Phase 0 — v3 3.47.7 export list), so it is a composition type (`d2Provenance.ts`
 * `CATALOG_D2_COMPOSITION_TYPES`); its field props carry S2 Picker's names (Select's keys).
 *
 * DOM: `delegatedDom.runtime.ts` `cascader` — the field's node tree (`Label` row + `Button`
 * (`SelectValue` + `Icon`) + `Description` + `FieldError` — Select's part origins, breakdown §4.1)
 * inside the RAC contexts the field gives (no RAC picker owns them). The items (`CascaderItem`,
 * nested) are the hierarchy — not drawn while closed (Canvas `catalogHiddenAtRest`, DOM nothing).
 * Canvas: the closed field (Select's rule shape) and the start value's text (`runtime/cascader.ts`
 * `cascaderValueText` — the DOM reads the same record).
 */
export const cascaderBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "cascader" },
  props: {
    accepts: {
      // ADR-322 Phase 4: the hierarchy's data — a Tree's roles (`children` nested · `parentId`
      //   flat); every row is read (the levels are the whole of it).
      dataBinding: {
        kind: "binding",
        label: "Data source",
        section: "collection",
      },
      // (The run's value — a rule's write · a named state; the panel edits the start value.)
      value: {
        editorHidden: true,
        kind: "selection-value",
        label: "Value",
        section: "value",
      },
      // An item's key (HC4) — a key list while `selectionMode: "multiple"` (사용자 결정 3); the path is
      //   computed (breakdown §4.2). The Design panel offers the pickable items as Select's Value
      //   does (`catalogGroupKeysFields` — 2026-11-28 사용자 요청).
      defaultValue: {
        kind: "selection-value",
        label: "Value",
        section: "value",
      },
      // ADR-326 Phase 4 — S2 Picker's open state: the Value section's 「Open」 draws the just-opened
      //   screen on the Canvas too (ADR-322 결정 11 · R6 대체), a running Preview starts open.
      ...OVERLAY_OPEN_PROPS,
      label: { kind: "string", label: "Label", section: "content" },
      description: {
        kind: "string",
        label: "Description",
        section: "content",
      },
      placeholder: {
        kind: "string",
        label: "Placeholder",
        section: "content",
      },
      // 사용자 결정 2026-11-29 「가벼운 쪽」: `drill` — the reference's default (one level at a time,
      //   RAC GridList + Breadcrumbs); 사용자 결정 1 (2026-11-27) `columns` 대체.
      mode: {
        kind: "enum",
        label: "Mode",
        section: "behavior",
        default: "drill",
        options: [
          { value: "drill", label: "Drill" },
          { value: "columns", label: "Columns" },
          { value: "tree", label: "Tree" },
        ],
      },
      // 사용자 결정 2026-11-29 — the reference's `searchScope`: a query narrows the level shown
      //   (default), that level and the ones under it, or every level (ADR-322 결정 8 — the only way
      //   before). A `tree` field always searches every level (its rows are every level's).
      searchScope: {
        kind: "enum",
        label: "Search scope",
        section: "behavior",
        default: "level",
        options: [
          { value: "level", label: "This level" },
          { value: "deep", label: "This level and below" },
          { value: "global", label: "All levels" },
        ],
        visibleWhen: { key: "mode", oneOf: ["drill", "columns"] },
      },
      // 사용자 결정 3 (2026-11-27): several items — the value is their keys (no cascade: RAC draws no
      //   partial selection). RAC's name (Select · Menu · Tree `selectionMode`).
      selectionMode: {
        kind: "enum",
        label: "Selection Mode",
        section: "state",
        default: "single",
        options: [
          { value: "single", label: "Single" },
          { value: "multiple", label: "Multiple" },
        ],
      },
      // 사용자 결정 2 (2026-11-27): a branch is a value too (「서울 전체」) — off = leaves only.
      allowsBranchSelection: {
        kind: "boolean",
        label: "Select any level",
        section: "state",
      },
      // 사용자 결정 7 (2026-11-27): the whole path — a leaf name repeats across parents.
      displayMode: {
        kind: "enum",
        label: "Display",
        section: "content",
        default: "path",
        options: [
          { value: "path", label: "Path" },
          { value: "leaf", label: "Leaf" },
        ],
      },
      separator: {
        kind: "string",
        label: "Separator",
        section: "content",
        visibleWhen: { key: "displayMode", equals: "path" },
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
      },
      labelPosition: {
        kind: "enum",
        label: "Label Position",
        section: "appearance",
        default: "top",
        options: [
          { value: "top", label: "Top" },
          { value: "side", label: "Side" },
        ],
      },
      labelAlign: {
        kind: "enum",
        label: "Label align",
        section: "appearance",
        default: "start",
        options: [
          { value: "start", label: "Start" },
          { value: "end", label: "End" },
        ],
        visibleWhen: { key: "labelPosition", equals: "side" },
      },
      isQuiet: { kind: "boolean", label: "Quiet", section: "appearance" },
      necessityIndicator: {
        kind: "enum",
        label: "Necessity Indicator",
        section: "appearance",
        default: "icon",
        options: [
          { value: "icon", label: "Icon" },
          { value: "label", label: "Label" },
        ],
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      isRequired: { kind: "boolean", label: "Required", section: "validation" },
      isInvalid: { kind: "boolean", label: "Invalid", section: "validation" },
      errorMessage: {
        kind: "string",
        label: "Error Message",
        section: "validation",
      },
      name: { kind: "string", label: "Name", section: "forms" },
    },
    toRacProps: "default",
    propPassthrough: ["size"],
  },
};

/** A size the field carries to its list and rows (no panel field — S2 menu items have none). */
const CASCADER_CARRIED_SIZE = {
  kind: "size",
  label: "Size",
  section: "appearance",
  default: "M",
  editorHidden: true,
} as const;

/**
 * ADR-326 §4.1 — a Cascader's level list box (`Popover > CascaderList > CascaderItem…` — Select's
 * `Popover > ListBox` place). No prop of its own: the field's size reaches it. DOM (ADR-326 Phase
 * 2): the RAC collection the mode builds (`Menu` · `Tree` · `GridList`) is this node's element; until
 * then it is not drawn (the field's lazy chunk builds the open content from the item table).
 */
export const cascaderListBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "cascaderlist" },
  props: {
    // (The field's size, carried — `CATALOG_SIZE_PROPAGATION.Cascader`; not edited here.)
    accepts: { size: CASCADER_CARRIED_SIZE },
    toRacProps: "default",
    propPassthrough: ["size"],
  },
};

/**
 * ADR-322 — one item of a Cascader's hierarchy (nested: its child items are its next level). Its key
 * is the value (`id`), its name the text the field shows. Not drawn while the field is closed.
 */
export const cascaderItemBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "cascaderitem" },
  props: {
    accepts: {
      // (A RAC item's key — the shared contract the Properties panel reads apart from the HTML id.)
      id: ITEM_KEY_PROP_CONTRACT,
      // ADR-322 Phase 4 (사용자 결정 5): a level item's own table — under each item above, its rows
      //   whose 「parent level」 field is that item's key.
      dataBinding: ITEM_DATA_BINDING_PROP,
      label: { kind: "string", label: "Label", section: "content" },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      // (Its list's size, carried — the row's look · its label text, S2 menu item.)
      size: CASCADER_CARRIED_SIZE,
    },
    toRacProps: "default",
  },
};

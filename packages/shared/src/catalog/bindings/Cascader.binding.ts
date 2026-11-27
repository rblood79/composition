import type { PrimitiveBinding } from "../types";
import { ITEM_KEY_PROP_CONTRACT } from "../document/itemLinks";

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
      // (The run's value — a rule's write · a named state; the panel edits the start value.)
      value: {
        editorHidden: true,
        kind: "string",
        label: "Value",
        section: "value",
      },
      // An item's key (HC4) — the path is computed (breakdown §4.2).
      defaultValue: { kind: "string", label: "Value", section: "value" },
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
      // 사용자 결정 1 (2026-11-27): `columns` — RAC Menu + SubmenuTrigger.
      mode: {
        kind: "enum",
        label: "Mode",
        section: "behavior",
        default: "columns",
        options: [
          { value: "columns", label: "Columns" },
          { value: "tree", label: "Tree" },
          { value: "drill", label: "Drill" },
        ],
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
      label: { kind: "string", label: "Label", section: "content" },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
};

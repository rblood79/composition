import type { PrimitiveBinding } from "../types";

/**
 * ADR-320 — FilterBar · FilterChip: the run-time condition bar over the lists it filters
 * (`filtersOf` — one condition tree over them, breakdown §5.1). S2 · design-data · v3 have no filter
 * bar (Phase 0 「D2 확인」), so every prop is a composition extension (`d2Provenance.ts`), named as
 * RAC · S2 name the same things (`defaultQuery` as `defaultValue`, `isDisabled` · `isReadOnly`,
 * `size` · `variant`).
 *
 * Node tree: `FilterBar > frame (the chips — slot 「Conditions」) > FilterChip*` + three ActionButtons
 * (「Add filter」 · 「Edit conditions」 · 「Clear」). A chip repeats per root item of the tree once the
 * bar is connected (resolver rows — `runtime/filterBar.ts`); its field text, comparison and value
 * are the row's. D1: RAC `Toolbar` (its name) > RAC `Group` per chip (its name 「field comparison
 * value」) — no role · aria literal (breakdown §4).
 *
 * The Canvas draws the authored start (`defaultQuery`); the Preview's chips read the scope's tree
 * (Phase 3). `variant: "builder"` lays the tree out in place (Phase 4).
 */
export const filterBarBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "filterbar" },
  props: {
    accepts: {
      defaultQuery: {
        kind: "filter-query",
        label: "Start conditions",
        section: "value",
      },
      presets: {
        kind: "filter-presets",
        label: "Saved filters",
        section: "value",
      },
      hiddenFields: {
        editorHidden: true,
        kind: "string-array",
        label: "Hidden fields",
        section: "content",
      },
      fieldOrder: {
        editorHidden: true,
        kind: "string-array",
        label: "Field order",
        section: "content",
      },
      variant: {
        kind: "enum",
        label: "Variant",
        section: "appearance",
        default: "chips",
        options: [
          { value: "chips", label: "Chips" },
          { value: "builder", label: "Builder" },
        ],
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
        options: [
          { value: "S", label: "S" },
          { value: "M", label: "M" },
          { value: "L", label: "L" },
        ],
      },
      showClear: {
        kind: "boolean",
        label: "Clear button",
        section: "behavior",
        default: true,
      },
      rememberFilters: {
        kind: "boolean",
        label: "Remember filters",
        section: "behavior",
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      isReadOnly: { kind: "boolean", label: "Read Only", section: "state" },
    },
    toRacProps: "default",
  },
};

/** A chip: its texts are its row's (resolver — `catalogFilterChips`), never authored. */
export const filterChipBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "filterchip" },
  props: {
    accepts: {
      field: {
        editorHidden: true,
        kind: "string",
        label: "Field",
        section: "content",
      },
      comparison: {
        editorHidden: true,
        kind: "string",
        label: "Comparison",
        section: "content",
      },
      value: {
        editorHidden: true,
        kind: "string",
        label: "Value",
        section: "content",
      },
      label: {
        editorHidden: true,
        kind: "string",
        label: "Label",
        section: "content",
      },
      // (ADR-320 Phase 3 — the root item the chip shows: its row's key, never authored.)
      conditionId: {
        editorHidden: true,
        kind: "string",
        label: "Condition",
        section: "content",
      },
      size: {
        editorHidden: true,
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
      },
      isDisabled: {
        editorHidden: true,
        kind: "boolean",
        label: "Disabled",
        section: "state",
      },
    },
    toRacProps: "default",
  },
};

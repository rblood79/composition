import type { PrimitiveBinding } from "../types";

/**
 * Autocomplete — RAC `Autocomplete` (ADR-256 Phase 6g — Decision 8, react-aria.adobe.com
 * Autocomplete: `Autocomplete > SearchField | TextField + ListBox | GridList | TagGroup | Table |
 * Menu`). It filters the collection inside by the text field's value: RAC gives the field its input
 * props (`FieldInputContext`) and the collection its filter · virtual focus
 * (`SelectableCollectionContext`).
 *
 * D1: RAC's `Autocomplete` as is — no element of its own (the DOM puts its children in its
 *     parent's flow; the Canvas lays it out as `display: contents`).
 * D2: RAC `AutocompleteProps` — `defaultInputValue` · `disableAutoFocusFirst` ·
 *     `disableVirtualFocus` (the filter is the reference's `useFilter({sensitivity: "base"})
 *     .contains`).
 * D3: none — `COMPONENT_RULES_TABLE.Autocomplete` is a `display: contents` container.
 */
export const autocompleteBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "autocomplete",
  },
  props: {
    accepts: {
      defaultInputValue: {
        kind: "string",
        label: "Default Input Value",
        section: "content",
      },
      disableAutoFocusFirst: {
        kind: "boolean",
        label: "Disable Auto Focus First",
        section: "state",
      },
      disableVirtualFocus: {
        kind: "boolean",
        label: "Disable Virtual Focus",
        section: "state",
      },
    },
    toRacProps: "default",
  },
};

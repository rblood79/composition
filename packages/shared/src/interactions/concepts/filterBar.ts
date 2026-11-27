import type { InteractionConcept } from "./types";

/**
 * ADR-320 Phase 5 (breakdown §5.9) — a filter bar's scope tree as a state. RAC · S2 · v3 have no
 * filter bar (Phase 0 「D2 확인」), so the names are composition extensions (`d2Provenance.ts`),
 * shaped as a RAC state is: the applied conditions' count (`appliedFilters` — the named state) and
 * its change callback (`onFilterChange` — When 「필터 변경」: a viewer's change of what applies; a
 * condition still being entered applies nothing, and a Do's write does not call it, as RAC calls a
 * change callback for the user's change only). The Dos write the tree through the scope's one
 * assignment (`CatalogFilterScopes.assign` — a condition the scope cannot take is a failure, never
 * dropped in silence).
 */
export interface FilterBarStateProps {
  appliedFilters?: number;
  onFilterChange?: (count: number) => void;
  isDisabled?: boolean;
  isReadOnly?: boolean;
}

export const filterConditions = {
  id: "filterConditions",
  racDoc: "ADR-320 — the filter bar's scope tree (composition FilterBar)",
  racType: "FilterBarStateProps",
  events: ["onFilterChange"],
  args: { onFilterChange: ["count"] },
  state: {
    prop: "appliedFilters",
    callback: "onFilterChange",
    valueType: "number",
  },
  conditions: ["isDisabled"],
  capabilities: {
    addFilterCondition: {
      labelKey: "capabilities.addFilterCondition",
      value: "!param",
      param: {
        kind: "filter-condition",
        labelKey: "capabilities.paramFilterCondition",
      },
      filter: "add",
    },
    removeFilterCondition: {
      labelKey: "capabilities.removeFilterCondition",
      value: "!param",
      param: {
        kind: "filter-field",
        labelKey: "capabilities.paramFilterField",
      },
      filter: "remove",
    },
    clearFilterConditions: {
      labelKey: "capabilities.clearFilterConditions",
      value: null,
      filter: "clear",
    },
  },
} as const satisfies InteractionConcept;

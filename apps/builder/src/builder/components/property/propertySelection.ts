import { createContext, useContext } from "react";

/**
 * ADR-248 4e-7: which selection a property field edits — a typed value commits on blur only while
 * the selection is still the one the field was focused on (a click on another element blurs the
 * field after the selection changed), and a new selection resets the field. The catalog Builder
 * provides its session's selection (`CatalogBuilderCore`); without a provider there is no
 * selection to compare (a field on its own commits what it holds).
 */
export interface PropertySelectionSource {
  /** Subscribes: the current selection's identity (`null` = nothing selected). */
  useSelectedId(): string | null;
  /** The selection's identity now (the blur check). */
  readSelectedId(): string | null;
}

const NO_SELECTION: PropertySelectionSource = {
  useSelectedId: () => null,
  readSelectedId: () => null,
};

export const PropertySelectionContext =
  createContext<PropertySelectionSource>(NO_SELECTION);

export function usePropertySelection(): PropertySelectionSource {
  return useContext(PropertySelectionContext);
}

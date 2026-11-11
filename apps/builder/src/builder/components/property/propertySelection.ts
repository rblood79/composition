import { createContext, useCallback, useContext, useState } from "react";

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

/**
 * A field's own UI state (a refusal note, an expanded row) that belongs to the element it was made
 * on. The Property fields stay mounted across a selection of the same type
 * (CANVAS_PERF_SCALING_2026-11 C1), so plain state would follow to the next element: this state
 * starts over from `initial` whenever the selection changes — as a field keyed by the element did
 * (coming back to the first element does not bring its note back: the text it was about is gone).
 * Without a provider there is one selection (`null`) — plain state.
 */
export function useSelectionState<T>(
  initial: T,
): readonly [T, (next: T) => void] {
  const selectedId = usePropertySelection().useSelectedId();
  const [held, setHeld] = useState({ on: selectedId, value: initial });
  // Reset while rendering (React's "adjust state when a prop changes"): no frame shows the
  // previous element's state.
  const current =
    held.on === selectedId ? held : { on: selectedId, value: initial };
  if (current !== held) setHeld(current);
  const set = useCallback(
    (next: T) => setHeld({ on: selectedId, value: next }),
    [selectedId],
  );
  return [current.value, set];
}

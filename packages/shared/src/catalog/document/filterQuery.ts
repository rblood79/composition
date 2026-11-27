/**
 * ADR-320 Phase 2 — a filter bar's authored values: its start conditions (`defaultQuery` — a scope
 * tree, the root an `and`) and its named sets (`presets` — S2 · ReUI 「saved filters」: a name and a
 * tree each). The shape is the run-time tree's (`catalogFilterTreeRead`) — what the document holds is
 * what a scope can be assigned (the assignment judges the conditions, §5.3).
 */
import { catalogFilterTreeRead } from "../runtime/filterScope";
import type { ViewConditionGroup } from "./types";

export interface CatalogFilterPreset {
  readonly id: string;
  readonly name: string;
  readonly query: ViewConditionGroup;
}

/** A start tree: a scope tree of one condition at least (no tree = no field). */
export const catalogFilterQueryFits = (value: unknown): boolean =>
  !!value && typeof value === "object" && !!catalogFilterTreeRead(value);

/** Named sets: ids once each, a name each, a tree each. */
export function catalogFilterPresetsFit(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object") return false;
    const { id, name, query, ...rest } = item as Record<string, unknown>;
    if (Object.keys(rest).length) return false;
    if (typeof id !== "string" || !id || ids.has(id)) return false;
    if (typeof name !== "string" || !name.trim()) return false;
    if (!catalogFilterQueryFits(query)) return false;
    ids.add(id);
  }
  return true;
}

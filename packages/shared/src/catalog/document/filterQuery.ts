/**
 * ADR-320 Phase 2 — a filter bar's authored values: its start conditions (`defaultQuery` — a scope
 * tree, the root an `and`) and its named sets (`presets` — S2 · ReUI 「saved filters」: a name and a
 * tree each). The shape is the run-time tree's (`catalogFilterTreeRead`) — what the document holds is
 * what a scope can be assigned (the assignment judges the conditions, §5.3).
 */
import { catalogFilterTreeRead } from "../runtime/filterScope";
import { VIEW_COMPARISONS, type ViewConditionGroup } from "./types";

/** ADR-320 Phase 5 — a filter bar Do 「조건 넣기」's value (`catalogFilterDoConditionFits`). */
export interface CatalogFilterDoCondition {
  readonly field: string | readonly string[];
  readonly op: import("./types").ViewComparison;
  readonly value?: import("./types").ViewConditionValue;
  readonly unit?: "day" | "week" | "month" | "year";
}

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

const isScalar = (value: unknown) =>
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean";

/**
 * ADR-320 Phase 5 — a filter bar Do 「조건 넣기」's value: a field (its id, or a path of ids), a
 * comparison, and its value (a literal · a list · a value reference) and unit. Which field and
 * comparison the bar takes is the run's judgment (the bar's fields change with its lists' data).
 */
export function catalogFilterDoConditionFits(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const {
    field,
    op,
    value: compared,
    unit,
    ...rest
  } = value as Record<string, unknown>;
  if (Object.keys(rest).length) return false;
  const fieldOk =
    (typeof field === "string" && !!field) ||
    (Array.isArray(field) &&
      field.length > 0 &&
      field.every((step) => typeof step === "string" && !!step));
  return (
    fieldOk &&
    (VIEW_COMPARISONS as readonly unknown[]).includes(op) &&
    (compared === undefined ||
      isScalar(compared) ||
      (Array.isArray(compared) && compared.every(isScalar))) &&
    (unit === undefined ||
      ["day", "week", "month", "year"].includes(unit as string))
  );
}

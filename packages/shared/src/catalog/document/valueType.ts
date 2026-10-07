import type { ValueType } from "./types";

/**
 * A scalar value against its declared value type. `slot` (ADR-256 Decision 4) holds a slot name or
 * `false` (the explicit detach) — a condition, a part rule or a template value keyed on a slot name
 * (`[slot="description"]`) matches it like a string.
 */
export function scalarFitsType(
  value: unknown,
  type: ValueType | string | undefined,
): boolean {
  if (type === "slot") return typeof value === "string" || value === false;
  return type !== undefined && typeof value === type;
}

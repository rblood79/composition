export type CatalogSelectionKeys = readonly string[] | "all";

/** Document collection IDs are strings; the literal all sentinel remains a scalar. */
export function catalogSelectionKeysFits(
  value: unknown,
): value is CatalogSelectionKeys {
  return (
    value === "all" ||
    (Array.isArray(value) && value.every((key) => typeof key === "string"))
  );
}

/**
 * ADR-308 — S2 Picker's `value` (`ValueType<M>`): one key while it selects one, a list of keys while
 * it selects several. No `"all"` sentinel (RAC Select has none).
 */
export type CatalogSelectionValue = string | readonly string[];

export function catalogSelectionValueFits(
  value: unknown,
): value is CatalogSelectionValue {
  return (
    typeof value === "string" ||
    (Array.isArray(value) && value.every((key) => typeof key === "string"))
  );
}

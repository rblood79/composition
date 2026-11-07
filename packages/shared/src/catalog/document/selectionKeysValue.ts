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

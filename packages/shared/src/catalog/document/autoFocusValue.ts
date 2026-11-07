export function catalogAutoFocusFits(
  value: unknown,
): value is boolean | "first" | "last" {
  return typeof value === "boolean" || value === "first" || value === "last";
}

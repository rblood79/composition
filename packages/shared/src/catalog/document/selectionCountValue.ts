/** S2 ActionBar's count preserves its sentinel and rejects numeric strings. */
export function catalogSelectionCountFits(
  value: unknown,
): value is number | "all" {
  return (
    value === "all" ||
    (typeof value === "number" && Number.isInteger(value) && value >= 0)
  );
}
export function catalogSelectionCountText(
  value: unknown,
  locale = "en-US",
): string {
  if (value === "all")
    return locale.startsWith("ko") ? "모두 선택됨" : "All selected";
  const count = typeof value === "number" ? value : 0;
  return locale.startsWith("ko")
    ? `${new Intl.NumberFormat(locale).format(count)}개 선택됨`
    : `${new Intl.NumberFormat(locale).format(count)} selected`;
}

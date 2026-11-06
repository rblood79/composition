/** CSS inline-size containment supplies an intrinsic content-box contribution.
 * The parent still decides the used width; height is measured from the real contents.
 */
export function catalogInlineSizeContainment(
  layout: Readonly<Record<string, string>>,
): { contentMinWidth: number; contentMaxWidth: number } | undefined {
  if (layout.contain !== "inline-size") return undefined;
  const raw = layout.containIntrinsicWidth ?? "0";
  const value = raw === "0" ? 0 : Number(raw.replace(/px$/, ""));
  if (!Number.isFinite(value) || value < 0) return undefined;
  return { contentMinWidth: value, contentMaxWidth: value };
}

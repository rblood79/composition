/** Layout ownership does not imply paint ownership when the rule opts into variant paint. */
export function catalogCompositionUsesVariantPaint(
  composition: { rootPaint?: unknown } | undefined,
  ownsContainerBox: boolean,
): boolean {
  return composition?.rootPaint === "variant" || !ownsContainerBox;
}

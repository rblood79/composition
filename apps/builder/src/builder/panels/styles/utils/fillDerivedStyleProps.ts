export const FILL_DERIVED_STYLE_PROPS = [
  "backgroundColor",
  "backgroundImage",
  "backgroundSize",
] as const;

export function isFillDerivedStyleProp(property: string): boolean {
  return (FILL_DERIVED_STYLE_PROPS as readonly string[]).includes(property);
}

export function sanitizeFillDerivedStylePatch<
  T extends Record<string, unknown>,
>(styles: T, fillV2Enabled: boolean): T {
  if (!fillV2Enabled) return styles;

  return Object.fromEntries(
    Object.entries(styles).filter(([key]) => !isFillDerivedStyleProp(key)),
  ) as T;
}

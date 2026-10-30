import { typography } from "@composition/rendering";

/**
 * The px an element's inline `font-size` gives at desktop — a px value as written, or a typography
 * token's device variable (ADR-295 Phase 2: `var(--catalog-token-text-sm)`) read in the installed map.
 */
export function inlineFontPx(tag: string): number | undefined {
  const value = /font-size:\s*([^;"]+)/.exec(tag)?.[1]?.trim();
  if (!value) return undefined;
  const px = /^(-?\d+(?:\.\d+)?)px$/.exec(value);
  if (px) return Number(px[1]);
  const name = /^var\(--catalog-token-(text-[\w-]+)\)$/.exec(value)?.[1];
  const resolved = name
    ? (typography as unknown as Record<string, unknown>)[name]
    : undefined;
  return typeof resolved === "number" ? resolved : undefined;
}

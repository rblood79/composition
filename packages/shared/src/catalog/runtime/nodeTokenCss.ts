/**
 * ADR-298 D5 — the DOM writes a value the document wrote as a theme token (a node's · template node's ·
 * override's `TokenUse` — `catalogAuthoredTokenRef`; a rule's token keeps the value its sheet and the
 * inline literal were built with) as that token's CSS variable — the name the generated sheets
 * and the code view use (`tokenToCSSVar` → `--catalog-token-*` for radius · type, `--spacing-*`,
 * `--border-width-*`, the theme's color variables). The Preview · Publish root declares them from the
 * active theme (`resolveThemeSnapshot` `cssVars` — light · dark · touch sets), so a theme, color-mode or
 * touch change reaches the inline value through CSS, as it reaches the rule sheets.
 *
 * Kept: the inline value must still be that token's value (a later literal write, a box-model side that
 * won over the axis token, a fill alpha) — else the literal stays (295's check, `deviceTypography.ts`).
 * A color · border is compared with the token's value in either color mode (not the light read), since
 * the record was resolved in the root's mode.
 */
import type { CSSProperties } from "react";
import {
  tokenToCSSVar,
  withCatalogTokenVars,
  type TokenRef,
} from "@composition/rendering";
import { readThemeTokenValue } from "../document/themedToken";
import { catalogAuthoredTokenRef } from "../resolution/resolver";

/** Token axes a node value can reference whose variable the DOM root declares (D2's scale). */
const NODE_TOKEN_REF = /^\{(spacing|radius|border|color)\.[^{}]+\}$/;

const CORNERS = {
  radiusTopLeft: "borderTopLeftRadius",
  radiusTopRight: "borderTopRightRadius",
  radiusBottomRight: "borderBottomRightRadius",
  radiusBottomLeft: "borderBottomLeftRadius",
} as const;
const SIDE_BORDERS = {
  borderTopWidth: "borderTopWidth",
  borderRightWidth: "borderRightWidth",
  borderBottomWidth: "borderBottomWidth",
  borderLeftWidth: "borderLeftWidth",
} as const;

/**
 * The inline properties a visual key writes, each with the keys that win over it for that property
 * (the box model's precedence — side over axis over all, `catalogBoxModel`).
 */
function propertiesOf(key: string): readonly (readonly [string, readonly string[]])[] {
  switch (key) {
    case "padding":
      return [
        ["paddingTop", ["paddingTop", "paddingY"]],
        ["paddingBottom", ["paddingBottom", "paddingY"]],
        ["paddingLeft", ["paddingLeft", "paddingX"]],
        ["paddingRight", ["paddingRight", "paddingX"]],
      ];
    case "paddingX":
      return [
        ["paddingLeft", ["paddingLeft"]],
        ["paddingRight", ["paddingRight"]],
      ];
    case "paddingY":
      return [
        ["paddingTop", ["paddingTop"]],
        ["paddingBottom", ["paddingBottom"]],
      ];
    case "paddingTop":
    case "paddingRight":
    case "paddingBottom":
    case "paddingLeft":
      return [[key, []]];
    case "gap":
      return [
        ["rowGap", []],
        ["columnGap", []],
      ];
    case "radius":
      return [
        ["borderRadius", []],
        ...Object.entries(CORNERS).map(
          ([corner, property]) => [property, [corner]] as const,
        ),
      ];
    case "borderWidth":
      return [
        ["borderWidth", []],
        ...Object.entries(SIDE_BORDERS).map(
          ([side, property]) => [property, [side]] as const,
        ),
      ];
    case "fill":
      return [["backgroundColor", []]];
    case "color":
    case "borderColor":
      return [[key, []]];
  }
  if (key in CORNERS) return [[CORNERS[key as keyof typeof CORNERS], []]];
  if (key in SIDE_BORDERS) return [[key, []]];
  return [];
}

const px = (value: unknown): number | undefined =>
  typeof value === "number"
    ? value
    : typeof value === "string" && /^-?\d+(?:\.\d+)?px$/.test(value.trim())
      ? Number.parseFloat(value)
      : undefined;

/** The token's value in either mode equals the record value (the record was resolved in one of them). */
function stillTokenValue(ref: string, value: unknown, color: boolean): boolean {
  for (const mode of ["light", "dark"] as const) {
    const token = readThemeTokenValue(
      ref as `{${string}}`,
      color ? "color" : "number",
      mode,
    );
    if (token !== undefined && token === value) return true;
  }
  return false;
}

/** Rewrites inline values read from a token to the token's CSS variable (see the module note). */
export function catalogNodeTokenCss(
  style: CSSProperties,
  visual: Readonly<Record<string, unknown>>,
): void {
  const inline = style as Record<string, unknown>;
  for (const key of Object.keys(visual)) {
    const ref = catalogAuthoredTokenRef(visual, key);
    if (!ref || !NODE_TOKEN_REF.test(ref)) continue;
    const color = ref.startsWith("{color.");
    const value = visual[key];
    if (!stillTokenValue(ref, value, color)) continue;
    // A fill with its own alpha is a mix, not the token.
    if (key === "fill" && visual.fillAlpha !== undefined && Number(visual.fillAlpha) !== 1)
      continue;
    const css = withCatalogTokenVars(tokenToCSSVar(ref as TokenRef));
    if (!/^var\(--[\w-]+\)$/.test(css)) continue;
    for (const [property, winners] of propertiesOf(key)) {
      if (winners.some((winner) => winner !== key && visual[winner] !== undefined))
        continue;
      const current = inline[property];
      if (current === undefined) continue;
      if (color || Math.abs((px(current) ?? Number.NaN) - Number(value)) < 1e-3)
        inline[property] = css;
    }
  }
}

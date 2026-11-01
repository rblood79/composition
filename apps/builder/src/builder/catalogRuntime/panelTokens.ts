import { cssVarToTokenRef, tokenToCSSVar } from "@composition/rendering";
import type { TokenRef } from "@composition/rendering";

import {
  libraryTokenId,
  libraryTokenRef,
  libraryTokenScaleRefs,
} from "../../../../../packages/shared/src/catalog/document/libraryTokenScale";
import type {
  CatalogFillColor,
  CatalogFillLayer,
  CatalogResolvedFillLayer,
  TokenUse,
} from "../../../../../packages/shared/src/catalog/document/types";
import { readThemeTokenValue } from "../../../../../packages/shared/src/catalog/document/themedToken";
import { catalogFillColorOf } from "../../../../../packages/shared/src/catalog/resolution/resolver";
import {
  catalogFillItems,
  catalogFillLayers,
} from "../../../../../packages/shared/src/catalog/runtime/authoredStyle";

/**
 * ADR-298 Phase 2 (D4) — the Styles panel's text form of a theme token: the token's CSS variable
 * (`var(--spacing-md)` · `var(--radius-md)` · `var(--border-width-thin)` · `var(--shadow-sm)` ·
 * `var(--text-heading-md)` — `tokenToCSSVar`, the name the presets already carry). The panel keeps its
 * string values; this module is the one place that turns that text into the node's `TokenUse` (a
 * library scale token, `lib:token:<ref>`) and back.
 */

let scaleRefs: Set<string> | undefined;
const inScale = (ref: string) =>
  (scaleRefs ??= new Set(libraryTokenScaleRefs().map((entry) => entry.ref))).has(
    ref,
  );

/** The scale ref a panel value names (`var(--spacing-md)` → `{spacing.md}`), else undefined. */
export function panelTokenRef(raw: string | number): `{${string}}` | undefined {
  if (typeof raw !== "string") return undefined;
  const ref = cssVarToTokenRef(raw.trim());
  return ref && inScale(ref) ? (ref as `{${string}}`) : undefined;
}

/** The `TokenUse` a panel value writes, or undefined when it is not a scale token's variable. */
export function panelTokenUse(raw: string | number): TokenUse | undefined {
  const ref = panelTokenRef(raw);
  return ref ? { kind: "token", tokenId: libraryTokenId(ref) } : undefined;
}

/** A node's `TokenUse` as the panel's text (`var(--…)`); undefined for a project token or a composite color. */
export function panelTokenVar(value: unknown): string | undefined {
  if (
    !value ||
    typeof value !== "object" ||
    (value as { kind?: unknown }).kind !== "token"
  )
    return undefined;
  const ref = libraryTokenRef(String((value as TokenUse).tokenId));
  if (!ref) return undefined;
  const css = tokenToCSSVar(ref as TokenRef);
  return /^var\(--[\w-]+\)$/.test(css) ? css : undefined;
}

/**
 * ADR-298 Phase 3 — a fill color in the panel's text form: `#RRGGBBAA`, or a theme color token as its
 * variable (`var(--accent)`). The document holds the token (`TokenUse`); a record holds its hex in the
 * root's color mode (the resolver).
 */
const isColorRef = (ref: string | undefined) => !!ref?.startsWith("{color.");

/** The document's fill color for a panel color (a color token's `TokenUse`, else the text). */
export function panelFillColor(raw: string): CatalogFillColor {
  const ref = panelTokenRef(raw);
  return ref && isColorRef(ref)
    ? { kind: "token", tokenId: libraryTokenId(ref) }
    : raw;
}

/** A document fill color as the panel's text (a token as its variable). */
export function panelFillColorText(value: CatalogFillColor): string {
  if (typeof value === "string") return value;
  return panelTokenVar(value) ?? "#00000000";
}

/** A panel color as `#RRGGBBAA` in `mode` (a token reads its value; a literal stays). */
export function panelFillColorHex(raw: string, mode: "light" | "dark"): string {
  const ref = panelTokenRef(raw);
  if (!ref || !isColorRef(ref)) return raw;
  return (
    catalogFillColorOf(readThemeTokenValue(ref, "color", mode)) ?? "#00000000"
  );
}

type ColorItem = { type: string; color?: string; stops?: { color: string }[] };

/** Maps every color of panel fill items (a layer's · a gradient stop's). */
function mapItemColors<C, D>(
  items: readonly unknown[],
  map: (color: C) => D,
): unknown[] {
  return items.map((item) => {
    const layer = item as { color?: C; stops?: { color: C }[] };
    return {
      ...layer,
      ...(layer.color !== undefined && (item as ColorItem).type !== "mesh-gradient"
        ? { color: map(layer.color) }
        : {}),
      ...(layer.stops
        ? { stops: layer.stops.map((stop) => ({ ...stop, color: map(stop.color) })) }
        : {}),
    };
  });
}

/** Document fill layers as the Fill panel's items, token colors as their variable text. */
export function panelFillItems(
  fills: readonly CatalogFillLayer[] | undefined,
): unknown[] | undefined {
  const items = catalogFillItems(fills);
  return items && mapItemColors<CatalogFillColor, string>(items, panelFillColorText);
}

/** The Fill panel's items as document layers (a token variable becomes the token). */
export function panelFillLayers(
  items: readonly { type: string }[],
): CatalogFillLayer[] {
  return catalogFillLayers(
    mapItemColors<string, CatalogFillColor>(items, panelFillColor) as {
      type: string;
    }[],
  );
}

/** The Fill panel's items as a record's layers in `mode` (a preview — every color a hex). */
export function panelResolvedFillLayers(
  items: readonly { type: string }[],
  mode: "light" | "dark",
): CatalogResolvedFillLayer[] {
  return catalogFillLayers(
    mapItemColors<string, string>(items, (color) =>
      panelFillColorHex(color, mode),
    ) as { type: string }[],
  ) as CatalogResolvedFillLayer[];
}

/** A panel color's theme token name (`var(--accent)` → `accent`), else undefined. */
export function panelColorTokenName(raw: string): string | undefined {
  const ref = panelTokenRef(raw);
  return ref && isColorRef(ref) ? ref.slice("{color.".length, -1) : undefined;
}

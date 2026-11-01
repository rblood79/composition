import { cssVarToTokenRef, tokenToCSSVar } from "@composition/rendering";
import type { TokenRef } from "@composition/rendering";

import {
  libraryTokenId,
  libraryTokenRef,
  libraryTokenScaleRefs,
} from "../../../../../packages/shared/src/catalog/document/libraryTokenScale";
import type { TokenUse } from "../../../../../packages/shared/src/catalog/document/types";

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

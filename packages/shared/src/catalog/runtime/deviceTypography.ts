/**
 * ADR-295 Phase 2 — the DOM's token font sizes follow the device set.
 *
 * A record carries its font size as a number (the resolver reads the library token in the installed —
 * desktop — maps; the Canvas draws desktop, 사용자 결정 7). The generated sheets read the size by
 * `--catalog-token-*`, which the Preview · Publish root declares twice (desktop, and S2's touch set under
 * `@media not ((hover: hover) and (pointer: fine))` · the Preview touch view). An inline `14px` would stay
 * desktop on a touch device while the sheet's elements grow — so a font size the resolver read from a
 * typography token (`catalogResolvedTokenRef` — a definition value, a part rule, an authored token) goes
 * inline as that token's variable (the same value on desktop), and its paired line-height ratio as the
 * token's line-height variable. A literal (a part rule's px, the document's px) stays px — S2's fixed form.
 */
import type { CSSProperties } from "react";
import {
  catalogTokenVarName,
  resolveToken,
  type TokenRef,
} from "@composition/rendering";
import { catalogResolvedTokenRef } from "../resolution/resolver";

const TYPOGRAPHY_SIZE_REF = /^\{typography\.(text-[a-z0-9-]+)\}$/;

/**
 * The typography token (CSS name — `text-md` is `text-base`) a record's font size comes from, when the
 * value is still that token's installed value (a later non-token write would have changed it).
 */
export function catalogFontSizeToken(
  visual: Readonly<Record<string, unknown>>,
): string | undefined {
  const ref = catalogResolvedTokenRef(visual, "fontSize");
  const name = ref ? TYPOGRAPHY_SIZE_REF.exec(ref)?.[1] : undefined;
  if (!name || name.endsWith("--line-height")) return undefined;
  if (resolveToken(ref as TokenRef) !== visual.fontSize) return undefined;
  return name === "text-md" ? "text-base" : name;
}

/** Rewrites `style.fontSize` / `style.lineHeight` to the device-set variables of the font size's token. */
export function catalogDeviceTypographyCss(
  style: CSSProperties,
  visual: Readonly<Record<string, unknown>>,
): void {
  if (typeof style.fontSize !== "number") return;
  const name = catalogFontSizeToken(visual);
  if (!name || visual.fontSize !== style.fontSize) return;
  const fontSize = style.fontSize;
  style.fontSize = `var(${catalogTokenVarName(`--${name}`)})`;
  const lineHeight = resolveToken(
    `{typography.${name}--line-height}` as TokenRef,
  );
  if (
    typeof style.lineHeight === "number" &&
    typeof lineHeight === "number" &&
    Math.abs(style.lineHeight - lineHeight / fontSize) < 1e-4
  )
    style.lineHeight = `var(${catalogTokenVarName(`--${name}--line-height`)})`;
}

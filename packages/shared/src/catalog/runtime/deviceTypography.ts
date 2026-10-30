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

const SIZE_HEIGHT_REF = /^\{size\.height\.([A-Z]+)\}$/;

const px = (value: unknown): number | undefined =>
  typeof value === "number"
    ? value
    : typeof value === "string" && /^-?\d+(?:\.\d+)?px$/.test(value)
      ? Number.parseFloat(value)
      : undefined;

/**
 * ADR-295 Phase 3 — the DOM's S2 control box follows the device set. A minimum the resolver read from
 * `{size.height.<S>}` goes inline as `var(--catalog-token-size-height-<S>)`; and when the box's
 * paddingY is the S2 centring of its line in that height ((height − font × line − border × 2) / 2 — the
 * generated sheet's `controlPaddingBlock`), the padding goes inline as the same formula over the device
 * variables, so the touch set (× 1.25 height, 17 base font) reaches an inline box as it reaches the
 * generated sheets. A box whose padding is anything else (an authored padding) keeps its px. Run after
 * `catalogDeviceTypographyCss` (the formula reads the font and line variables it wrote).
 */
export function catalogDeviceControlCss(
  style: CSSProperties,
  visual: Readonly<Record<string, unknown>>,
): void {
  // A square of the control height (a NumberField stepper — `--nf-btn-size`): its sides.
  for (const key of ["width", "height"] as const) {
    const sideRef = catalogResolvedTokenRef(visual, key);
    const side = sideRef ? SIZE_HEIGHT_REF.exec(sideRef)?.[1] : undefined;
    if (side && resolveToken(sideRef as TokenRef) === px(style[key]))
      style[key] = `var(${CATALOG_SIZE_HEIGHT_VAR}${side})`;
  }
  const ref = catalogResolvedTokenRef(visual, "minHeight");
  const size = ref ? SIZE_HEIGHT_REF.exec(ref)?.[1] : undefined;
  const height = px(style.minHeight);
  if (!size || height === undefined || resolveToken(ref as TokenRef) !== height)
    return;
  const heightVar = `var(${CATALOG_SIZE_HEIGHT_VAR}${size})`;
  style.minHeight = heightVar;
  const top = px(style.paddingTop);
  const fontSize = Number(visual.fontSize);
  const lineHeight = Number(visual.lineHeight);
  if (
    top === undefined ||
    px(style.paddingBottom) !== top ||
    !Number.isFinite(fontSize) ||
    !Number.isFinite(lineHeight)
  )
    return;
  const border = px(style.borderWidth) ?? 0;
  if (Math.abs((height - fontSize * lineHeight - border * 2) / 2 - top) > 1e-3)
    return;
  const font =
    typeof style.fontSize === "number" ? `${style.fontSize}px` : style.fontSize;
  const line = String(style.lineHeight ?? lineHeight);
  const block = `calc((${heightVar} - ${font} * ${line} - ${border * 2}px) / 2)`;
  style.paddingTop = block;
  style.paddingBottom = block;
}

const CATALOG_SIZE_HEIGHT_VAR = "--catalog-token-size-height-";

/**
 * ADR-295 Phase 3 — a TextArea's `<textarea>` rows box (`catalogTextAreaInputHeight` — rows × line +
 * the S2 centring padding × 2 + border × 2 = (rows − 1) × line + the control height). The Input's
 * height goes inline as that sum over the device variables when it is still the desktop value.
 */
export function catalogDeviceRowsHeightCss(
  style: CSSProperties,
  visual: Readonly<Record<string, unknown>>,
  rows: number,
): void {
  const ref = catalogResolvedTokenRef(visual, "minHeight");
  const size = ref ? SIZE_HEIGHT_REF.exec(ref)?.[1] : undefined;
  const height = px(style.height);
  const fontSize = Number(visual.fontSize);
  const lineHeight = Number(visual.lineHeight);
  const control = ref ? resolveToken(ref as TokenRef) : undefined;
  if (
    !size ||
    height === undefined ||
    typeof control !== "number" ||
    !Number.isFinite(fontSize) ||
    !Number.isFinite(lineHeight) ||
    Math.abs((rows - 1) * fontSize * lineHeight + control - height) > 1e-3
  )
    return;
  const name = catalogFontSizeToken(visual);
  const font = name ? `var(${catalogTokenVarName(`--${name}`)})` : `${fontSize}px`;
  const line =
    name &&
    Math.abs(
      Number(resolveToken(`{typography.${name}--line-height}` as TokenRef)) /
        fontSize -
        lineHeight,
    ) < 1e-4
      ? `var(${catalogTokenVarName(`--${name}--line-height`)})`
      : String(lineHeight);
  style.height = `calc(${rows - 1} * ${font} * ${line} + var(${CATALOG_SIZE_HEIGHT_VAR}${size}))`;
}

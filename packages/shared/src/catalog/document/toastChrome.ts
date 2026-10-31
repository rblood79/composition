/**
 * 295 후속 C9 — what a placed S2 Toast draws itself (`@react-spectrum/s2` 1.8.1 `Toast.tsx`): its
 * variant's icon (`ICONS` — `CenterBaseline` before the text; neutral has none) and the
 * `CloseButton staticColor="white"`. Both sit in the Toast rule's padding (`{size.toast.*}`): the
 * Canvas draws them as glyphs (`ruleShapes.ts`), the DOM as `toast-variant-icon` · `toast-close-button`
 * (`delegatedDom.runtime.ts`). The glyphs are the Lucide ones every icon here comes from.
 */

/** S2 `InfoCircle` · `CheckmarkCircle` · `AlertTriangle` as Lucide names. */
export const CATALOG_TOAST_ICONS: Readonly<Record<string, string>> = {
  info: "info",
  positive: "circle-check",
  negative: "triangle-alert",
};

/** S2 `CloseButton`'s glyph (`Cross` — 12 at control M) as a Lucide name. */
export const CATALOG_TOAST_CLOSE_ICON = "x";
export const CATALOG_TOAST_CLOSE_GLYPH_SIZE = 12;

/** The icon a Toast with these props draws (absent variant = info, S2's `variant || 'info'`). */
export function catalogToastIcon(
  props: Readonly<Record<string, unknown>>,
): string | undefined {
  return CATALOG_TOAST_ICONS[String(props.variant ?? "info")];
}

/** The close button's name (S2 `CloseButton` — `closebutton.close`), en · ko. */
export const CATALOG_TOAST_CLOSE_LABELS: Readonly<Record<string, string>> = {
  en: "Close",
  ko: "닫기",
};

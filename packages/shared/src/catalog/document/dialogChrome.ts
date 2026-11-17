/**
 * S2 Dialog `isDismissible` (`@react-spectrum/s2` 1.8.2 `Dialog.tsx` · `CloseButton.tsx`, 2026-11-18
 * 사용자 결정): a dismissible Dialog draws S2's `CloseButton` at its header's end — a control-M round
 * button 12 from the top and the end edge (the header's `paddingTop: 12` · `paddingEnd: 12`) holding
 * the `Cross` glyph (12 at control M), colored like the Dialog's text (`baseColor('neutral')`). It is
 * no node: the Canvas draws the glyph (`ruleShapes.ts` `catalogDialogChromeShapes`), the DOM the RAC
 * Button `slot="close"` (`components/Dialog.tsx`, the Dialog rule's `dialog-close-button` selectors).
 */

/** The cross's distance from the Dialog's top and end edges (S2 header `paddingTop` · `paddingEnd`). */
export const CATALOG_DIALOG_CLOSE_INSET = 12;

/** S2 `CloseButton`'s glyph (`Cross` — 12 at control M) as a Lucide name. */
export const CATALOG_DIALOG_CLOSE_ICON = "x";
export const CATALOG_DIALOG_CLOSE_GLYPH_SIZE = 12;

/** The close button's name (S2 `dialog.dismiss`), en · ko. */
export const CATALOG_DIALOG_CLOSE_LABELS: Readonly<Record<string, string>> = {
  en: "Dismiss",
  ko: "무시",
};

/**
 * ADR-295 후속 C1 — the device unit `{size.unit}` (desktop 1 · touch 1.25) as a number for a DOM value
 * that cannot be a CSS formula. S2 reads the same scale in JS where RAC takes a number (`useScale()` —
 * TableView's drag column `width={scale === 'medium' ? 16 : 20}`); RAC column widths are px numbers
 * (`ColumnSize`), so `catalogDeviceScaledCss` cannot reach them.
 *
 * The value is the document root's `--catalog-token-size-unit` — the theme sheet's touch set
 * (`themeVarsCss.ts`: S2's device media and the Preview's touch view attribute) decides it, so this
 * number and the generated CSS never disagree. No sheet (a test document) → 1.
 */
import { S2_TOUCH_MEDIA } from "@composition/rendering";
import { useSyncExternalStore } from "react";
import { CATALOG_TOUCH_VIEW_ATTRIBUTE } from "./themeVarsCss";

const SIZE_UNIT_VAR = "--catalog-token-size-unit";

function readDeviceUnit(): number {
  if (typeof document === "undefined" || typeof getComputedStyle !== "function")
    return 1;
  const unit = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue(SIZE_UNIT_VAR),
  );
  return Number.isFinite(unit) && unit > 0 ? unit : 1;
}

function subscribe(onChange: () => void): () => void {
  if (typeof document === "undefined") return () => {};
  const media =
    typeof window.matchMedia === "function"
      ? window.matchMedia(S2_TOUCH_MEDIA)
      : undefined;
  media?.addEventListener("change", onChange);
  const observer =
    typeof MutationObserver === "function"
      ? new MutationObserver(onChange)
      : undefined;
  observer?.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [CATALOG_TOUCH_VIEW_ATTRIBUTE],
  });
  return () => {
    media?.removeEventListener("change", onChange);
    observer?.disconnect();
  };
}

/** The device unit (`{size.unit}` — 1 · 1.25) for a px number a DOM prop needs. */
export function useCatalogDeviceUnit(): number {
  return useSyncExternalStore(subscribe, readDeviceUnit, () => 1);
}

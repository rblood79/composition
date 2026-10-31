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
import { useCallback, useSyncExternalStore } from "react";
import { CATALOG_TOUCH_VIEW_ATTRIBUTE } from "./themeVarsCss";

const SIZE_UNIT_VAR = "--catalog-token-size-unit";

/** A device token's px from the document root (`--catalog-token-size-*`); no sheet → `fallback`. */
function readDeviceTokenPx(name: string, fallback: number): number {
  if (typeof document === "undefined" || typeof getComputedStyle !== "function")
    return fallback;
  const value = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue(name),
  );
  return Number.isFinite(value) && value > 0 ? value : fallback;
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

/**
 * A device token's px (`--catalog-token-size-*` — the theme sheet's desktop / touch set) for a px
 * number a DOM prop needs; `fallback` (the desktop value) without the sheet and on the server.
 * ADR-295 후속 — the selection column's S2 40 · 52 (`{size.table.selection-column}`), which is not
 * the unit × 40.
 */
export function useCatalogDeviceTokenPx(
  name: string,
  fallback: number,
): number {
  const read = useCallback(
    () => readDeviceTokenPx(name, fallback),
    [name, fallback],
  );
  return useSyncExternalStore(subscribe, read, () => fallback);
}

/** The device unit (`{size.unit}` — 1 · 1.25) for a px number a DOM prop needs. */
export function useCatalogDeviceUnit(): number {
  return useCatalogDeviceTokenPx(SIZE_UNIT_VAR, 1);
}

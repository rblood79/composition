import { createContext } from "react";

/**
 * Inside the app's toast region, the shape of a queued toast (user 2026-11-01 — RAC `MyToastRegion`):
 * what the Toast's own close button does — closes that toast. Outside (a placed Toast in a running
 * Preview) the button hides the Toast.
 */
export const CatalogToastShapeContext = createContext<{
  close: () => void;
} | null>(null);

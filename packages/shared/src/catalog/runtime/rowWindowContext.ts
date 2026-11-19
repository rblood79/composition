import { createContext } from "react";

/**
 * How a windowed Table (`CatalogRowWindowKeys`) is drawn: `"virtual"` inside RAC's `Virtualizer`
 * (the rows outside its record window are keyed Rows without content), `"refused"` when its
 * `Layout` cannot place it (it draws as it is — every row has to be a record), `undefined` until
 * the Virtualizer's chunk loads (the window's rows only — no row without content reaches the DOM).
 */
export const CatalogRowWindowMode = createContext<
  "virtual" | "refused" | undefined
>(undefined);

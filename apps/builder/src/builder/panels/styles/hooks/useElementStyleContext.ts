import { useStylesHost } from "../stylesHost";
import type { FillAxes } from "@composition/shared";
import type { TintPreset } from "../../../../utils/theme/tintToSkiaColors";

export interface ElementStyleContext {
  sizing?: FillAxes;
  style: Record<string, unknown> | undefined;
  /**
   * The drawn record's effective CSS view (`catalogEffectiveStyle`) — the value a field shows
   * where nothing is authored. Undefined when the selection has no drawn record (the panel then
   * shows its fallback, not a resolved value).
   */
  effective: Record<string, string | number> | undefined;
  type: string | undefined;
  size: string | undefined;
  fills: unknown[] | undefined;
  props: Readonly<Record<string, unknown>> | undefined;
  accentColor: TintPreset | undefined;
}

/**
 * Shared canonical property read for an element's style/type/size.
 * Section-value hooks reuse this so legacy fallback stays behind one boundary.
 */
/** The selected element's style context — the Styles host's reading (the catalog workspace). */
export function useElementStyleContext(id: string | null): ElementStyleContext {
  return useStylesHost().useElementStyleContext(id);
}

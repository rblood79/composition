import { useStylesHost } from "../stylesHost";
import type { FillAxes } from "@composition/shared";

export interface ElementStyleContext {
  sizing?: FillAxes;
  style: Record<string, unknown> | undefined;
  /**
   * The drawn record's effective CSS view (`catalogEffectiveStyle`) — the value a field shows
   * where nothing is authored. Undefined when the selection has no drawn record (the panel then
   * shows its fallback, not a resolved value).
   */
  effective: Record<string, string | number> | undefined;
  /**
   * The paint the record draws where it is not its own rule's — a field box's control Group draws the
   * Input rule's background · border, the Input laid into it none (`catalogFieldBoxRole`). The color
   * fields read it after the authored value and before the rule paint of `type`.
   */
  drawnPaint?: { backgroundColor?: string; borderColor?: string };
  type: string | undefined;
  size: string | undefined;
  fills: unknown[] | undefined;
  props: Readonly<Record<string, unknown>> | undefined;
}

/**
 * Shared canonical property read for an element's style/type/size.
 * Section-value hooks reuse this so legacy fallback stays behind one boundary.
 */
/** The selected element's style context — the Styles host's reading (the catalog workspace). */
export function useElementStyleContext(id: string | null): ElementStyleContext {
  return useStylesHost().useElementStyleContext(id);
}

/**
 * S2 1.8 Button `isPending` (`Button.tsx` `usePendingState` · the pending `ProgressCircle`): while a
 * button is pending, its label and icon stay laid out but are not shown (`visibility: hidden`), and an
 * indeterminate progress circle sits at the button's centre — after a one-second delay, so a short
 * pending state does not flash it. RAC `Button` itself only blocks the press and marks the element
 * (`data-pending` · `aria-disabled`) — it is headless.
 *
 * Both consumers read this module: the DOM (`components/Button.tsx` — the shared `ProgressCircle` in
 * an absolutely centred box) and the Canvas (`ruleShapes` — the same two arcs; `canvasBinding` keeps a
 * pending button's child nodes unpainted, `catalogDerivedProps._pendingHidden`). The Canvas is an
 * authoring surface, so it shows the pending state at once (no delay).
 *
 * The circle takes the button's own text color (S2 uses the ProgressCircle's static · accent
 * colors over a disabled-looking button; here the button keeps its variant paint, so the spinner
 * must contrast with the fill it sits on): the indicator at full alpha, the track at S2's
 * `transparent-overlay-300` alpha.
 */

/** S2 `usePendingState`: the progress circle shows this long after `isPending` turns on. */
export const CATALOG_BUTTON_PENDING_DELAY_MS = 1000;

/** S2 Button's pending ProgressCircle diameter per button size (`Button.tsx` size S · M · L · XL). */
export const CATALOG_BUTTON_PENDING_DIAMETER: Readonly<Record<string, number>> =
  { S: 14, M: 18, L: 20, XL: 24 };

/** S2 ProgressCircle size S stroke (the pending circle is `size="S"`). */
export const CATALOG_BUTTON_PENDING_STROKE_WIDTH = 2;

/** The track's alpha over the button (S2 `transparent-overlay-300`). */
export const CATALOG_BUTTON_PENDING_TRACK_ALPHA = 0.17;

/** S2 `button.pending` (`@react-spectrum/s2` intl) in the languages the Builder ships. */
export const CATALOG_BUTTON_PENDING_LABELS: Readonly<Record<string, string>> = {
  en: "Pending",
  ko: "대기 중",
};

/** Types whose `isPending` shows the pending circle (S2 Button · LinkButton take it). */
const PENDING_TYPES: ReadonlySet<string> = new Set(["Button"]);

/** Whether a node of `type` with `props` is a pending button. */
export function catalogButtonPending(
  type: string,
  props: Readonly<Record<string, unknown>>,
): boolean {
  return PENDING_TYPES.has(type) && props.isPending === true;
}

export interface CatalogButtonPendingIndicator {
  readonly diameter: number;
  readonly strokeWidth: number;
  readonly trackAlpha: number;
}

/** The pending circle's geometry for a button of `size` (unset · unknown = M). */
export function catalogButtonPendingIndicator(
  size: unknown,
): CatalogButtonPendingIndicator {
  const key = typeof size === "string" ? size.toUpperCase() : "M";
  return {
    diameter:
      CATALOG_BUTTON_PENDING_DIAMETER[key] ?? CATALOG_BUTTON_PENDING_DIAMETER.M,
    strokeWidth: CATALOG_BUTTON_PENDING_STROKE_WIDTH,
    trackAlpha: CATALOG_BUTTON_PENDING_TRACK_ALPHA,
  };
}

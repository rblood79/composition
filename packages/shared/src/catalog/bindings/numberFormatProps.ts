import type { PropContract } from "../types";

/**
 * S2 1.8.0 · RAC `formatOptions` (NumberField · Meter · ProgressBar · Slider — 사용자 결정
 * 2026-10-12): how the value is written — decimal · percent · currency · unit, fraction digits,
 * grouping and sign. One object (`number-format` → the document's `numberFormat`,
 * `numberFormatValue.ts`). Unset = RAC's default (Meter · ProgressBar percent of the range,
 * NumberField · Slider the locale's decimal). The DOM passes it to RAC; the Canvas writes the same
 * text (`NumberFormatter` — `catalogRenderValue` · `racOwnText` · `catalogNumberFieldText`).
 */
export const FORMAT_OPTIONS_PROP: PropContract = {
  kind: "number-format",
  label: "Format",
  section: "content",
};

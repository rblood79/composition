import type { CatalogTextMeasure } from "./compositionRoot";
import { docCounters } from "../../../../../packages/shared/src/catalog/docCounters";

/** Numeric text metrics outlive a root; a font-set change explicitly invalidates them. */
export function createCatalogTextMeasureCache(source: CatalogTextMeasure) {
  const metrics = new Map<string, ReturnType<CatalogTextMeasure>>();
  const inline = new Map<
    string,
    ReturnType<NonNullable<CatalogTextMeasure["inline"]>>
  >();
  /**
   * ADR-319 Phase 2 — the width-less key, serialized once per font object: a caller that keeps its
   * font object (the re-wrap's leaf memo, `compositionRoot` `rewrapLeaf`) re-measures a new width
   * without serializing its text · font · runs again. A different text or runs with the same font
   * object serializes again.
   */
  const keys = new WeakMap<
    object,
    {
      text: string;
      runs: Parameters<CatalogTextMeasure>[3];
      key: string;
    }
  >();
  const baseKey = (
    text: string,
    font: Parameters<CatalogTextMeasure>[1],
    runs: Parameters<CatalogTextMeasure>[3],
  ) => {
    const held = keys.get(font);
    if (held && held.text === text && held.runs === runs) return held.key;
    if (process.env.NODE_ENV === "development")
      docCounters.measureKeySerializations += 1;
    // Include the complete font input, including whitespace/break rules and a range-formatted
    // text's run fonts (ADR-299).
    const key = JSON.stringify(
      runs?.length ? [text, font, runs] : [text, font],
    );
    keys.set(font, { text, runs, key });
    return key;
  };
  const measure: CatalogTextMeasure = (text, font, maxWidth, runs, leaf) => {
    // (The wrap width after the serialized key — JSON never holds a raw U+0000.)
    const key = `${baseKey(text, font, runs)}\u0000${maxWidth ?? ""}`;
    const cached = metrics.get(key);
    if (cached) {
      metrics.delete(key);
      metrics.set(key, cached);
      return cached;
    }
    if (process.env.NODE_ENV === "development")
      docCounters.measureSourceCalls += 1;
    const result = source(text, font, maxWidth, runs, leaf);
    if (text.length <= 16_384) {
      if (metrics.size >= 2048) metrics.delete(metrics.keys().next().value!);
      metrics.set(key, result);
    }
    return result;
  };
  if (source.fontBox) measure.fontBox = (font) => source.fontBox!(font);
  if (source.hold) measure.hold = () => source.hold!();
  if (source.lineMetrics)
    measure.lineMetrics = (font) => source.lineMetrics!(font);
  if (source.inline)
    measure.inline = (text, font, runs) => {
      const key = JSON.stringify([text, font, runs]);
      const cached = inline.get(key);
      if (cached) return cached;
      const result = source.inline!(text, font, runs);
      if (text.length <= 16_384) {
        if (inline.size >= 2048) inline.delete(inline.keys().next().value!);
        inline.set(key, result);
      }
      return result;
    };
  return {
    measure,
    clear: () => {
      metrics.clear();
      inline.clear();
    },
  };
}

import type { CatalogTextMeasure } from "./compositionRoot";

/** Numeric text metrics outlive a root; a font-set change explicitly invalidates them. */
export function createCatalogTextMeasureCache(source: CatalogTextMeasure) {
  const metrics = new Map<string, ReturnType<CatalogTextMeasure>>();
  const measure: CatalogTextMeasure = (text, font, maxWidth, runs) => {
    // Include the complete font input, including whitespace/break rules, the wrap width and a
    // range-formatted text's run fonts (ADR-299).
    const key = JSON.stringify(
      runs?.length ? [text, font, maxWidth, runs] : [text, font, maxWidth],
    );
    const cached = metrics.get(key);
    if (cached) {
      metrics.delete(key);
      metrics.set(key, cached);
      return cached;
    }
    const result = source(text, font, maxWidth, runs);
    if (text.length <= 16_384) {
      if (metrics.size >= 2048) metrics.delete(metrics.keys().next().value!);
      metrics.set(key, result);
    }
    return result;
  };
  if (source.fontBox) measure.fontBox = (font) => source.fontBox!(font);
  return { measure, clear: () => metrics.clear() };
}

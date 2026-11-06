import { describe, expect, it, vi } from "vitest";
import { createCatalogTextMeasureCache } from "../textMeasureCache";
import type { CatalogTextFont, CatalogTextMeasure } from "../compositionRoot";

const font: CatalogTextFont = {
  fontSize: 14,
  fontWeight: 400,
  lineHeight: 1.5,
};

describe("catalog text metrics across theme roots", () => {
  it("reuses identical metrics and keeps every font/wrap input distinct", () => {
    const source = vi.fn<CatalogTextMeasure>((text, input, width) => ({
      width: width ?? text.length * input.fontSize,
      height: input.fontSize * input.lineHeight,
    }));
    const { measure } = createCatalogTextMeasureCache(source);
    const first = measure("same", font);
    expect(measure("same", { ...font })).toEqual(first);
    expect(source).toHaveBeenCalledTimes(1);
    const variants: Partial<CatalogTextFont>[] = [
      { fontSize: 18 },
      { fontWeight: 600 },
      { lineHeight: 2 },
      { fontFamily: "Other" },
      { fontStyle: "italic" },
      { letterSpacing: 1 },
      { wordBreak: "break-all" },
      { overflowWrap: "anywhere" },
      { whiteSpace: "pre" },
      { locale: "ko-KR" },
    ];
    for (const input of variants) measure("same", { ...font, ...input });
    measure("changed", font);
    measure("same", font, 60);
    expect(source).toHaveBeenCalledTimes(variants.length + 3);
  });

  it("a font reload invalidates cached metrics and preserves the font-box provider", () => {
    let size = 10;
    const source: CatalogTextMeasure = () => ({ width: size, height: size });
    source.fontBox = () => ({ ascent: size, descent: 2 });
    source.lineMetrics = () => ({ height: size + 2, baseline: size });
    const cache = createCatalogTextMeasureCache(source);
    expect(cache.measure("x", font).width).toBe(10);
    expect(cache.measure.lineMetrics?.(font)).toEqual({
      height: 12,
      baseline: 10,
    });
    size = 20;
    cache.clear();
    expect(cache.measure("x", font).width).toBe(20);
    expect(cache.measure.fontBox?.(font)).toEqual({ ascent: 20, descent: 2 });
    expect(cache.measure.lineMetrics?.(font)).toEqual({
      height: 22,
      baseline: 20,
    });
  });

  it("bounds retained entries and remeasures an evicted input", () => {
    const source = vi.fn<CatalogTextMeasure>(() => ({ width: 10, height: 20 }));
    const { measure } = createCatalogTextMeasureCache(source);
    for (let i = 0; i <= 2048; i++) measure(String(i), font);
    const calls = source.mock.calls.length;
    measure("0", font);
    expect(source).toHaveBeenCalledTimes(calls + 1);
  });

  it("separates inline shaping by locale and invalidates it when fonts reload", () => {
    let width = 10;
    const source: CatalogTextMeasure = () => ({ width, height: 21 });
    source.inline = vi.fn(() => ({
      text: "한",
      clusters: [{ start: 0, end: 1, width, height: 21, baseline: 16 }],
      nowrap: false,
      breakAll: false,
      keepAll: false,
      preserveSpaces: false,
    }));
    const cache = createCatalogTextMeasureCache(source);
    const ko = { ...font, locale: "ko-KR" };
    expect(cache.measure.inline!("한", ko).clusters[0].width).toBe(10);
    cache.measure.inline!("한", { ...ko });
    expect(source.inline).toHaveBeenCalledTimes(1);
    cache.measure.inline!("한", { ...font, locale: "ja-JP" });
    expect(source.inline).toHaveBeenCalledTimes(2);
    width = 20;
    cache.clear();
    expect(cache.measure.inline!("한", ko).clusters[0].width).toBe(20);
    expect(source.inline).toHaveBeenCalledTimes(3);
  });
});

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
    const cache = createCatalogTextMeasureCache(source);
    expect(cache.measure("x", font).width).toBe(10);
    size = 20;
    cache.clear();
    expect(cache.measure("x", font).width).toBe(20);
    expect(cache.measure.fontBox?.(font)).toEqual({ ascent: 20, descent: 2 });
  });

  it("bounds retained entries and remeasures an evicted input", () => {
    const source = vi.fn<CatalogTextMeasure>(() => ({ width: 10, height: 20 }));
    const { measure } = createCatalogTextMeasureCache(source);
    for (let i = 0; i <= 2048; i++) measure(String(i), font);
    const calls = source.mock.calls.length;
    measure("0", font);
    expect(source).toHaveBeenCalledTimes(calls + 1);
  });
});

import { describe, expect, it } from "vitest";
import { spectrumLocaleFont } from "@composition/rendering";
import { catalogFontFamilies } from "../../../../../../packages/shared/src/catalog/runtime/boxModel";
import {
  catalogCssFontFamily,
  catalogLocaleFontFamily,
  DEFAULT_BASE_TYPOGRAPHY,
} from "../../../../../../packages/shared/src/catalog/runtime/fontDefaults";

/**
 * The Canvas cannot read OS fonts, so a glyph its font lacks needs a registered face (사용자
 * 2026-11-07 「html 은 시스템 폰트로 한국어를 나타내지만 canvas 는 그렇지 않다」). Both consumers end
 * every chosen font in the default family, so Korean in a Latin-only font is the same face.
 */
describe("default font fallback", () => {
  const { fontFamily: base } = DEFAULT_BASE_TYPOGRAPHY;

  it("the default family carries Korean itself", () => {
    expect(catalogFontFamilies(base)[0]).toBe("Pretendard");
    expect(catalogLocaleFontFamily(base, "ko-KR")).toBe(base);
    expect(spectrumLocaleFont("ko-KR")).toBeUndefined();
  });

  it("a language the default lacks keeps its own font", () => {
    expect(catalogLocaleFontFamily(base, "ja-JP")).toContain(
      "adobe-clean-han-japanese",
    );
    expect(catalogLocaleFontFamily("Inter", "ja-JP")).toBe("Inter");
  });

  it("a chosen font falls back to the same family in the Canvas and the DOM", () => {
    expect(catalogFontFamilies("Inter")).toEqual(["Inter", "Pretendard"]);
    expect(catalogCssFontFamily("Inter")).toBe("Inter, Pretendard");
  });

  it("the DOM fallback sits ahead of generic families", () => {
    expect(catalogCssFontFamily("Georgia, serif")).toBe(
      "Georgia, Pretendard, serif",
    );
    expect(catalogCssFontFamily("'SF Mono', Menlo, monospace")).toBe(
      "'SF Mono', Menlo, Pretendard, monospace",
    );
  });

  it("a list that already names the default is left alone", () => {
    expect(catalogCssFontFamily(base)).toBe(base);
    expect(catalogCssFontFamily('"Pretendard", serif')).toBe(
      '"Pretendard", serif',
    );
  });
});

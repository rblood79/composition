import CanvasKitInit, { type CanvasKit } from "canvaskit-wasm";
import wasmUrl from "canvaskit-wasm/bin/canvaskit.wasm?url";
import { beforeAll, expect, it } from "vitest";
import { spectrumLocaleFont } from "@composition/rendering";
import { injectBuiltinFontStyle } from "@/fonts/builtinFonts";
import { loadSpectrumLocaleFont } from "../../../../packages/shared/src/catalog/runtime/spectrumLocaleFonts";

let ck: CanvasKit;
beforeAll(async () => {
  ck = await CanvasKitInit({ locateFile: () => wasmUrl });
  injectBuiltinFontStyle();
});

it.each([
  ["ko-KR", "한글 글꼴 가나다"],
  ["ja-JP", "日本語の文字あいうえお"],
  ["zh-Hans-CN", "简体中文字体测试"],
  ["zh-Hant-TW", "繁體中文字體測試"],
  ["zh-HK", "香港繁體中文字體"],
])(
  "%s: DOM과 Canvas가 같은 동적 subset을 사용하고 새 글자를 추가한다",
  async (locale, initial) => {
    document.documentElement.lang = locale;
    const entry = spectrumLocaleFont(locale)!;
    for (const text of [initial, initial + " 新增文字 ABC 0123"]) {
      const result = await loadSpectrumLocaleFont(document, locale, text, 400);
      expect(result).toBeDefined();
      expect(result!.family).toBe(entry.family);
      expect(result!.data.byteLength).toBeLessThan(4_000_000);
      const span = document.body.appendChild(document.createElement("span"));
      Object.assign(span.style, {
        display: "inline-block",
        fontFamily: entry.family,
        fontSize: "16px",
        fontWeight: result!.weight,
        whiteSpace: "nowrap",
      });
      span.textContent = text;
      await document.fonts.load(
        `${result!.weight} 16px "${entry.family}"`,
        text,
      );
      const provider = ck.TypefaceFontProvider.Make();
      provider.registerFont(result!.data, entry.family);
      const collection = ck.FontCollection.Make();
      collection.setDefaultFontManager(provider);
      const style = new ck.TextStyle({
        fontFamilies: [entry.family],
        locale,
        fontSize: 16,
        fontStyle: { weight: ck.FontWeight.Normal },
      });
      const builder = ck.ParagraphBuilder.MakeFromFontCollection(
        new ck.ParagraphStyle({ textStyle: style }),
        collection,
      );
      builder.pushStyle(style);
      builder.addText(text);
      const paragraph = builder.build();
      const face = ck.Typeface.MakeFreeTypeFaceFromData(result!.data)!;
      try {
        paragraph.layout(2000);
        expect(Array.from(face.getGlyphIDs(text)).every((id) => id !== 0)).toBe(
          true,
        );
        expect(
          Math.abs(
            span.getBoundingClientRect().width -
              paragraph.getMaxIntrinsicWidth(),
          ),
        ).toBeLessThan(0.5);
      } finally {
        face.delete();
        paragraph.delete();
        builder.delete();
        collection.delete();
        provider.delete();
        span.remove();
      }
    }
  },
  30000,
);

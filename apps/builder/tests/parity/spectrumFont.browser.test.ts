import CanvasKitInit, { type CanvasKit } from "canvaskit-wasm";
import wasmUrl from "canvaskit-wasm/bin/canvaskit.wasm?url";
import { beforeAll, expect, it } from "vitest";
import {
  SPECTRUM_SANS_FAMILY,
  spectrumFontVariations,
  SPECTRUM_FONT_FACES,
} from "@composition/rendering";
import { injectBuiltinFontStyle } from "@/fonts/builtinFonts";
import { injectPreviewBaseStyles } from "@/preview/baseStyles";

let ck: CanvasKit;
const buffers = new Map<string, ArrayBuffer>();
beforeAll(async () => {
  ck = await CanvasKitInit({ locateFile: () => wasmUrl });
  await Promise.all(
    SPECTRUM_FONT_FACES.map(async (face) => {
      const response = await fetch(face.url);
      expect(response.ok).toBe(true);
      buffers.set(face.url, await response.arrayBuffer());
    }),
  );
  injectBuiltinFontStyle();
  injectPreviewBaseStyles();
  await document.fonts.load(`16px "${SPECTRUM_SANS_FAMILY}"`);
}, 30000);

const cases = SPECTRUM_FONT_FACES.flatMap((face) => {
  const weights =
    face.family === SPECTRUM_SANS_FAMILY && face.style === "normal"
      ? [400, 500, 700]
      : face.weight.includes(" ")
        ? [400, 700]
        : [Number(face.weight)];
  return weights.map((weight) => ({
    face,
    weight,
    name: `${face.family} ${face.style} ${weight}`,
  }));
});

it.each(cases)(
  "$name: 실제 DOM/Canvas 폰트 폭과 스타일 복원이 일치한다",
  async ({ face, weight }) => {
    await document.fonts.load(`${face.style} ${weight} 16px "${face.family}"`);
    const text = "The quick brown fox 0123456789";
    const span = document.body.appendChild(document.createElement("span"));
    span.textContent = text;
    Object.assign(span.style, {
      fontSize: "16px",
      fontWeight: String(weight),
      whiteSpace: "nowrap",
      display: "inline-block",
    });
    span.style.fontFamily = face.family;
    span.style.fontStyle = face.style;
    const provider = ck.TypefaceFontProvider.Make();
    provider.registerFont(buffers.get(face.url)!, face.family);
    const collection = ck.FontCollection.Make();
    collection.setDefaultFontManager(provider);
    collection.enableFontFallback();
    const textStyle = new ck.TextStyle({
      fontFamilies: [face.family],
      fontSize: 16,
      fontStyle: {
        slant:
          face.style === "italic" ? ck.FontSlant.Italic : ck.FontSlant.Upright,
        weight:
          weight === 400
            ? ck.FontWeight.Normal
            : weight === 500
              ? ck.FontWeight.Medium
              : ck.FontWeight.Bold,
      },
      fontVariations: spectrumFontVariations([face.family], weight),
    });
    const builder = ck.ParagraphBuilder.MakeFromFontCollection(
      new ck.ParagraphStyle({ textStyle }),
      collection,
    );
    builder.pushStyle(textStyle);
    builder.addText(text);
    const paragraph = builder.build();
    try {
      paragraph.layout(1000);
      expect(getComputedStyle(span).fontFamily.split(",")[0]).toBe(face.family);
      expect(
        document.fonts.check(`${face.style} ${weight} 16px "${face.family}"`),
      ).toBe(true);
      expect(
        Math.abs(
          span.getBoundingClientRect().width - paragraph.getMaxIntrinsicWidth(),
        ),
      ).toBeLessThan(0.5);
      const override =
        face.family === "source-code-pro" ? "serif" : "monospace";
      span.style.fontFamily = override;
      expect(getComputedStyle(span).fontFamily).toBe(override);
      expect(
        Math.abs(
          span.getBoundingClientRect().width - paragraph.getMaxIntrinsicWidth(),
        ),
      ).toBeGreaterThan(5);
      span.style.fontFamily = face.family;
      expect(
        Math.abs(
          span.getBoundingClientRect().width - paragraph.getMaxIntrinsicWidth(),
        ),
      ).toBeLessThan(0.5);
    } finally {
      span.remove();
      paragraph.delete();
      builder.delete();
      collection.delete();
      provider.delete();
    }
  },
);

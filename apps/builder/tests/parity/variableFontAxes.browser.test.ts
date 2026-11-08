/**
 * 가변 서체 축 — Canvas paragraph 가 CSS 와 같은 규칙으로 축을 고른다 (서체별 분기 없음).
 *
 * CSS 는 서체에 축이 있으면 `wght` = font-weight · `wdth` = font-stretch · `opsz` = font-size
 * (`font-optical-sizing: auto`) 를 쓴다. Canvas 측정 · 그리기가 같은 축을 넘기면 어느 서체든 같은 폭이 된다.
 * 대상은 Canvas 가 싣는 내장 서체 전부 (`builtinSkiaFonts`) — 테스트가 서체 이름을 고르지 않는다.
 *
 * Why (2026-11-09): Canvas 가 `opsz` 를 넘기지 않아 Inter 16px 문장이 Canvas 531.26 / DOM 525.86
 * (12 · 14px 는 opsz 기본값 14 근처라 일치). `wdth` 는 Adobe Clean 에만 넘기는 서체별 분기였다.
 */
import CanvasKitInit, { type CanvasKit } from "canvaskit-wasm";
import wasmUrl from "canvaskit-wasm/bin/canvaskit.wasm?url";
import { beforeAll, expect, it } from "vitest";
import { cssFontVariations } from "@composition/rendering";
import { builtinSkiaFonts } from "@/canvasWarmup/canvasAssetUrls";
import { DEFAULT_FONT_FEATURES } from "@/builder/workspace/canvas/layout/engines/cssResolver";
import { injectBuiltinFontStyle } from "@/fonts/builtinFonts";
import { injectPreviewBaseStyles } from "@/preview/baseStyles";

let ck: CanvasKit;
const buffers = new Map<string, ArrayBuffer>();
beforeAll(async () => {
  ck = await CanvasKitInit({ locateFile: () => wasmUrl });
  for (const font of builtinSkiaFonts()) {
    const response = await fetch(font.url);
    expect(response.ok).toBe(true);
    buffers.set(font.family, await response.arrayBuffer());
  }
  injectBuiltinFontStyle();
  injectPreviewBaseStyles();
}, 30000);

const cases = builtinSkiaFonts().flatMap(({ family }) =>
  [12, 16, 24, 40].flatMap((size) =>
    [400, 600].map((weight) => ({ family, size, weight })),
  ),
);

it.each(cases)(
  "$family $size px $weight: Canvas paragraph 폭 = DOM 폭",
  async ({ family, size, weight }) => {
    await document.fonts.load(`${weight} ${size}px "${family}"`);
    const text = "Shipping address for the delivery of your order";
    const span = document.body.appendChild(document.createElement("span"));
    span.textContent = text;
    Object.assign(span.style, {
      fontFamily: `"${family}"`,
      fontSize: `${size}px`,
      fontWeight: String(weight),
      whiteSpace: "nowrap",
      display: "inline-block",
    });
    const provider = ck.TypefaceFontProvider.Make();
    provider.registerFont(buffers.get(family)!, family);
    const collection = ck.FontCollection.Make();
    collection.setDefaultFontManager(provider);
    const textStyle = new ck.TextStyle({
      fontFamilies: [family],
      fontSize: size,
      fontFeatures: DEFAULT_FONT_FEATURES,
      fontVariations: cssFontVariations(weight, 100, size),
    });
    const builder = ck.ParagraphBuilder.MakeFromFontCollection(
      new ck.ParagraphStyle({ textStyle }),
      collection,
    );
    builder.pushStyle(textStyle);
    builder.addText(text);
    const paragraph = builder.build();
    try {
      paragraph.layout(100000);
      expect(
        Math.abs(
          span.getBoundingClientRect().width - paragraph.getMaxIntrinsicWidth(),
        ),
      ).toBeLessThan(0.1);
    } finally {
      span.remove();
      paragraph.delete();
      builder.delete();
      collection.delete();
      provider.delete();
    }
  },
);

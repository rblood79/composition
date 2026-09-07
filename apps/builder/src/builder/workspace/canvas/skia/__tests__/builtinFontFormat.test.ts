// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import CanvasKitInit, { type CanvasKit } from "canvaskit-wasm";
import { beforeAll, describe, expect, it } from "vitest";

let ck: CanvasKit;
beforeAll(async () => {
  ck = await CanvasKitInit({
    locateFile: () => resolve("public/wasm/canvaskit.wasm"),
  });
});

function metrics(family: string, extension: string) {
  const bytes = Uint8Array.from(
    readFileSync(resolve(`public/fonts/${family}.${extension}`)),
  ).buffer;
  const face = ck.Typeface.MakeFreeTypeFaceFromData(bytes)!;
  const name = face.getFamilyName();
  const manager = ck.FontMgr.FromData(bytes)!;
  const provider = ck.TypefaceFontProvider.Make();
  provider.registerFont(bytes, name);
  const collection = ck.FontCollection.Make();
  collection.setDefaultFontManager(provider);
  collection.enableFontFallback();
  try {
    return [ck.FontWeight.Normal, ck.FontWeight.Bold, ck.FontWeight.Black].map(
      (weight) => {
        const typeface = manager.matchFamilyStyle(name, {
          weight,
          width: ck.FontWidth.Normal,
          slant: ck.FontSlant.Upright,
        });
        const font = new ck.Font(typeface, 20);
        const builder = ck.ParagraphBuilder.MakeFromFontCollection(
          new ck.ParagraphStyle({
            textStyle: { fontFamilies: [name], fontSize: 20 },
          }),
          collection,
        );
        builder.pushStyle(
          new ck.TextStyle({
            fontFamilies: [name],
            fontSize: 20,
            fontStyle: { weight },
            fontVariations: [{ axis: "wght", value: weight.value }],
          }),
        );
        const text = "한글 Abc 0123 줄바꿈 test";
        builder.addText(text);
        const paragraph = builder.build();
        try {
          paragraph.layout(120);
          return {
            name,
            weight: weight.value,
            glyphWidths: Array.from(
              font.getGlyphWidths(typeface.getGlyphIDs(text)),
            ),
            width: paragraph.getMaxIntrinsicWidth(),
            height: paragraph.getHeight(),
            lines: paragraph.getLineMetrics().map((line) => ({
              width: line.width,
              height: line.height,
              startIndex: line.startIndex,
              endIndex: line.endIndex,
            })),
          };
        } finally {
          paragraph.delete();
          builder.delete();
          font.delete();
          typeface.delete();
        }
      },
    );
  } finally {
    collection.delete();
    provider.delete();
    manager.delete();
    face.delete();
  }
}

describe("CanvasKit builtin font container parity", () => {
  it.each(["PretendardVariable", "InterVariable"])(
    "%s TTF는 WOFF2의 굵기 선택과 문단 줄바꿈을 보존한다",
    (family) =>
      expect(metrics(family, "ttf")).toEqual(metrics(family, "woff2")),
    15000,
  );
});

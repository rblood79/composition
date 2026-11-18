// @vitest-environment node

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { CanvasKit, FontMgr, Paragraph } from "canvaskit-wasm";
import { skeletonLineRects } from "./skeletonLines";
import { catalogSkeletonStylesheet } from "../../../../../../../packages/shared/src/catalog/rule/skeletonLook";

/**
 * ADR-314 Phase 3 후속 (code-review 2026-11-19) — a loading text's line boxes follow the look's
 * inline span as the DOM paints its background (Chromium · WebKit probe): the span's own font
 * content area, preserved trailing spaces, an ellipsis clipped at the padding box.
 */
const require = createRequire(import.meta.url);
const INTER = resolve(
  __dirname,
  "../../../../../public/fonts/InterVariable.ttf",
);

async function loadCanvasKit(): Promise<CanvasKit> {
  const bin = dirname(require.resolve("canvaskit-wasm/bin/canvaskit.js"));
  const init = require(join(bin, "canvaskit.js")) as (options: {
    locateFile: (file: string) => string;
  }) => Promise<CanvasKit>;
  return init({ locateFile: (file) => join(bin, file) });
}

describe("skeletonLineRects — the look's span line boxes (real CanvasKit)", () => {
  let ck: CanvasKit;
  let fonts: FontMgr;

  beforeAll(async () => {
    ck = await loadCanvasKit();
    const bytes = readFileSync(INTER);
    fonts = ck.FontMgr.FromData(
      bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer,
    )!;
  });

  function paragraph(
    runs: readonly (readonly [string, number])[],
    width = 100000,
  ): Paragraph {
    const builder = ck.ParagraphBuilder.Make(
      new ck.ParagraphStyle({
        textStyle: { fontFamilies: ["Inter Variable"], fontSize: 16 },
      }),
      fonts,
    );
    for (const [text, fontSize] of runs) {
      builder.pushStyle(
        new ck.TextStyle({
          fontFamilies: ["Inter Variable"],
          fontSize,
          color: ck.BLACK,
        }),
      );
      builder.addText(text);
      builder.pop();
    }
    const built = builder.build();
    builder.delete();
    built.layout(width);
    return built;
  }

  const FONT_BOX = { ascent: 15, descent: 4 };

  it("the bar is the span's own font content area — a larger run on the line does not grow it", () => {
    const p = paragraph([
      ["small ", 16],
      ["BIG", 48],
    ]);
    try {
      const [line] = p.getLineMetrics();
      const rects = skeletonLineRects(ck, p, {
        keepTrailingSpaces: false,
        fontBox: FONT_BOX,
      });
      expect(rects).toHaveLength(1);
      const [, top, , bottom] = rects[0]!;
      expect(top).toBeCloseTo(line!.baseline - FONT_BOX.ascent, 3);
      expect(bottom).toBeCloseTo(line!.baseline + FONT_BOX.descent, 3);
      expect(bottom - top).toBe(19);
    } finally {
      p.delete();
    }
  });

  it("`pre` · `pre-wrap` keep the line's trailing spaces; collapsing modes drop them", () => {
    const p = paragraph([["abc   \nde", 16]]);
    try {
      const kept = skeletonLineRects(ck, p, { keepTrailingSpaces: true });
      const dropped = skeletonLineRects(ck, p, { keepTrailingSpaces: false });
      expect(kept).toHaveLength(2);
      // three spaces' advance past "abc"
      expect(kept[0]![2] - dropped[0]![2]).toBeGreaterThan(10);
      expect(kept[1]![2]).toBeCloseTo(dropped[1]![2], 3);
    } finally {
      p.delete();
    }
  });

  it("an ellipsis line ends at the given padding-box edge, not past it", () => {
    const p = paragraph([["A very long line that overflows", 16]]);
    try {
      const [rect] = skeletonLineRects(ck, p, {
        keepTrailingSpaces: false,
        ellipsisRight: 94,
      });
      expect(rect![2]).toBe(94);
    } finally {
      p.delete();
    }
  });
});

describe("the generated sheet hides what the Canvas does not draw", () => {
  const sheet = catalogSkeletonStylesheet();
  it("the host's decoration (a Link's underline) goes transparent over inline style", () => {
    expect(sheet).toMatch(
      /:has\(> \[data-skeleton-look="text"\]\) \{[^}]*text-decoration-color: transparent !important;/,
    );
  });
});

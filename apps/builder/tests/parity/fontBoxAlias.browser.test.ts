import { beforeAll, afterAll, expect, it, vi } from "vitest";
import {
  initCanvasKit,
  getCanvasKit,
} from "@/builder/workspace/canvas/skia/initCanvasKit";
import { skiaFontManager } from "@/builder/workspace/canvas/skia/fontManager";
import { catalogTextMeasure } from "@/builder/catalogRuntime/textMeasure";
import { createCatalogTextMeasureCache } from "@/builder/catalogRuntime/textMeasureCache";
import { measureCssLineBox } from "@/builder/workspace/canvas/utils/cssLineBoxMetrics";
import { fontFamily } from "@composition/rendering";
import { renderText } from "@/builder/workspace/canvas/skia/nodeRendererText";
import {
  peekRetainedParagraph,
  releaseParagraphsIn,
} from "@/builder/workspace/canvas/skia/retainedParagraph";
import type { SkiaNodeData } from "@/builder/workspace/canvas/skia/nodeRendererTypes";

const faces: FontFace[] = [];
let pretendardData: ArrayBuffer;
let interData: ArrayBuffer;

beforeAll(async () => {
  await initCanvasKit();
  const [pretendard, inter] = await Promise.all([
    fetch("/fonts/PretendardVariable.ttf").then((response) =>
      response.arrayBuffer(),
    ),
    fetch("/fonts/InterVariable.ttf").then((response) =>
      response.arrayBuffer(),
    ),
  ]);
  pretendardData = pretendard;
  interData = inter;
  skiaFontManager.loadFontFromBuffer(
    "Pretendard",
    pretendard,
    "400",
    "normal",
    { persist: false },
  );
  // 사용자 이름과 바이너리의 내부 family 이름은 달라도 같은 face를 측정해야 한다.
  skiaFontManager.loadFontFromBuffer("Label alias", inter, "400", "normal", {
    persist: false,
  });
  skiaFontManager.loadFontFromBuffer(
    "Label alias",
    pretendard,
    "700",
    "normal",
    { persist: false },
  );
  for (const [weight, data] of [
    [400, inter],
    [700, pretendard],
  ] as const) {
    const face = await new FontFace("Label alias", data, {
      weight: String(weight),
    }).load();
    document.fonts.add(face);
    faces.push(face);
  }
});

afterAll(() => {
  for (const face of faces) document.fonts.delete(face);
});

it("paint preserves an engine fragment baseline even with normal line-height", () => {
  const ck = getCanvasKit();
  const surface = ck.MakeSurface(100, 50)!;
  const node: SkiaNodeData = {
    type: "text",
    x: 0,
    y: 0,
    width: 100,
    height: 30,
    visible: true,
    text: {
      content: "Label",
      fontFamilies: ["Label alias"],
      fontSize: 16,
      fontWeight: 400,
      color: ck.BLACK,
      paddingLeft: 0,
      paddingTop: 0,
      maxWidth: 100,
      whiteSpace: "pre",
      baseline: 10.25,
      autoCenter: false,
    },
  };
  try {
    const point = renderText(
      ck,
      surface.getCanvas(),
      node,
      skiaFontManager.getFontMgr()!,
    );
    const paragraph = peekRetainedParagraph(node)!;
    expect(
      point!.drawY + Math.round(paragraph.getLineMetrics()[0].baseline),
    ).toBe(node.text!.baseline);
  } finally {
    releaseParagraphsIn(node);
    surface.delete();
  }
});

it("an omitted family measures the same catalog default as DOM", async () => {
  await document.fonts.load(`400 14px ${fontFamily.sans}`, "Label");
  const host = document.body.appendChild(document.createElement("div"));
  host.style.cssText = `font-family:${fontFamily.sans};font-size:14px;line-height:18px`;
  host.append("Label");
  const marker = host.appendChild(document.createElement("span"));
  marker.style.cssText = "display:inline-block;width:0;height:0";
  try {
    const baseline =
      marker.getBoundingClientRect().top - host.getBoundingClientRect().top;
    const shape = catalogTextMeasure.inline!("Label", {
      fontSize: 14,
      fontWeight: 400,
      lineHeight: 18 / 14,
    });
    expect(shape.clusters[0].baseline).toBe(baseline);
  } finally {
    host.remove();
  }
});

it("repeated labels with the same typography reuse native line metrics", () => {
  const reads = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect");
  const generation = {};
  const font = {
    fontFamily: "Label alias",
    fontSize: 16,
    fontWeight: 400,
    lineHeight: 1.5,
  };
  try {
    const first = measureCssLineBox(font, generation);
    expect(first).toBeDefined();
    for (let i = 0; i < 1000; i++)
      expect(measureCssLineBox({ ...font }, generation)).toBe(first);
    expect(reads.mock.calls.length).toBeLessThanOrEqual(2);
    expect(measureCssLineBox({ ...font, fontSize: 20 }, generation)).not.toBe(
      first,
    );
    expect(reads.mock.calls.length).toBeLessThanOrEqual(4);
  } finally {
    reads.mockRestore();
  }
});

it.each([400, 700])(
  "font box resolves the authored family and %i variant before internal aliases",
  (weight) => {
    const ck = getCanvasKit();
    const typeface = skiaFontManager.getTypeface(
      "Label alias",
      String(weight),
      "normal",
    )!;
    const probe = new ck.Font(typeface, 1000);
    try {
      const expected = probe.getMetrics();
      expect(skiaFontManager.resolveFamily("Label alias")).not.toBe(
        "Label alias",
      );
      const box = catalogTextMeasure.fontBox!({
        fontFamily: "Label alias",
        fontSize: 14,
        fontWeight: weight,
        lineHeight: 1.5,
      });
      expect(box!.ascent).toBeCloseTo((-expected.ascent * 14) / 1000, 5);
      expect(box!.descent).toBeCloseTo((expected.descent * 14) / 1000, 5);
    } finally {
      probe.delete();
    }
  },
);

it("same-family font replacement refreshes cached inline baselines", async () => {
  const family = "Reload label alias";
  const font = {
    fontFamily: family,
    fontSize: 16,
    fontWeight: 400,
    lineHeight: 1.5,
  };
  const cache = createCatalogTextMeasureCache(catalogTextMeasure);
  const first = await new FontFace(family, interData).load();
  const second = await new FontFace(family, pretendardData).load();
  document.fonts.add(first);
  skiaFontManager.loadFontFromBuffer(family, interData, "400", "normal", {
    persist: false,
  });
  try {
    const before = cache.measure.inline!("Label", font).clusters[0].baseline;
    document.fonts.delete(first);
    document.fonts.add(second);
    skiaFontManager.loadFontFromBuffer(
      family,
      pretendardData,
      "400",
      "normal",
      { persist: false, replace: true },
    );
    cache.clear();
    const after = cache.measure.inline!("Label", font).clusters[0].baseline;
    expect(after).not.toBe(before);
    expect(after).toBe(catalogTextMeasure.lineMetrics!(font)!.baseline);
  } finally {
    document.fonts.delete(first);
    document.fonts.delete(second);
  }
});

it("font-box fallback preserves the shaped paragraph baseline instead of a fixed proportion", () => {
  const provider = vi
    .spyOn(catalogTextMeasure, "fontBox")
    .mockReturnValue(undefined);
  const lineProvider = vi
    .spyOn(catalogTextMeasure, "lineMetrics")
    .mockReturnValue(undefined);
  try {
    const font = {
      fontFamily: "Label alias",
      fontSize: 14,
      fontWeight: 400,
      lineHeight: 1.5,
    };
    const measured = catalogTextMeasure("Label", font);
    expect(measured.firstBaseline).toBeTypeOf("number");
    const shape = catalogTextMeasure.inline!("Label", font);
    for (const cluster of shape.clusters)
      expect(cluster.baseline).toBeCloseTo(measured.firstBaseline!, 4);
  } finally {
    provider.mockRestore();
    lineProvider.mockRestore();
  }
});

it.each(
  [400, 700].flatMap((weight) => [
    { weight, size: 14, line: 21 },
    { weight, size: 16, line: 23 },
    { weight, size: 16, line: 8 },
    { weight, size: 19, line: 28.5 },
    { weight, size: 16, line: 0 },
  ]),
)(
  "inline shaping preserves DOM baseline for $weight / $size px / line $line",
  ({ weight, size, line }) => {
    const host = document.body.appendChild(document.createElement("div"));
    host.style.cssText = `font-family:'Label alias';font-size:${size}px;font-weight:${weight};line-height:${line ? `${line}px` : "normal"}`;
    host.append("xLong");
    const marker = host.appendChild(document.createElement("span"));
    marker.style.cssText = "display:inline-block;width:0;height:0";
    try {
      const baseline =
        marker.getBoundingClientRect().top - host.getBoundingClientRect().top;
      const font = {
        fontFamily: "Label alias",
        fontSize: size,
        fontWeight: weight,
        lineHeight: line / size,
      };
      const shape = catalogTextMeasure.inline!("xLong", font);
      for (const cluster of shape.clusters) {
        expect(cluster.baseline).toBeCloseTo(baseline, 4);
        if (line > 0) expect(cluster.height).toBe(line);
      }
    } finally {
      host.remove();
    }
  },
);

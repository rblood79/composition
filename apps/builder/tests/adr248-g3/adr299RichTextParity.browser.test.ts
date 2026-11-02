/**
 * ADR-299 G2 — range-formatted text, Canvas ↔ Preview DOM (fixture 8). Each fixture lays a Text of
 * `RichText` out with the product composition root (CanvasKit measure), paints its Canvas text node
 * with the product renderer (`renderText`) at 500 % into a raster surface, and renders the same
 * record with the Preview's DOM renderer (`renderCatalogDom`, run `<span>`s) at transform scale(5) — its
 * element screenshot is the oracle (Chrome's line boxes, Chrome's decorations).
 *
 * Read per fixture: the ink box (dark pixels) and the ink lines (row clusters) of both rasters, the
 * run-colored ink box (a run painted red) and the engine box vs the DOM element's box. The control
 * arm is the same text without runs (the node's own type) in the same environment: the gate is the
 * run arm's absolute ink-edge difference ≤ 2.5 device px (0.5 scene px at 500 %), the same
 * line count, and equal engine/DOM boxes (floating-point precision only).
 *
 * Conditions: Chrome (`channel: chrome`, headless), DPR 1, `visibilityState` visible, Pretendard
 * file loaded in both legs. Report: `test-results/adr299-rich-text-parity.json`.
 */
import { createElement } from "react";
import { I18nProvider } from "react-aria-components";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import bundleCss from "@composition/shared/components/styles/index.css?inline";
import { injectPreviewBaseStyles } from "@/preview/baseStyles";
import { renderCatalogDom } from "@/builder/catalogRuntime/domBinding";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { commands, page } from "vitest/browser";
import {
  borderWidth,
  darkColors,
  darkShadows,
  lightColors,
  lightShadows,
  radius,
  typography,
} from "@composition/rendering";
import { createThemesCollection, getActiveTheme } from "@composition/shared";
import { DEFAULT_BASE_TYPOGRAPHY } from "@/builder/fonts/customFonts";
import { resolveThemeSnapshot } from "@/utils/theme/resolveThemeSnapshot";
import {
  getCanvasKit,
  initCanvasKit,
} from "@/builder/workspace/canvas/skia/initCanvasKit";
import { loadBuiltinFontsToSkia } from "@/builder/fonts/loadCustomFontsToSkia";
import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";
import { createLayoutEngine } from "@/builder/workspace/canvas/wasm-bindings/layoutBridge";
import { CatalogCompositionRoot } from "@/builder/catalogRuntime/compositionRoot";
import { CatalogRuntime } from "@/builder/catalogRuntime/controller";
import { CatalogStorage } from "@/builder/catalogRuntime/storage";
import { catalogTextMeasure } from "@/builder/catalogRuntime/textMeasure";
import { bindCatalogCanvas } from "@/builder/catalogRuntime/canvasBinding";
import { getSkiaNode } from "@/builder/workspace/canvas/skia/useSkiaNode";
import { renderText } from "@/builder/workspace/canvas/skia/nodeRendererText";
import { skiaFontManager } from "@/builder/workspace/canvas/skia/fontManager";
import {
  buildCodeCatalogLibrary,
  catalogTypeDefinitionId,
} from "../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { setFields } from "../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../packages/shared/src/catalog/document/graph";
import {
  applyTextRunMarks,
  richTextPlain,
} from "../../../../packages/shared/src/catalog/document/textRuns";
import type {
  CatalogDocument,
  CatalogLibrary,
  NodeEntry,
  RichText,
  StateVariableEntry,
} from "../../../../packages/shared/src/catalog/document/types";

const SCALE = 5;
const PAGE = { width: 1200, height: 800 };
const LOCALE = "en-US";
const REPORT = "test-results/adr299-rich-text-parity.json";
const RED = "#e00000";
const set = <T>(value: T) => ({ kind: "set" as const, value });

type Marks = Parameters<typeof applyTextRunMarks>[3];
interface Fixture {
  key: string;
  text: string;
  /** `[from, to, marks]` writes, in order. */
  marks: [number, number, Marks][];
  width?: number;
  textVisual?: NodeEntry["visual"];
  frameVisual?: NodeEntry["visual"];
}
const at = (text: string, part: string): [number, number] => {
  const from = text.indexOf(part);
  return [from, from + part.length];
};
const LONG =
  "Range formatting keeps one paragraph: the big words wrap with their neighbours inside the same text box.";
const BASELINE_FIXTURES: Fixture[] = [
  {
    key: "large-second-hard-line",
    text: "first\nBIG",
    marks: [[6, 9, {fontSize: 48, color: RED}]],
    textVisual: {fontSize: set(16), whiteSpace: set("pre-wrap")},
  },
  {
    key: "large-second-soft-line",
    text: "first BIG",
    width: 90,
    marks: [[6, 9, {fontSize: 48, color: RED}]],
    textVisual: {fontSize: set(16)},
  },
];
const FIXTURES: Fixture[] = [
  {
    key: "weight",
    text: "Hello world",
    marks: [[...at("Hello world", "world"), { fontWeight: 700 }]],
  },
  {
    key: "color",
    text: "Hello world",
    marks: [[...at("Hello world", "world"), { color: RED }]],
  },
  {
    key: "size-1-line",
    text: "Small BIG small",
    marks: [[...at("Small BIG small", "BIG"), { fontSize: 32, color: RED }]],
  },
  {
    key: "size-wrap-3-lines",
    text: LONG,
    width: 260,
    marks: [[...at(LONG, "big words wrap"), { fontSize: 26, color: RED }]],
  },
  {
    key: "decoration-run",
    text: "Hello world",
    marks: [
      [
        ...at("Hello world", "world"),
        { textDecoration: "underline", color: RED },
      ],
    ],
  },
  {
    key: "template",
    text: "Hi {{ who }}!",
    marks: [[...at("Hi {{ who }}!", "who"), { fontWeight: 700, color: RED }]],
  },
  {
    key: "node-underline-run-none",
    text: "Hello brave world",
    textVisual: { textDecoration: set("underline") },
    marks: [
      [...at("Hello brave world", "brave"), { textDecoration: "none", color: RED }],
    ],
  },
  {
    key: "ancestor-underline-run-none",
    text: "Hello brave world",
    frameVisual: { textDecoration: set("underline"), color: set("#0000ff") },
    marks: [
      [
        ...at("Hello brave world", "brave"),
        { textDecoration: "none", color: RED },
      ],
    ],
  },
];

let code: CatalogLibrary;
const report: Record<string, unknown> = {};

function documentFor(fixture: Fixture, rich: boolean): CatalogDocument {
  const projectId = "project:project:adr299" as const;
  const pageId = "project:page:main" as const;
  let value: string | RichText = fixture.text;
  if (rich)
    for (const [from, to, marks] of fixture.marks)
      value = applyTextRunMarks(value, from, to, marks);
  const text: NodeEntry = {
    kind: "node",
    id: "project:node:text" as NodeEntry["id"],
    definitionId: catalogTypeDefinitionId("Text") as NodeEntry["definitionId"],
    children: [],
    props: { children: set(value) },
    visual: {
      fontSize: set(18),
      lineHeight: set(1.5),
      color: set("#111111"),
      ...fixture.textVisual,
    },
    sizing: { width: set(fixture.width ?? 520) },
    descendantOverrides: [],
  };
  const frame: NodeEntry = {
    kind: "node",
    id: "project:node:frame" as NodeEntry["id"],
    definitionId: catalogTypeDefinitionId("frame") as NodeEntry["definitionId"],
    children: [text.id],
    props: {},
    visual: { ...fixture.frameVisual },
    sizing: { width: set(600) },
    layout: {
      position: set("absolute"),
      insetLeft: set("20px"),
      insetTop: set("20px"),
    },
    descendantOverrides: [],
  };
  const variable: StateVariableEntry = {
    kind: "stateVariable",
    id: "project:stateVariable:who" as StateVariableEntry["id"],
    ownerId: pageId as StateVariableEntry["ownerId"],
    name: "who",
    valueType: "string",
    defaultValue: "Composition",
  };
  return {
    format: "composition-catalog",
    schemaVersion: 1,
    libraryContractVersion: 54,
    revision: 0,
    projectId,
    rootId: projectId,
    entries: {
      [projectId]: {
        kind: "project",
        id: projectId,
        name: "adr299",
        pageIds: [pageId],
        definitionIds: [],
        overrideIds: [],
        themeIds: [],
        tokenIds: [],
        stateVariableIds: [variable.id],
        interactionIds: [],
        assetIds: [],
      },
      [pageId]: {
        kind: "page",
        id: pageId,
        name: "Main",
        route: "/",
        children: [frame.id],
      },
      [frame.id]: frame,
      [text.id]: text,
      [variable.id]: variable,
    },
  };
}

interface Ink {
  top: number;
  bottom: number;
  left: number;
  right: number;
  lines: number;
  red?: { top: number; bottom: number; left: number; right: number };
  /** The lowest ink (any color) inside the red run's columns — a line under the run or none. */
  underRed?: number;
}
/** Dark pixels' box, ink row clusters, and the red pixels' box. */
function inkOf(data: ImageData): Ink {
  const { width, height } = data;
  let top = height;
  let bottom = -1;
  let left = width;
  let right = -1;
  const red = { top: height, bottom: -1, left: width, right: -1 };
  const rows = new Uint8Array(height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const [r, g, b, a] = [
        data.data[i]!,
        data.data[i + 1]!,
        data.data[i + 2]!,
        data.data[i + 3]!,
      ];
      if (a < 128) continue;
      const ink = r + g + b < 3 * 160;
      const isRed = r > 150 && g < 110 && b < 110;
      if (ink || isRed) {
        rows[y] = 1;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
      if (isRed) {
        if (y < red.top) red.top = y;
        if (y > red.bottom) red.bottom = y;
        if (x < red.left) red.left = x;
        if (x > red.right) red.right = x;
      }
    }
  // Line clusters: ink rows separated by a gap of ≥ 2 scene px (decorations sit inside a line).
  let lines = 0;
  let gap = Infinity;
  for (let y = 0; y < height; y++) {
    if (rows[y]) {
      if (gap >= 2 * SCALE) lines++;
      gap = 0;
    } else gap++;
  }
  let underRed: number | undefined;
  if (red.bottom >= 0)
    for (let y = height - 1; y >= 0 && underRed === undefined; y--)
      for (let x = red.left + SCALE; x <= red.right - SCALE; x++) {
        const i = (y * width + x) * 4;
        const [r, g, b, a] = [
          data.data[i]!,
          data.data[i + 1]!,
          data.data[i + 2]!,
          data.data[i + 3]!,
        ];
        if (a >= 128 && (r + g + b < 3 * 160 || (r > 150 && g < 110 && b < 110))) {
          underRed = y;
          break;
        }
      }
  return {
    top,
    bottom,
    left,
    right,
    lines,
    ...(red.bottom >= 0 ? { red, underRed } : {}),
  };
}

async function pngData(base64: string): Promise<ImageData> {
  const image = new Image();
  image.src = `data:image/png;base64,${base64}`;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

async function measureArm(fixture: Fixture, rich: boolean) {
  const runtime = new CatalogRuntime(
    new CatalogGraph(documentFor(fixture, rich), code),
    new CatalogStorage(indexedDB, `adr299-g2-${fixture.key}-${rich}`),
  );
  const root = new CatalogCompositionRoot(
    runtime,
    createLayoutEngine(),
    PAGE,
    undefined,
    undefined,
    catalogTextMeasure,
    LOCALE,
  );
  const rootInput = [...root.canvasInputs.values()].find(
    (input) => input.parentId === "catalog:root",
  )!;
  const textId = [...root.canvasInputs.values()].find(
    (input) => input.sourceId === "project:node:text",
  )!.id;
  const geometry = root.getGeometry(root.canvasInputs.keys()).get(textId)!;

  // Canvas leg — the product text renderer on a raster surface at 500 %.
  const canvasBinding = bindCatalogCanvas(root, [rootInput.id]);
  const node = getSkiaNode(textId)!;
  const ck = getCanvasKit();
  const surface = ck.MakeSurface(
    Math.ceil(node.width * SCALE),
    Math.ceil(node.height * SCALE),
  )!;
  const canvas = surface.getCanvas();
  canvas.clear(ck.WHITE);
  canvas.scale(SCALE, SCALE);
  renderText(ck, canvas, node, skiaFontManager.getFontMgr());
  surface.flush();
  const pixels = canvas.readPixels(0, 0, {
    width: Math.ceil(node.width * SCALE),
    height: Math.ceil(node.height * SCALE),
    colorType: ck.ColorType.RGBA_8888,
    alphaType: ck.AlphaType.Unpremul,
    colorSpace: ck.ColorSpace.SRGB,
  }) as Uint8Array;
  const canvasInk = inkOf(
    new ImageData(
      new Uint8ClampedArray(pixels),
      Math.ceil(node.width * SCALE),
      Math.ceil(node.height * SCALE),
    ),
  );
  surface.delete();
  canvasBinding.dispose();

  // DOM leg — the Preview renderer at transform scale(5), the element's screenshot.
  const host = document.createElement("div");
  host.style.cssText = `position:absolute;left:0;top:0;width:${PAGE.width}px;height:${PAGE.height}px;background:#fff`;
  document.body.append(host);
  const reactRoot = createRoot(host);
  flushSync(() =>
    reactRoot.render(
      createElement(I18nProvider, {
        locale: LOCALE,
        children: renderCatalogDom(root, rootInput.id),
      }),
    ),
  );
  await new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve)),
  );
  const element = host.querySelector<HTMLElement>(
    `[data-catalog-id="${CSS.escape(textId)}"]`,
  )!;
  const marker = document.createElement("span");
  marker.style.cssText = "display:inline-block;width:0;height:0;padding:0;vertical-align:baseline";
  element.prepend(marker);
  const box = element.getBoundingClientRect();
  const domBaseline = marker.getBoundingClientRect().top - box.top;
  marker.remove();
  const engineBaseline = JSON.parse(root.getAppliedLayoutInput(textId)!).leafBaseline;

  const frameElement = host.querySelector<HTMLElement>(
    `[data-catalog-id="${CSS.escape(rootInput.id)}"]`,
  );
  const decorations = {
    frameInline: frameElement?.style.textDecoration ?? null,
    frameComputed: frameElement
      ? getComputedStyle(frameElement).textDecorationLine
      : null,
    textInline: element.style.textDecoration,
  };
  // Match CatalogPreviewFrame: zooming the camera transforms the iframe, not CSS layout.
  host.style.transformOrigin = "0 0";
  host.style.transform = `scale(${SCALE})`;
  await new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve)),
  );
  const shot = await page.screenshot({
    element: page.elementLocator(element),
    base64: true,
    save: false,
  });
  const domInk = inkOf(
    await pngData(shot),
  );
  reactRoot.unmount();
  host.remove();
  const widthBaselines: number[] = [];
  if (fixture.key === "large-second-soft-line") {
    for (const width of [520, 90]) {
      root.execute(setFields({targets: [{kind: "node", id: "project:node:text"}], sizing: {width: set(width)}}));
      widthBaselines.push(JSON.parse(root.getAppliedLayoutInput(textId)!).leafBaseline);
    }
  }
  return {
    widthBaselines,
    canvasInk,
    domInk,
    domBaseline,
    engineBaseline,
    engine: { width: geometry.width, height: geometry.height },
    dom: { width: box.width, height: box.height },
    plain: richTextPlain(
      (root.canvasInputs.get(textId)!.textRuns && {
        kind: "text" as const,
        runs: root.canvasInputs.get(textId)!.textRuns!,
      }) ||
        String(root.canvasInputs.get(textId)!.props.children ?? ""),
    ),
    runs: root.canvasInputs.get(textId)!.textRuns?.length ?? 0,
    decorations,
  };
}

const edgeDiff = (a: Ink, b: Ink) =>
  Math.max(
    Math.abs(a.top - b.top),
    Math.abs(a.bottom - b.bottom),
    Math.abs(a.left - b.left),
    Math.abs(a.right - b.right),
  );

beforeAll(async () => {
  const face = document.createElement("style");
  face.textContent = `@font-face { font-family: "Pretendard"; src: url("/fonts/PretendardVariable.ttf") format("truetype"); font-weight: 45 920; font-display: block; }`;
  document.head.append(face);
  await Promise.all(
    [400, 700].map((weight) =>
      document.fonts.load(`${weight} 16px "Pretendard"`),
    ),
  );
  await document.fonts.ready;
  const css = document.createElement("style");
  css.textContent = bundleCss;
  document.head.append(css);
  injectPreviewBaseStyles(document);
  const theme = resolveThemeSnapshot(
    getActiveTheme({ themes: createThemesCollection() })!,
    { baseTypographySeed: DEFAULT_BASE_TYPOGRAPHY },
  );
  Object.assign(lightColors, theme.colors.light);
  Object.assign(darkColors, theme.colors.dark);
  Object.assign(typography, theme.typography);
  Object.assign(radius, theme.radius);
  Object.assign(borderWidth, theme.border);
  Object.assign(lightShadows, theme.shadows.light);
  Object.assign(darkShadows, theme.shadows.dark);
  const vars = document.createElement("style");
  vars.textContent = `:root {\n${theme.cssVars
    .filter((entry) => !entry.isDark)
    .map((entry) => `  ${entry.name}: ${entry.value};`)
    .join("\n")}\n}`;
  document.head.append(vars);
  await initEngineWasm();
  await initCanvasKit();
  await loadBuiltinFontsToSkia();
  code = await buildCodeCatalogLibrary();
});

afterAll(async () => {
  await commands.writeFile(REPORT, `${JSON.stringify(report, null, 1)}\n`);
});

describe("ADR-299 G2 — range-formatted text, Canvas raster ↔ Preview DOM (500 %)", () => {
  it("measurement conditions", () => {
    report.conditions = {
      userAgent: navigator.userAgent,
      devicePixelRatio,
      visibilityState: document.visibilityState,
      scale: SCALE,
    };
    expect(document.visibilityState).toBe("visible");
  });

  it("first-line baseline ignores larger runs after hard and soft breaks", () => {
    const font = {fontSize: 16, fontWeight: 400, lineHeight: 1.5, whiteSpace: "pre-wrap"};
    const hard = catalogTextMeasure("first\nBIG", font, undefined, [
      {start: 0, end: 6}, {start: 6, end: 9, fontSize: 48},
    ]);
    const soft = catalogTextMeasure("first BIG", {...font, whiteSpace: "normal"}, 90, [
      {start: 0, end: 6}, {start: 6, end: 9, fontSize: 48},
    ]);
    expect(hard.firstBaseline).toBe(17);
    expect(soft.firstBaseline).toBe(17);
    expect(catalogTextMeasure("first BIG", font, undefined, [
      {start: 0, end: 6}, {start: 6, end: 9, fontSize: 48},
    ]).firstBaseline).toBe(53);
  });

  it("a zero-height first line keeps its own baseline, not the next line's", () => {
    // fontSize 0 first line (height 0): the 48 px run on line 2 must not become the first baseline.
    const font = {fontSize: 0, fontWeight: 400, lineHeight: 1.5, whiteSpace: "pre-wrap"};
    expect(catalogTextMeasure("BIG", font, undefined, [
      {start: 0, end: 3, fontSize: 48},
    ]).firstBaseline).toBeGreaterThan(0);
    expect(catalogTextMeasure("a\nBIG", font, undefined, [
      {start: 2, end: 5, fontSize: 48},
    ]).firstBaseline).toBeUndefined();
  });

  for (const fixture of BASELINE_FIXTURES)
    it(`${fixture.key}: engine first baseline equals DOM`, async () => {
      const result = await measureArm(fixture, true);
      report[fixture.key] = result;
      expect(result.engineBaseline).toBe(result.domBaseline);
      expect(result.engine.height).toBe(result.dom.height);
      if (fixture.key === "large-second-soft-line") expect(result.widthBaselines).toEqual([53, 17]);
    });

  for (const fixture of FIXTURES)
    it(fixture.key, async () => {
      const control = await measureArm(fixture, false);
      const rich = await measureArm(fixture, true);
      const controlDiff = edgeDiff(control.canvasInk, control.domInk);
      const richDiff = edgeDiff(rich.canvasInk, rich.domInk);
      const redDiff =
        rich.canvasInk.red && rich.domInk.red
          ? edgeDiff(
              { ...rich.canvasInk.red, lines: 0 },
              { ...rich.domInk.red, lines: 0 },
            )
          : undefined;
      report[fixture.key] = {
        control,
        rich,
        controlDiff,
        richDiff,
        redDiff,
      };
      expect(rich.runs).toBeGreaterThan(0);
      expect(control.plain).toBe(rich.plain);
      // Line breaks: the same number of ink lines on both sides.
      expect(rich.canvasInk.lines).toBe(rich.domInk.lines);
      // The engine box (the Canvas paragraph measure) is the DOM box.
      expect(
        Math.abs(rich.engine.height - rich.dom.height),
      ).toBeLessThanOrEqual(0.01);
      expect(Math.abs(rich.engine.width - rich.dom.width)).toBeLessThanOrEqual(
        0.01,
      );
      // Absolute glyph ink error; the control arm never relaxes the gate.
      expect(richDiff).toBeLessThanOrEqual(0.5 * SCALE);
      if (redDiff !== undefined)
        expect(redDiff).toBeLessThanOrEqual(0.5 * SCALE);
      // A decoration line under the red run on one side only shows as its lowest ink.
      if (rich.canvasInk.underRed !== undefined && rich.domInk.underRed !== undefined)
        expect(
          Math.abs(rich.canvasInk.underRed - rich.domInk.underRed),
        ).toBeLessThanOrEqual(0.5 * SCALE);
    });
});

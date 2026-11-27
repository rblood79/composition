/**
 * ADR-321 G4 — Rating, Canvas ↔ Preview DOM: the box (engine rect vs `getBoundingClientRect`) and each
 * star (box · full · half · empty · color) from the same authored values. The DOM is the independent
 * arm (Chrome lays the `span.rating-star` flex row out and resolves the color variables); the Canvas
 * arm is the engine rect plus the scene's path nodes (`catalogCanvasNodeData`). A second gate reads
 * Chrome alone against values written out by hand (`EXPECTED`).
 *
 * Fixtures: 크기 둘 × 입력 값 0 ~ 5 · 표시 전용 0.5 ~ 4.5 · 2.3 (→ 2.5) · 입력 2.5 (→ 3) · 강조 · 비활성 ·
 * 작성 상자 (폭 · 높이 · padding) · 증분 (값 · 표시 전용 · 크기를 build 뒤에 쓴다).
 *
 * Conditions: Chrome (`channel: chrome`, headless), DPR 1, viewport 1440×900, light theme, en-US.
 * Gate: every box ≤ 1 CSS px, every star state and color equal. Report:
 * `test-results/adr321-rating-parity.json`.
 */
import { createElement } from "react";
import { I18nProvider } from "react-aria-components";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import bundleCss from "@composition/shared/components/styles/index.css?inline";
import { injectPreviewBaseStyles } from "@/preview/baseStyles";
import { renderCatalogDom } from "@/builder/catalogRuntime/domBinding";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { commands } from "vitest/browser";
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
import { initCanvasKit } from "@/builder/workspace/canvas/skia/initCanvasKit";
import { loadBuiltinFontsToSkia } from "@/builder/fonts/loadCustomFontsToSkia";
import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";
import { createLayoutEngine } from "@/builder/workspace/canvas/wasm-bindings/layoutBridge";
import { CatalogCompositionRoot } from "@/builder/catalogRuntime/compositionRoot";
import { CatalogRuntime } from "@/builder/catalogRuntime/controller";
import { CatalogStorage } from "@/builder/catalogRuntime/storage";
import { catalogTextMeasure } from "@/builder/catalogRuntime/textMeasure";
import {
  bindCatalogCanvas,
  catalogCanvasNodeData,
} from "@/builder/catalogRuntime/canvasBinding";
import { getSkiaNode } from "@/builder/workspace/canvas/skia/useSkiaNode";
import { buildCodeCatalogLibrary } from "../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../packages/shared/src/catalog/document/graph";
import { setFields } from "../../../../packages/shared/src/catalog/commands";
import type {
  CatalogDocument,
  CatalogLibrary,
  NodeEntry,
} from "../../../../packages/shared/src/catalog/document/types";


type Rect = { x: number; y: number; width: number; height: number };
const PAGE = { width: 1440, height: 900 };
const LOCALE = "en-US";
const REPORT = "test-results/adr321-rating-parity.json";
const set = <T>(value: T) => ({ kind: "set" as const, value });
const RATING = "project:node:rating";
const BODY = "project:node:body";
const report: unknown[] = [];
let code: CatalogLibrary;

type Fixture = {
  key: string;
  props: Record<string, unknown>;
  visual?: Record<string, unknown>;
  /** Written after the build (the incremental arm). */
  after?: Record<string, unknown>;
};

const FIXTURES: Fixture[] = [
  ...(["S", "M"] as const).flatMap((size) => [
    ...[0, 1, 2, 3, 4, 5].map((value) => ({
      key: `${size}-input-${value}`,
      props: { size, defaultValue: value },
    })),
    ...[0.5, 1.5, 2.5, 3.5, 4.5].map((value) => ({
      key: `${size}-display-${value}`,
      props: { size, defaultValue: value, isReadOnly: true },
    })),
  ]),
  { key: "M-display-2.3", props: { defaultValue: 2.3, isReadOnly: true } },
  { key: "M-input-2.5-rounds", props: { defaultValue: 2.5 } },
  { key: "M-emphasized", props: { defaultValue: 3, isEmphasized: true } },
  { key: "S-disabled", props: { size: "S", defaultValue: 2, isDisabled: true } },
  {
    key: "M-emphasized-disabled-half",
    props: {
      defaultValue: 3.5,
      isReadOnly: true,
      isEmphasized: true,
      isDisabled: true,
    },
  },
  {
    key: "M-authored-box",
    props: { defaultValue: 4 },
    visual: {
      width: "200px",
      height: "60px",
      paddingTop: 10,
      paddingRight: 10,
      paddingBottom: 10,
      paddingLeft: 12,
    },
  },
  {
    key: "incremental",
    props: { defaultValue: 1 },
    after: { defaultValue: 3.5, isReadOnly: true, size: "S" },
  },
];

function documentFor(fixture: Fixture): CatalogDocument {
  const projectId = "project:project:adr321-g4";
  const pageId = "project:page:adr321-g4";
  const node = (
    id: string,
    definitionId: string,
    props: Record<string, unknown>,
    children: string[] = [],
    visual: Record<string, unknown> = {},
  ) =>
    ({
      kind: "node",
      id,
      definitionId,
      children,
      props: Object.fromEntries(
        Object.entries(props).map(([key, value]) => [key, set(value)]),
      ),
      visual: Object.fromEntries(
        Object.entries(visual).map(([key, value]) => [key, set(value)]),
      ),
      sizing: {},
      descendantOverrides: [],
    }) as NodeEntry;
  return {
    format: "composition-catalog",
    schemaVersion: 1,
    libraryContractVersion: 85,
    revision: 0,
    projectId,
    rootId: projectId,
    entries: {
      [projectId]: {
        kind: "project",
        id: projectId,
        name: "adr321",
        pageIds: [pageId],
        definitionIds: [],
        overrideIds: [],
        themeIds: [],
        tokenIds: [],
        stateVariableIds: [],
        interactionIds: [],
        assetIds: [],
      },
      [pageId]: {
        kind: "page",
        id: pageId,
        name: "Home",
        route: "/",
        children: [BODY],
      },
      [RATING]: node(
        RATING,
        "lib:definition:type-Rating",
        fixture.props,
        [],
        fixture.visual,
      ),
      [BODY]: node(BODY, "lib:definition:type-body", {}, [RATING]),
    },
  } as unknown as CatalogDocument;
}
// ── colors: both sides through one canvas parser (hex · rgb · oklch → rgba) ──
const probe = document.createElement("canvas").getContext("2d")!;
function rgba(value: unknown): string {
  probe.fillStyle = "#010203";
  probe.fillStyle = String(value);
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data;
  probe.clearRect(0, 0, 1, 1);
  return `${r},${g},${b},${a}`;
}
const floatRgba = (color: ArrayLike<number> | undefined): string =>
  color && Number(color[3]) > 0
    ? Array.from(color)
        .map((value) => Math.round(value * 255))
        .join(",")
    : "none";

beforeAll(async () => {
  const face = document.createElement("style");
  face.textContent = `@font-face { font-family: "Pretendard"; src: url("/fonts/PretendardVariable.ttf") format("truetype"); font-weight: 45 920; font-display: block; }`;
  document.head.append(face);
  await Promise.all(
    [400, 500, 600, 700].map((weight) =>
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


type Star = Rect & { state: string; color: string };

/** The Canvas scene's stars (`catalogCanvasNodeData` path children), in the Rating's box. */
function canvasStars(root: CatalogCompositionRoot, id: string): Star[] {
  // biome-ignore lint/suspicious/noExplicitAny: SkiaNodeData read for the harness
  const data = catalogCanvasNodeData(root, id) as any;
  // biome-ignore lint/suspicious/noExplicitAny: SkiaNodeData read for the harness
  const paths: any[] = (data.children ?? []).filter(
    // biome-ignore lint/suspicious/noExplicitAny: SkiaNodeData read for the harness
    (shape: any) => shape.type === "path",
  );
  const stars: Star[] = [];
  for (let i = 0; i < paths.length; i++) {
    const path = paths[i].path;
    const next = paths[i + 1]?.path;
    const outline = (path.d.match(/M/g) ?? []).length === 2;
    const half =
      outline &&
      next?.clip &&
      next.offsetX === path.offsetX &&
      next.offsetY === path.offsetY;
    // (The star's box: the path's own bbox — `width` · `height` past its offset.)
    stars.push({
      x: path.offsetX,
      y: path.offsetY,
      width: paths[i].width - path.offsetX,
      height: paths[i].height - path.offsetY,
      state: half
        ? `half/${next.clip.width}`
        : outline
          ? "empty"
          : "full",
      color: floatRgba(path.fillColor),
    });
    if (half) i++;
  }
  return stars;
}

/** The DOM's stars (`span.rating-star`), in the Rating element's border box. */
function domStars(element: HTMLElement): Star[] {
  const origin = element.getBoundingClientRect();
  return [...element.querySelectorAll<HTMLElement>(":scope > .rating-star")].map(
    (star) => {
      const box = star.getBoundingClientRect();
      const svgs = star.querySelectorAll("svg");
      const half = star.querySelector<SVGElement>(".rating-star-half");
      const outline =
        (svgs[0]!.querySelector("path")!.getAttribute("d")!.match(/M/g) ?? [])
          .length === 2;
      const clip = half && getComputedStyle(half).clipPath;
      return {
        x: box.x - origin.x,
        y: box.y - origin.y,
        width: box.width,
        height: box.height,
        state: half
          ? `half/${clip === "inset(0px 50% 0px 0px)" ? box.width / 2 : clip}`
          : outline
            ? "empty"
            : "full",
        color: rgba(getComputedStyle(svgs[0]!).fill),
      };
    },
  );
}

const apart = (a: Rect, b: Rect): number =>
  Math.max(
    Math.abs(a.x - b.x),
    Math.abs(a.y - b.y),
    Math.abs(a.width - b.width),
    Math.abs(a.height - b.height),
  );

async function compare(fixture: Fixture) {
  const runtime = new CatalogRuntime(
    new CatalogGraph(documentFor(fixture), code),
    new CatalogStorage(indexedDB, `adr321-g4-${fixture.key}`),
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
  const sceneRoot = [...root.canvasInputs.values()].find(
    (input) => input.parentId === "catalog:root",
  )!.id;
  const scene = fixture.after
    ? bindCatalogCanvas(root, [sceneRoot])
    : undefined;
  if (fixture.after)
    root.execute(
      setFields({
        targets: [{ kind: "node", id: RATING }],
        props: Object.fromEntries(
          Object.entries(fixture.after).map(([key, value]) => [
            key,
            set(value),
          ]),
        ),
      } as never),
    );
  let sceneDifferences: string[] = [];
  let sceneStatus: string | undefined;
  if (scene) {
    sceneStatus = String(
      (scene.update() as unknown as { status?: string }).status,
    );
    const snapshot = () =>
      new Map(
        [...root.canvasInputs.keys()].map((id) => [
          id,
          JSON.stringify(getSkiaNode(id), (_, value) =>
            ArrayBuffer.isView(value)
              ? Array.from(value as Float32Array)
              : value,
          ),
        ]),
      );
    const patched = snapshot();
    const fresh = bindCatalogCanvas(root, [sceneRoot]);
    const rebuilt = snapshot();
    sceneDifferences = [...patched]
      .filter(([id, data]) => rebuilt.get(id) !== data)
      .map(([id]) => id.split(":").pop()!);
    fresh.dispose();
    scene.dispose();
  }
  const records = root.canvasInputs;
  const rating = [...records.values()].find((r) => r.sourceId === RATING)!;
  const geometry = root.getGeometry(records.keys());
  let x = 0;
  let y = 0;
  for (let at = records.get(rating.id); at; at = records.get(at.parentId)) {
    const rect = geometry.get(at.id);
    if (rect) {
      x += rect.x;
      y += rect.y;
    }
  }
  const own = geometry.get(rating.id)!;
  const canvasBox = { x, y, width: own.width, height: own.height };

  const host = document.createElement("div");
  host.style.cssText = `position:absolute;left:0;top:0;width:${PAGE.width}px;height:${PAGE.height}px;overflow:hidden`;
  document.body.append(host);
  const reactRoot = createRoot(host);
  flushSync(() =>
    reactRoot.render(
      createElement(I18nProvider, {
        locale: LOCALE,
        children: renderCatalogDom(root, sceneRoot),
      }),
    ),
  );
  await new Promise((resolve) => setTimeout(resolve, 50));
  const origin = host.getBoundingClientRect();
  const element = host.querySelector<HTMLElement>(
    `[data-catalog-id="${CSS.escape(rating.id)}"]`,
  )!;
  const box = element.getBoundingClientRect();
  const domBox = {
    x: box.x - origin.x,
    y: box.y - origin.y,
    width: box.width,
    height: box.height,
  };
  const dom = domStars(element);
  const canvas = canvasStars(root, rating.id);
  const differences: unknown[] = [];
  if (apart(domBox, canvasBox) > 1)
    differences.push({ box: { dom: domBox, canvas: canvasBox } });
  if (dom.length !== canvas.length)
    differences.push({ count: { dom: dom.length, canvas: canvas.length } });
  dom.forEach((a, index) => {
    const b = canvas[index];
    if (
      !b ||
      apart(a, b) > 1 ||
      a.state !== b.state ||
      a.color !== b.color
    )
      differences.push({ star: index, dom: a, canvas: b });
  });
  reactRoot.unmount();
  host.remove();
  return {
    key: fixture.key,
    box: { dom: domBox, canvas: canvasBox },
    dom,
    canvas,
    differences,
    sceneDifferences,
    sceneStatus,
  };
}

/** Chrome alone against the design-data values written out by hand (half a pixel). */
const EXPECTED: Record<
  string,
  { box: [number, number]; stars: [number, number, number, string][] }
> = {
  // M: star 18, gap 4 → 22 apart; padding 7 → 106 × 32.
  "M-input-3": {
    box: [106, 32],
    stars: [
      [0, 7, 18, "full"],
      [44, 7, 18, "full"],
      [66, 7, 18, "empty"],
      [88, 7, 18, "empty"],
    ],
  },
  // S: star 16, gap 4 → 20 apart; padding 4 → 96 × 24. 2.5 → half on the third (8 of 16).
  "S-display-2.5": {
    box: [96, 24],
    stars: [
      [20, 4, 16, "full"],
      [40, 4, 16, "half/8"],
      [60, 4, 16, "empty"],
    ],
  },
  // 2.3 shown as 2.5 (half star steps).
  "M-display-2.3": { box: [106, 32], stars: [[44, 7, 18, "half/9"]] },
  // Authored 200 × 60, padding 10 · 12 left: stars from 12, centred in 40 → 10 + 11.
  "M-authored-box": {
    box: [200, 60],
    stars: [
      [12, 21, 18, "full"],
      [78, 21, 18, "full"],
      [100, 21, 18, "empty"],
    ],
  },
};

describe("ADR-321 G4 — Rating Canvas ↔ Preview DOM", () => {
  for (const fixture of FIXTURES)
    it(fixture.key, async () => {
      const result = await compare(fixture);
      report.push(result);
      expect(result.dom).toHaveLength(5);
      expect(result.differences).toEqual([]);
      expect(result.sceneDifferences).toEqual([]);
      if (fixture.after) expect(result.sceneStatus).toBe("patched");
      const expected = EXPECTED[fixture.key];
      if (!expected) return;
      const near = (got: number, want: number, what: string) =>
        expect(Math.abs(got - want), `${fixture.key} ${what}`).toBeLessThanOrEqual(
          0.5,
        );
      near(result.box.dom.width, expected.box[0], "width");
      near(result.box.dom.height, expected.box[1], "height");
      for (const [x, y, size, state] of expected.stars) {
        const star = result.dom.find((s) => Math.abs(s.x - x) <= 0.5);
        expect(star, `${fixture.key} star at ${x}`).toBeDefined();
        near(star!.y, y, `star ${x} y`);
        near(star!.width, size, `star ${x} width`);
        expect(star!.state, `${fixture.key} star ${x}`).toBe(state);
      }
    });
});

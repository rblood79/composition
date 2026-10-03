/**
 * ADR-248 Phase 4e — Canvas ↔ DOM contract for prop axes the frozen G3 scenarios never authored
 * (their axis replay is `variant` / `size` only). Each case inserts the palette composite of a type
 * with the axis props, lays it out with the product composition root and renders the isolated RAC
 * DOM (`renderCatalogDom`, the Preview path) with the same resolved values; every node's box must
 * agree within 1 CSS px (G3 canvasDom leg, same environment: Pretendard file, bundle CSS, Preview
 * reset, default theme, fixed locale).
 *
 * Report: `test-results/adr248-prop-axis-canvas-dom.json`.
 */
import { createElement } from "react";
import { I18nProvider } from "react-aria-components";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import bundleCss from "@composition/shared/components/styles/index.css?inline";
import { injectPreviewBaseStyles } from "@/preview/baseStyles";
import {
  catalogDomRendersNode,
  renderCatalogDom,
} from "@/builder/catalogRuntime/domBinding";
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
} from "@composition/specs";
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
import { catalogPaletteDefinitionId } from "@/builder/catalogRuntime/paletteInsert";
import { buildCodeCatalogLibrary } from "../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../packages/shared/src/catalog/document/graph";
import {
  catalogSubpartDomSelectors,
  catalogSubpartDomUnion,
} from "../../../../packages/shared/src/catalog/document/rulePartRules";
import type {
  CatalogDocument,
  CatalogLibrary,
  DefinitionId,
  NodeEntry,
} from "../../../../packages/shared/src/catalog/document/types";

type Rect = { x: number; y: number; width: number; height: number };
const PAGE = { width: 1920, height: 1080 };
const LOCALE = "en-US";
const REPORT = "test-results/adr248-prop-axis-canvas-dom.json";

/** Types whose rule has a `label-position: side` container variant (generated CSS). */
const SIDE_LABEL_TYPES = [
  "TextField",
  "TextArea",
  "NumberField",
  "SearchField",
  "ComboBox",
  "Select",
  "DateField",
  "TimeField",
  "DatePicker",
  "DateRangePicker",
  "ColorField",
  "Meter",
  "ProgressBar",
  "Slider",
  "RadioGroup",
  "CheckboxGroup",
  "TagGroup",
] as const;

const CASES: Array<{
  key: string;
  type: string;
  props: Record<string, string>;
}> = [
  ...SIDE_LABEL_TYPES.flatMap((type): typeof CASES => [
    { key: `${type}-top`, type, props: {} },
    { key: `${type}-side`, type, props: { labelPosition: "side" } },
  ]),
  // ADR-251 G2: the group items wrapper node (RadioItems · CheckboxItems) takes the group rule's
  // `orientation` block — horizontal × label position × a non-default size (xl: the size without
  // its own `--radio-items-gap`, falling back to the root's).
  ...(["RadioGroup", "CheckboxGroup"] as const).flatMap((type): typeof CASES =>
    ["sm", "xl"].flatMap((size) =>
      ["top", "side"].map((labelPosition) => ({
        key: `${type}-horizontal-${labelPosition}-${size}`,
        type,
        props: { orientation: "horizontal", labelPosition, size },
      })),
    ),
  ),
];

let code: CatalogLibrary;
const report: unknown[] = [];

function documentFor(
  definitionId: DefinitionId,
  props: Record<string, string>,
): CatalogDocument {
  const projectId = "project:project:axis" as const;
  const pageId = "project:page:main" as const;
  const node: NodeEntry = {
    kind: "node",
    id: "project:node:subject" as NodeEntry["id"],
    definitionId,
    children: [],
    props: Object.fromEntries(
      Object.entries(props).map(([key, value]) => [
        key,
        { kind: "set", value },
      ]),
    ) as NodeEntry["props"],
    visual: {},
    sizing: { width: { kind: "set", value: 420 } },
    placement: { kind: "absolute", x: 30, y: 30 },
    descendantOverrides: [],
  };
  return {
    format: "composition-catalog",
    schemaVersion: 1,
    libraryContractVersion: 2,
    revision: 0,
    projectId,
    rootId: projectId,
    entries: {
      [projectId]: {
        kind: "project",
        id: projectId,
        name: "axis",
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
        name: "Main",
        route: "/",
        children: [node.id],
      },
      [node.id]: node,
    },
  };
}

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
    {
      baseTypographySeed: DEFAULT_BASE_TYPOGRAPHY,
    },
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
  // Same text environment as the G3 judge: the builtin faces loaded for the product measurer.
  await initCanvasKit();
  await loadBuiltinFontsToSkia();
  code = await buildCodeCatalogLibrary();
});

afterAll(async () => {
  await commands.writeFile(REPORT, `${JSON.stringify(report, null, 1)}\n`);
});

/** Canvas page-absolute rects of every record and the isolated DOM box of the same node. */
async function compare(
  type: string,
  props: Record<string, string>,
  key: string,
) {
  const definitionId = catalogPaletteDefinitionId(code, type) as DefinitionId;
  const runtime = new CatalogRuntime(
    new CatalogGraph(documentFor(definitionId, props), code),
    new CatalogStorage(indexedDB, `adr248-axis-${key}`),
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
  const relative = root.getGeometry(root.canvasInputs.keys());
  const absolute = new Map<string, Rect>();
  const place = (id: string, parentX: number, parentY: number) => {
    const rect = relative.get(id);
    if (!rect) return;
    const x = parentX + rect.x;
    const y = parentY + rect.y;
    absolute.set(id, { x, y, width: rect.width, height: rect.height });
    for (const child of root.canvasInputs.get(id)?.children ?? [])
      place(child, x, y);
  };
  place(rootInput.id, 0, 0);

  const host = document.createElement("div");
  host.style.cssText = `position:absolute;left:0;top:0;width:${PAGE.width}px;height:${PAGE.height}px;overflow:hidden`;
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
  const origin = host.getBoundingClientRect();
  const ownedSeen = new Map<string, number>();
  const unionOf = new Map<string, Element[]>();
  const locate = (id: string): Element | null => {
    const node = root.canvasInputs.get(id)!;
    let owner = root.canvasInputs.get(node.parentId);
    while (owner && !catalogDomRendersNode(root, owner.id))
      owner = root.canvasInputs.get(owner.parentId);
    const ownerElement = owner
      ? host.querySelector(`[data-catalog-id="${CSS.escape(owner.id)}"]`)
      : null;
    if (!owner || !ownerElement) return null;
    const childType = root.typeOf(node);
    const seenKey = `${owner.id}|${childType}`;
    const index = ownedSeen.get(seenKey) ?? 0;
    ownedSeen.set(seenKey, index + 1);
    const candidates = [
      ...ownerElement.querySelectorAll(
        catalogSubpartDomSelectors(root.typeOf(owner), childType).join(", "),
      ),
    ].filter((candidate) => !candidate.closest("[hidden]"));
    if (catalogSubpartDomUnion(root.typeOf(owner), childType)) {
      unionOf.set(id, candidates);
      return candidates[0] ?? null;
    }
    return candidates[index] ?? null;
  };
  const boxOf = (id: string, element: Element) => {
    const parts = unionOf.get(id);
    if (!parts?.length) return element.getBoundingClientRect();
    const rects = parts.map((part) => part.getBoundingClientRect());
    const left = Math.min(...rects.map((rect) => rect.left));
    const top = Math.min(...rects.map((rect) => rect.top));
    return {
      x: left,
      y: top,
      width: Math.max(...rects.map((rect) => rect.right)) - left,
      height: Math.max(...rects.map((rect) => rect.bottom)) - top,
    };
  };
  const underHidden = (id: string): boolean => {
    for (
      let cursor = root.canvasInputs.get(id);
      cursor;
      cursor = root.canvasInputs.get(cursor.parentId)
    )
      if (cursor.hidden) return true;
    return false;
  };
  const over: unknown[] = [];
  const nodes: unknown[] = [];
  let rootData = "";
  let worst = 0;
  let pairs = 0;
  for (const [id, rect] of absolute) {
    if (underHidden(id)) continue;
    const marked = catalogDomRendersNode(root, id);
    let element = marked
      ? host.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`)
      : locate(id);
    if (element && id === rootInput.id)
      while (
        element.parentElement &&
        element.parentElement !== host &&
        getComputedStyle(element.parentElement).display !== "contents"
      )
        element = element.parentElement;
    if (!element || getComputedStyle(element).display === "contents") continue;
    if (id === rootInput.id)
      rootData = [...host.querySelectorAll("[data-label-position], [data-catalog-id]")]
        .slice(0, 3)
        .map((el) => `${el.className} lp=${el.getAttribute("data-label-position")}`)
        .join(" | ");
    const box = boxOf(id, element);
    const dom = {
      x: box.x - origin.x,
      y: box.y - origin.y,
      width: box.width,
      height: box.height,
    };
    pairs++;
    const delta = Math.max(
      Math.abs(dom.x - rect.x),
      Math.abs(dom.y - rect.y),
      Math.abs(dom.width - rect.width),
      Math.abs(dom.height - rect.height),
    );
    worst = Math.max(worst, delta);
    nodes.push({ node: `${root.typeOf(root.canvasInputs.get(id)!)}`, canvas: rect, dom });
    if (delta > 1)
      over.push({
        node: `${root.typeOf(root.canvasInputs.get(id)!)} ${id.split("::").pop()}`,
        canvas: rect,
        dom,
      });
  }
  reactRoot.unmount();
  host.remove();
  return {
    key,
    pairs,
    maxDelta: Math.round(worst * 10) / 10,
    over,
    nodes,
    rootData,
    pass: worst <= 1,
  };
}

describe("ADR-248 4e — prop axis Canvas ↔ DOM", () => {
  for (const { key, type, props } of CASES)
    it(key, async () => {
      const result = await compare(type, props, key);
      report.push(result);
      expect(result.over).toEqual([]);
    });
});

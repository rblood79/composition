/**
 * ADR-300 G3 — the SideNav family, Canvas ↔ Preview DOM (fixture 8 + the incremental arm). Each
 * fixture is a hand-made SideNavPanel > SideNav tree (two levels, a link-less parent, rows with and
 * without an icon — not a generated document) laid out by the product composition root and drawn by
 * the Preview's DOM renderer (`renderCatalogDom` — RAC `NavigationTree`, the generated sheets) in
 * the same environment. The DOM is the independent arm (Chrome's boxes and computed style).
 *
 * Read per drawn node: its box (Canvas engine rect vs the element's `getBoundingClientRect` — a
 * Canvas SideNavItem is a column of its row and child items, so its row is compared: the
 * SideNavItemContent's rect against the RAC row element), a row · header Text's font size · weight ·
 * color, a row Icon's color, the chevron glyph's visibility and turn, and the current-route bar
 * (the row's `::before` vs the Canvas bar shape). Hidden on one side only is a difference.
 *
 * Fixtures (ADR G3): expanded · child items closed · current · closed current ancestor · sections +
 * headers · collapsed panel · collapsed + current descendant (the parent closes and is marked) ·
 * collapsed then expanded again (the stored keys come back). The incremental arm builds the panel
 * open, then sets `isCollapsed` only (the SideNav nodes untouched — a missed dirty expansion shows).
 *
 * Conditions: Chrome (`channel: chrome`, headless), DPR 1, viewport 1440×900, light theme,
 * `visibilityState` visible, Pretendard file in both legs, en-US (ltr). Gate: every box ≤ 1 CSS px,
 * every paint value equal. Report: `test-results/adr300-sidenav-parity.json`.
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
import { getIconData } from "@composition/rendering";
import { buildCodeCatalogLibrary } from "../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../packages/shared/src/catalog/document/graph";
import { setFields } from "../../../../packages/shared/src/catalog/commands";
import { loadCatalogSideNav } from "../../../../packages/shared/src/catalog/runtime/sideNav.lazy";
import { CatalogCurrentRouteContext } from "../../../../packages/shared/src/catalog/runtime/sideNavRoute";
import type {
  CatalogDocument,
  CatalogLibrary,
  NodeEntry,
} from "../../../../packages/shared/src/catalog/document/types";

type Rect = { x: number; y: number; width: number; height: number };
const PAGE = { width: 1440, height: 900 };
const LOCALE = "en-US";
const ROUTE = "/home";
const REPORT = "test-results/adr300-sidenav-parity.json";
const set = <T>(value: T) => ({ kind: "set" as const, value });
const PANEL = "project:node:panel";
const BODY = "project:node:body";
const report: unknown[] = [];
let code: CatalogLibrary;

// ── the fixture tree (hand-made: two levels, a link-less parent, rows with and without an icon) ──

type Spec = {
  name: string;
  type: string;
  props?: Record<string, unknown>;
  visual?: Record<string, unknown>;
  children?: Spec[];
};
const text = (name: string, label: string): Spec => ({
  name,
  type: "Text",
  props: { children: label },
});
const icon = (name: string, iconName: string, size = "S"): Spec => ({
  name,
  type: "Icon",
  props: { iconName, size },
});
const chevron = (name: string): Spec => ({
  name: `${name}-chev`,
  type: "Button",
  props: { slot: "chevron", size: "S", children: "" },
  children: [icon(`${name}-chev-icon`, "chevron-right", "XS")],
});
/** A row: [icon] + (link > label | label) + chevron, then its child items. */
const item = (
  name: string,
  label: string,
  options: { href?: string; icon?: string; children?: Spec[] } = {},
): Spec => ({
  name,
  type: "SideNavItem",
  props: {
    id: name,
    textValue: label,
    ...(options.href ? { href: options.href } : {}),
  },
  children: [
    {
      name: `${name}-content`,
      type: "SideNavItemContent",
      children: [
        ...(options.icon ? [icon(`${name}-icon`, options.icon)] : []),
        options.href
          ? {
              name: `${name}-link`,
              type: "SideNavItemLink",
              children: [text(`${name}-label`, label)],
            }
          : text(`${name}-label`, label),
        chevron(name),
      ],
    },
    ...(options.children ?? []),
  ],
});
const ITEMS: Spec[] = [
  item("home", "Home", { href: "/home", icon: "home" }),
  item("guides", "Guides", {
    icon: "book-open",
    children: [
      item("start", "Getting started", { href: "/guides/start" }),
      item("install", "Install", { href: "/guides/install" }),
    ],
  }),
  item("settings", "Settings", { href: "/settings", icon: "settings" }),
];
const SECTIONS: Spec[] = [
  {
    name: "s1",
    type: "SideNavSection",
    children: [
      {
        name: "s1-header",
        type: "SideNavHeader",
        children: [text("s1-header-text", "Docs")],
      },
      ...ITEMS.slice(0, 2),
    ],
  },
  {
    name: "s2",
    type: "SideNavSection",
    children: [
      {
        name: "s2-header",
        type: "SideNavHeader",
        children: [text("s2-header-text", "Account")],
      },
      ITEMS[2]!,
    ],
  },
];

type Fixture = {
  key: string;
  nav: Record<string, unknown>;
  panel?: Record<string, unknown>;
  sections?: boolean;
  /** Writes executed after the build (the incremental arms) — the panel's props. */
  after?: Record<string, unknown>;
  /** Or another node's visual writes after the build (`[node name, visual]`). */
  afterVisual?: [string, Record<string, unknown>];
  /** Authored visual on nodes at build (`node name → visual`). */
  authored?: Record<string, Record<string, unknown>>;
};
const FIXTURES: Fixture[] = [
  { key: "expanded", nav: { expandedKeys: ["guides"] } },
  { key: "child-items-closed", nav: { expandedKeys: [] } },
  // (No `selectedRoute`: the page's route — user decision 1.)
  { key: "current-page-route", nav: { expandedKeys: ["guides"] } },
  {
    key: "closed-current-ancestor",
    nav: { expandedKeys: [], selectedRoute: "/guides/start" },
  },
  {
    key: "sections-headers",
    nav: { expandedKeys: ["guides"] },
    sections: true,
  },
  {
    key: "panel-collapsed",
    nav: { expandedKeys: ["guides"] },
    panel: { isCollapsed: true },
  },
  {
    key: "collapsed-current-descendant",
    nav: { expandedKeys: ["guides"], selectedRoute: "/guides/start" },
    panel: { isCollapsed: true },
  },
  {
    key: "collapsed-then-expanded",
    nav: { expandedKeys: ["guides"], selectedRoute: "/guides/start" },
    panel: { isCollapsed: true },
    after: { isCollapsed: false },
  },
  // An authored label · header color: the Text keeps its owner's type (S2 — the DOM's `inherit`
  //  of size · weight · line height); only its color is its own.
  {
    key: "authored-text-color",
    nav: { expandedKeys: ["guides"] },
    sections: true,
    authored: {
      "home-label": { color: "#c00000" },
      "s1-header-text": { color: "#c00000" },
    },
  },
  // A header's own type edited after the build: its Text follows (the header's dependents).
  {
    key: "incremental-header-edit",
    nav: { expandedKeys: ["guides"] },
    sections: true,
    afterVisual: ["s1-header", { fontSize: 16, color: "#c00000" }],
  },
  // (Color only — a paint-only write, no layout pass.)
  {
    key: "incremental-header-color",
    nav: { expandedKeys: ["guides"] },
    sections: true,
    afterVisual: ["s1-header", { color: "#c00000" }],
  },
  // The incremental arm: built open, only the panel's `isCollapsed` changes.
  {
    key: "incremental-collapse",
    nav: { expandedKeys: ["guides"], selectedRoute: "/guides/start" },
    after: { isCollapsed: true },
  },
];

function documentFor(fixture: Fixture): CatalogDocument {
  const projectId = "project:project:adr300-g3";
  const pageId = "project:page:adr300-g3";
  const entries: Record<string, unknown> = {};
  const add = (spec: Spec): string => {
    const id = `project:node:${spec.name}`;
    entries[id] = {
      kind: "node",
      id,
      definitionId:
        spec.type === "Text"
          ? "lib:definition:text"
          : `lib:definition:type-${spec.type}`,
      children: (spec.children ?? []).map(add),
      props: Object.fromEntries(
        Object.entries(spec.props ?? {}).map(([key, value]) => [
          key,
          set(value),
        ]),
      ),
      visual: Object.fromEntries(
        Object.entries(spec.visual ?? {}).map(([key, value]) => [
          key,
          set(value),
        ]),
      ),
      sizing: {},
      descendantOverrides: [],
    } as NodeEntry;
    return id;
  };
  const authoredSpec = (spec: Spec): Spec => ({
    ...spec,
    visual: { ...spec.visual, ...fixture.authored?.[spec.name] },
    children: spec.children?.map(authoredSpec),
  });
  const items = (fixture.sections ? SECTIONS : ITEMS).map(authoredSpec);
  add({
    name: "panel",
    type: "SideNavPanel",
    props: { "aria-label": "Side navigation", ...fixture.panel },
    visual: { width: "240px", height: "520px" },
    children: [
      {
        name: "nav",
        type: "SideNav",
        props: { "aria-label": "Docs", ...fixture.nav },
        children: items,
      },
      {
        name: "collapse",
        type: "Button",
        props: { slot: "collapse", size: "S", children: "" },
        children: [icon("collapse-icon", "panel-left")],
      },
    ],
  });
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
        name: "adr300",
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
        route: ROUTE,
        children: [BODY],
      },
      // (A page body holds the panel, as in a project — the panel's width change stays inside the
      //  scene root, so the incremental arm takes the patch path.)
      [BODY]: {
        kind: "node",
        id: BODY,
        definitionId: "lib:definition:type-body",
        children: [PANEL],
        props: {},
        visual: {},
        sizing: {},
        descendantOverrides: [],
      },
      ...entries,
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
  await loadCatalogSideNav();
  code = await buildCodeCatalogLibrary();
});

afterAll(async () => {
  await commands.writeFile(REPORT, `${JSON.stringify(report, null, 1)}\n`);
});

/** A float 0..1 rgba (Skia) as the canvas parser's 0..255 string. */
const floatRgba = (color: ArrayLike<number> | undefined): string =>
  color
    ? Array.from(color)
        .map((value) => Math.round(value * 255))
        .join(",")
    : "none";
const CHEVRON_DOWN = JSON.stringify(getIconData("chevron-down")?.paths);

/** What the Canvas scene draws for a record (`catalogCanvasNodeData`): text · glyph · row bar. */
function canvasPaint(root: CatalogCompositionRoot, id: string) {
  // biome-ignore lint/suspicious/noExplicitAny: SkiaNodeData read for the harness
  const data = catalogCanvasNodeData(root, id) as any;
  const record = root.canvasInputs.get(id)!;
  let bar: { x: number; y: number; width: number; height: number; color: string } | undefined;
  if (root.typeOf(record) === "SideNavItem") {
    const content = record.children.find(
      (child) => root.typeOf(root.canvasInputs.get(child)!) === "SideNavItemContent",
    );
    // biome-ignore lint/suspicious/noExplicitAny: SkiaNodeData read for the harness
    const row = content ? (catalogCanvasNodeData(root, content) as any) : undefined;
    // biome-ignore lint/suspicious/noExplicitAny: SkiaNodeData read for the harness
    const shape = (row?.children ?? []).find((child: any) => child.width <= 3 && child.height >= 10);
    if (shape)
      bar = {
        x: shape.x,
        y: shape.y,
        width: shape.width,
        height: shape.height,
        color: floatRgba(shape.box?.fillColor),
      };
  }
  return {
    fontSize: data.text?.fontSize as number | undefined,
    fontWeight: (data.text?.fontWeight ?? 400) as number,
    color: floatRgba(data.text?.color ?? data.iconPath?.strokeColor),
    visible: data.visible !== false,
    turned: JSON.stringify(data.iconPath?.paths) === CHEVRON_DOWN,
    bar,
    // (Its box fill — none at rest reads as transparent.)
    fill: data.box?.fillColor?.[3] > 0 ? floatRgba(data.box.fillColor) : "0,0,0,0",
  };
}

async function compare(fixture: Fixture) {
  const runtime = new CatalogRuntime(
    new CatalogGraph(documentFor(fixture), code),
    new CatalogStorage(indexedDB, `adr300-g3-${fixture.key}`),
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
  // The scene arm: an incremental arm's Canvas scene is bound before the change and patched after
  // it (`update` — the record dirty sets, canvasBinding's expansion); it must equal a fresh bind.
  const sceneRoot = [...root.canvasInputs.values()].find(
    (input) => input.parentId === "catalog:root",
  )!.id;
  const scene =
    fixture.after || fixture.afterVisual
      ? bindCatalogCanvas(root, [sceneRoot])
      : undefined;
  if (fixture.afterVisual)
    root.execute(
      setFields({
        targets: [
          { kind: "node", id: `project:node:${fixture.afterVisual[0]}` },
        ],
        visual: Object.fromEntries(
          Object.entries(fixture.afterVisual[1]).map(([key, value]) => [
            key,
            set(value),
          ]),
        ),
      } as never),
    );
  if (fixture.after)
    root.execute(
      setFields({
        targets: [{ kind: "node", id: PANEL }],
        props: Object.fromEntries(
          Object.entries(fixture.after).map(([key, value]) => [
            key,
            set(value),
          ]),
        ),
      } as never),
    );
  const rows: unknown[] = [];
  let sceneDifferences: string[] = [];
  let sceneStatus: string | undefined;
  if (scene) {
    // (The patch path — a rebind would compare a fresh scene with itself.)
    sceneStatus = String(
      (scene.update() as unknown as { status?: string }).status,
    );
    const snapshot = () =>
      new Map(
        [...root.canvasInputs.keys()].map((id) => [
          id,
          JSON.stringify(getSkiaNode(id), (_, value) =>
            ArrayBuffer.isView(value) ? Array.from(value as Float32Array) : value,
          ),
        ]),
      );
    const patched = snapshot();
    const commands = Array.from(scene.stream.commands);
    const fresh = bindCatalogCanvas(root, [sceneRoot]);
    const rebuilt = snapshot();
    sceneDifferences = [...patched]
      .filter(([id, data]) => rebuilt.get(id) !== data)
      .map(([id]) => id.split(":").pop()!);
    const sample = [...patched].find(([id, data]) => rebuilt.get(id) !== data);
    if (sample) {
      const a = JSON.parse(sample[1] ?? "null");
      const b = JSON.parse(rebuilt.get(sample[0]) ?? "null");
      const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
      rows.push({
        sceneSample: sample[0].split(":").pop(),
        diff: [...keys]
          .filter((key) => JSON.stringify(a?.[key]) !== JSON.stringify(b?.[key]))
          .map((key) => [key, JSON.stringify(a?.[key])?.slice(0, 200), JSON.stringify(b?.[key])?.slice(0, 200)]),
      });
    }
    if (JSON.stringify(commands) !== JSON.stringify(Array.from(fresh.stream.commands)))
      sceneDifferences.push("(commands)");
    fresh.dispose();
    scene.dispose();
  }
  const records = root.canvasInputs;
  const rootInput = [...records.values()].find(
    (input) => input.parentId === "catalog:root",
  )!;
  const relative = root.getGeometry(records.keys());
  const absolute = new Map<string, Rect>();
  const place = (id: string, parentX: number, parentY: number) => {
    const rect = relative.get(id);
    if (!rect) return;
    const x = parentX + rect.x;
    const y = parentY + rect.y;
    absolute.set(id, { x, y, width: rect.width, height: rect.height });
    for (const child of records.get(id)?.children ?? []) place(child, x, y);
  };
  place(rootInput.id, 0, 0);
  const hiddenOnCanvas = (id: string): boolean => {
    for (
      let cursor = records.get(id);
      cursor;
      cursor = records.get(cursor.parentId)
    )
      if (cursor.hidden) return true;
    return false;
  };

  const host = document.createElement("div");
  host.style.cssText = `position:absolute;left:0;top:0;width:${PAGE.width}px;height:${PAGE.height}px;overflow:hidden`;
  document.body.append(host);
  const reactRoot = createRoot(host);
  flushSync(() =>
    reactRoot.render(
      createElement(I18nProvider, {
        locale: LOCALE,
        children: createElement(CatalogCurrentRouteContext.Provider, {
          value: ROUTE,
          children: renderCatalogDom(root, rootInput.id),
        }),
      }),
    ),
  );
  await new Promise((resolve) => setTimeout(resolve, 300));
  const origin = host.getBoundingClientRect();
  const typeOf = (id: string) => root.typeOf(records.get(id)!);
  const nameOf = (id: string) => id.split(":").pop()!;
  const elementOf = (id: string): HTMLElement | null =>
    host.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`);
  const canvasRectOf = (id: string): Rect | undefined => {
    // (A Canvas item is its row and its child items — its row is its content.)
    if (typeOf(id) === "SideNavItem") {
      const content = records
        .get(id)!
        .children.find((child) => typeOf(child) === "SideNavItemContent");
      return content ? absolute.get(content) : undefined;
    }
    return absolute.get(id);
  };
  const differences: unknown[] = [];
  for (const [id, record] of records) {
    if (!id.includes("project:node:")) continue;
    const type = typeOf(id);
    if (type === "SideNavItemContent") continue; // (compared as its item's row)
    const name = nameOf(id);
    const element = elementOf(id);
    // (A box in the layout. A leaf item's chevron is S2 `visibility: hidden` — its button keeps the
    //  box and paints nothing (the Canvas button is unpainted); its glyph is not drawn: compared as
    //  the glyph's `visible` below.)
    const shown =
      !!element &&
      getComputedStyle(element).display !== "none" &&
      element.getClientRects().length > 0;
    const glyphHidden =
      shown &&
      type === "Icon" &&
      getComputedStyle(element).visibility === "hidden";
    const canvasShown = !hiddenOnCanvas(id) || glyphHidden;
    if (shown !== canvasShown) {
      differences.push({
        name,
        type,
        shown: { dom: shown, canvas: canvasShown },
      });
      continue;
    }
    if (!shown || !element) continue;
    const box = element.getBoundingClientRect();
    const dom = {
      x: box.x - origin.x,
      y: box.y - origin.y,
      width: box.width,
      height: box.height,
    };
    const canvas = glyphHidden ? undefined : canvasRectOf(id);
    if (canvas) {
      const delta = Math.max(
        Math.abs(dom.x - canvas.x),
        Math.abs(dom.y - canvas.y),
        Math.abs(dom.width - canvas.width),
        Math.abs(dom.height - canvas.height),
      );
      if (delta > 1) differences.push({ name, type, box: { dom, canvas } });
    }
    const paint: ReturnType<typeof canvasPaint> = hiddenOnCanvas(id)
      ? {
          fontSize: undefined,
          fontWeight: 400,
          visible: false,
          turned: false,
          color: "none",
          bar: undefined,
          fill: "0,0,0,0",
        }
      : canvasPaint(root, id);
    const style = getComputedStyle(element);
    if (type === "Text") {
      const domText = {
        fontSize: Number.parseFloat(style.fontSize),
        fontWeight: Number(style.fontWeight),
        color: rgba(style.color),
      };
      const canvasText = {
        fontSize: paint.fontSize,
        fontWeight: paint.fontWeight,
        color: paint.color,
      };
      if (JSON.stringify(domText) !== JSON.stringify(canvasText))
        differences.push({
          name,
          type,
          text: { dom: domText, canvas: canvasText },
        });
    }
    if (type === "Icon") {
      const parent = records.get(record.parentId);
      const glyph =
        parent?.props.slot === "chevron"
          ? {
              visible:
                style.visibility !== "hidden" &&
                getComputedStyle(element.parentElement!).visibility !==
                  "hidden",
              turned: style.transform !== "none",
            }
          : undefined;
      // (A glyph neither side draws has no color to compare.)
      const drawn = glyph?.visible !== false;
      const domIcon = { color: drawn ? rgba(style.color) : "none", ...glyph };
      const canvasIcon = {
        color: drawn ? paint.color : "none",
        ...(glyph
          ? { visible: !hiddenOnCanvas(id) && paint.visible, turned: paint.turned }
          : {}),
      };
      // (S2 `currentColor`: a drawn chevron glyph is its row's color — the DOM row's computed one,
      //  independent of the composition's own reading.)
      const row = element.closest(".react-aria-SideNavItem");
      if (glyph?.visible && row && rgba(getComputedStyle(row).color) !== domIcon.color)
        differences.push({
          name,
          type,
          rowColor: { row: rgba(getComputedStyle(row).color), glyph: domIcon.color },
        });
      if (JSON.stringify(domIcon) !== JSON.stringify(canvasIcon))
        differences.push({
          name,
          type,
          icon: { dom: domIcon, canvas: canvasIcon },
        });
    }
    // ADR-300 Phase 4 — the panel's collapse Button is S2's quiet icon-only ActionButton (M: 32 square,
    //  corner 8, no fill at rest): both sides draw that, against S2's values (an outside oracle).
    if (type === "Button" && record.props.slot === "collapse") {
      const domButton = {
        width: Math.round(dom.width),
        height: Math.round(dom.height),
        fill: rgba(style.backgroundColor),
        radius: Number.parseFloat(style.borderTopLeftRadius),
      };
      // (No fill at rest — the Canvas draws no corner to compare; the DOM's is checked against S2.)
      const canvasButton = {
        width: Math.round(canvas?.width ?? 0),
        height: Math.round(canvas?.height ?? 0),
        fill: paint.fill,
      };
      const s2 = { width: 32, height: 32, fill: "0,0,0,0", radius: 8 };
      const { radius: _radius, ...domShared } = domButton;
      if (
        JSON.stringify(domShared) !== JSON.stringify(canvasButton) ||
        JSON.stringify(domButton) !== JSON.stringify(s2)
      )
        differences.push({
          name,
          type,
          collapseButton: { dom: domButton, canvas: canvasButton, s2 },
        });
    }
    if (type === "SideNavItem") {
      const before = getComputedStyle(element, "::before");
      const rowBox = element.getBoundingClientRect();
      const half = (value: string | number) =>
        Math.round(Number.parseFloat(String(value)) * 2) / 2;
      const domBar =
        before.display === "none"
          ? null
          : {
              x: half(before.left),
              y: half(
                Number.parseFloat(before.top) -
                  Number.parseFloat(before.height) / 2,
              ),
              width: half(before.width),
              height: half(before.height),
              color: rgba(before.backgroundColor),
            };
      const canvasBar = paint.bar
        ? {
            x: half(paint.bar.x),
            y: half(paint.bar.y),
            width: half(paint.bar.width),
            height: half(paint.bar.height),
            color: paint.bar.color,
          }
        : null;
      rows.push({ name, height: rowBox.height, domBar, canvasBar });
      if (JSON.stringify(domBar) !== JSON.stringify(canvasBar))
        differences.push({
          name,
          type,
          bar: { dom: domBar, canvas: canvasBar },
        });
    }
  }
  reactRoot.unmount();
  host.remove();
  return { key: fixture.key, differences, rows, sceneDifferences, sceneStatus };
}

describe("ADR-300 G3 — SideNav Canvas ↔ Preview DOM", () => {
  for (const fixture of FIXTURES)
    it(fixture.key, async () => {
      const result = await compare(fixture);
      report.push(result);
      expect(result.differences).toEqual([]);
      expect(result.sceneDifferences).toEqual([]);
      if (fixture.after || fixture.afterVisual)
        expect(result.sceneStatus).toBe("patched");
    });
});

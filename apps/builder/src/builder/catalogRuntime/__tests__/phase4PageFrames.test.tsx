import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { createPencilFixtureLibrary } from "../../../../../../packages/shared/src/catalog/document/pencilFixtureLibrary";
import type {
  CatalogDocument,
  CatalogEntry,
  NodeEntry,
  PageEntry,
  ProjectEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { darkColors, lightColors } from "@composition/rendering";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { bindCatalogCanvas } from "../canvasBinding";
import { CatalogCompositionRoot } from "../compositionRoot";
import { CatalogRuntime } from "../controller";
import { CatalogStorage } from "../storage";
import type { LayoutEngineAPI } from "../../workspace/canvas/wasm-bindings/layoutBridge";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands/fields";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 Phase 4a-4: product page frames — each page's body is a frame on the ADR-232 page
 * container grid inside the same layout tree (tier size unless authored, placement per breakpoint,
 * responsive layers resolved at the root's breakpoint).
 */
const set = <T,>(value: T) => ({ kind: "set" as const, value });
const body = (id: string, patch: Partial<NodeEntry> = {}): NodeEntry => ({
  kind: "node",
  id: `project:node:${id}`,
  definitionId: "lib:definition:frame",
  children: [],
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
  ...patch,
});
const page = (id: string, patch: Partial<PageEntry> = {}): PageEntry => ({
  kind: "page",
  id: `project:page:${id}`,
  name: id,
  route: `/${id}`,
  children: [`project:node:${id}Body`],
  ...patch,
});

async function scene(
  pages: PageEntry[],
  bodies: NodeEntry[],
  project: Partial<ProjectEntry>,
  breakpoint: "desktop" | "tablet" | "mobile" = "desktop",
  colorMode: "light" | "dark" = "light",
  wrapEngine: (engine: LayoutEngineAPI) => LayoutEngineAPI = (engine) =>
    engine,
) {
  const projectId = "project:project:pages" as const;
  const entries: Record<string, CatalogEntry> = {
    [projectId]: {
      kind: "project",
      id: projectId,
      name: "pages",
      pageIds: pages.map((item) => item.id),
      definitionIds: [],
      overrideIds: [],
      themeIds: [],
      tokenIds: [],
      stateVariableIds: [],
      interactionIds: [],
      assetIds: [],
      ...project,
    },
  };
  for (const item of [...pages, ...bodies]) entries[item.id] = item;
  const document: CatalogDocument = {
    format: "composition-catalog",
    schemaVersion: 1,
    libraryContractVersion: 63,
    revision: 0,
    projectId,
    rootId: projectId,
    entries,
  };
  const runtime = new CatalogRuntime(
    new CatalogGraph(document, createPencilFixtureLibrary()),
    new CatalogStorage(
      indexedDB,
      `adr248-phase4-pages-${breakpoint}-${pages.length}`,
    ),
  );
  return new CatalogCompositionRoot(
    runtime,
    wrapEngine(await nodeLayoutEngine()),
    { width: 1440, height: 900 },
    undefined,
    undefined,
    undefined,
    undefined,
    { pageFrames: true, breakpoint, colorMode },
  );
}

describe("ADR-248 Phase 4a-4 page frames", () => {
  it("places page bodies on the page grid at the tier size; an authored size wins", async () => {
    const root = await scene(
      [page("home"), page("about"), page("contact")],
      [
        body("homeBody"),
        body("aboutBody", { sizing: { height: set(1600) } }),
        body("contactBody"),
      ],
      { pageLayout: { direction: "auto", gap: 100, columns: 2 } },
    );
    const frames = root.pageFrameRects();
    expect(frames.get("project:page:home")).toMatchObject({
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
    });
    expect(frames.get("project:page:about")).toMatchObject({
      x: 2020,
      y: 0,
      width: 1920,
      height: 1600,
    });
    // Second row starts below the tallest page of the first row.
    expect(frames.get("project:page:contact")).toMatchObject({
      x: 0,
      y: 1700,
      width: 1920,
      height: 1080,
    });
  });

  it("reads the breakpoint's tier size, placement layer and node responsive layer", async () => {
    const root = await scene(
      [
        page("home"),
        page("about", {
          placement: {
            base: {},
            breakpoints: {
              mobile: { position: "absolute", left: -500, top: 40 },
            },
          },
        }),
      ],
      [
        body("homeBody", {
          children: ["project:node:box"],
        }),
        body("aboutBody"),
        {
          ...body("box"),
          sizing: { width: set(300), height: set(10) },
          responsive: { mobile: { sizing: { width: set(200) } } },
        },
      ],
      { pageLayout: { direction: "vertical", gap: 80 } },
      "mobile",
    );
    const frames = root.pageFrameRects();
    expect(frames.get("project:page:home")).toMatchObject({
      x: 0,
      y: 0,
      width: 390,
      height: 844,
    });
    expect(frames.get("project:page:about")).toMatchObject({ x: -500, y: 40 });
    const box = [...root.canvasInputs.values()].find(
      (item) => item.sourceId === "project:node:box",
    )!;
    expect(root.getGeometry([box.id]).get(box.id)?.width).toBe(200);
  });

  it("resolves theme variables in the root's color mode on the Canvas", async () => {
    const hex = (value: string) =>
      [1, 3, 5].map(
        (i) =>
          Math.round((parseInt(value.slice(i, i + 2), 16) / 255) * 1000) / 1000,
      );
    for (const mode of ["light", "dark"] as const) {
      const root = await scene(
        [page("home")],
        [body("homeBody", { visual: { fill: set("var(--accent)") } })],
        {},
        "desktop",
        mode,
      );
      const bodyId = [...root.canvasInputs.values()][0].id;
      const canvas = bindCatalogCanvas(root, [bodyId]);
      const fill = Array.from(getSkiaNode(bodyId)!.box!.fillColor)
        .slice(0, 3)
        .map((v) => Math.round(v * 1000) / 1000);
      expect(fill).toEqual(
        hex((mode === "dark" ? darkColors : lightColors).accent),
      );
      canvas.dispose();
    }
  });

  it("moves page frames when the monitor width changes the auto column count (ADR-274)", async () => {
    const root = await scene(
      [page("home"), page("about")],
      [body("homeBody"), body("aboutBody")],
      { pageLayout: { direction: "auto", gap: 80 } },
    );
    // 1440 · 40 % → 1 column (Desktop 1920).
    root.setScreenWidth(1440);
    expect(root.pageFrameRects().get("project:page:about")).toMatchObject({
      x: 0,
      y: 1160,
    });
    // 1920 · 40 % → 2 columns.
    expect(root.setScreenWidth(1920)).toBe(true);
    expect(root.pageFrameRects().get("project:page:about")).toMatchObject({
      x: 2000,
      y: 0,
    });
    expect(root.setScreenWidth(1920)).toBe(false);
    // 2000 still fits 2 columns: no layout.
    expect(root.setScreenWidth(2000)).toBe(false);
  });

  it("reads every page frame in one engine batch and reuses it until the layout changes (B2)", async () => {
    // CANVAS_PERF_SCALING_2026-11 B2: the frames were read one wasm call per page, ~3 times a frame.
    let batches = 0;
    const root = await scene(
      [page("home"), page("about"), page("contact")],
      [body("homeBody"), body("aboutBody"), body("contactBody")],
      { pageLayout: { direction: "vertical", gap: 100 } },
      "desktop",
      "light",
      (engine) =>
        new Proxy(engine, {
          get(target, key, receiver) {
            const value = Reflect.get(target, key, receiver);
            if (key !== "getLayoutsBatch") return value;
            return (...args: Parameters<LayoutEngineAPI["getLayoutsBatch"]>) => {
              batches++;
              return (value as LayoutEngineAPI["getLayoutsBatch"]).apply(
                target,
                args,
              );
            };
          },
        }),
    );
    batches = 0;
    const first = root.pageFrameRects();
    expect(first.size).toBe(3);
    expect(batches).toBe(1);
    const again = root.pageFrameRects();
    expect(batches).toBe(1);
    expect(again).toEqual(first);
    // The same generation hands out the same (read-only) map.
    expect(again).toBe(first);
    // A layout (an edit that resizes a page) reads them again.
    root.execute(
      setFields({
        targets: [{ kind: "node", id: "project:node:homeBody" as never }],
        sizing: { height: set(2000) },
      }),
    );
    batches = 0;
    const after = root.pageFrameRects();
    expect(batches).toBe(1);
    expect(after.get("project:page:home")?.height).toBe(2000);
    expect(after.get("project:page:about")?.y).toBe(2100);
  });
});

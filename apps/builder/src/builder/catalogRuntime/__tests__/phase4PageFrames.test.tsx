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
import {
  countedNodeLayoutEngine,
  nodeLayoutEngine,
} from "./support/nodeLayoutEngine";

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
  wrapEngine: (engine: LayoutEngineAPI) => LayoutEngineAPI = (engine) => engine,
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
    libraryContractVersion: 81,
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
            return (
              ...args: Parameters<LayoutEngineAPI["getLayoutsBatch"]>
            ) => {
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

/**
 * A page frame is as tall as its content (user 2026-11-13), so an edit inside a page can resize its
 * root. The Canvas patches that page — its root records its own box again, the changed records
 * follow — and the pages the taller row pushed down are placed (`movePageRoots`); the scene is not
 * bound again. **Why (2026-11-19)**: `geometry-reaches-scene-root` bound every page again for one
 * card's height (22 pages: ~95 ms of the edit's next frame).
 */
describe("a page that grows with its content is patched on the Canvas", () => {
  const box = (id: string, height: number): NodeEntry => ({
    ...body(id),
    sizing: { width: set(200), height: set(height) },
  });
  const pages = ["home", "about", "contact", "blog", "faq"];
  async function grown() {
    const root = await scene(
      pages.map((name) => page(name)),
      pages.flatMap((name) => [
        body(`${name}Body`, { children: [`project:node:${name}Box`] as never }),
        box(`${name}Box`, 300),
      ]),
      { pageLayout: { direction: "auto", gap: 100, columns: 2 } },
    );
    return root;
  }
  const grow = (root: Awaited<ReturnType<typeof grown>>, height: number) =>
    root.execute(
      setFields({
        targets: [{ kind: "node", id: "project:node:homeBox" as never }],
        sizing: { height: set(height) },
      }),
    );
  const boundsOf = (canvas: ReturnType<typeof bindCatalogCanvas>) =>
    Object.fromEntries(
      [...canvas.stream.boundsMap].sort(([a], [b]) => a.localeCompare(b)),
    );

  it("patches the page and places the pages below — the same scene as a fresh bind", async () => {
    const root = await grown();
    const roots = root.pageRootRecords();
    for (const height of [3000, 300, 1500]) {
      // (Bound again each step — the Skia node registry is shared with the fresh bind below.)
      const canvas = bindCatalogCanvas(root, roots);
      grow(root, height);
      const update = canvas.update();
      expect(update.status).toBe("patched");
      // (The scene's next step — `CatalogCanvasScene.pageGridChanged`.)
      const moved = canvas.movePageRoots();
      expect(moved).not.toBeNull();
      const patched = boundsOf(canvas);
      const nodes = Object.fromEntries(
        Object.keys(patched).map((id) => [id, getSkiaNode(id)]),
      );
      canvas.dispose();
      const fresh = bindCatalogCanvas(root, roots);
      expect(patched).toEqual(boundsOf(fresh));
      for (const [id, data] of Object.entries(nodes))
        expect(data, id).toEqual(getSkiaNode(id));
      fresh.dispose();
    }
  });

  it("an edit on one page does not lay the other pages out again (engine visits)", async () => {
    // The page grid solved every page twice a layout (the row measure, then the cell) under two
    // availables, so a frame as tall as its content missed the engine's one-slot cache: one edit
    // solved the whole document again, four times a step (2026-11-19 — 22 pages 25 ms each).
    const visits: number[] = [];
    for (const count of [4, 12]) {
      const names = Array.from({ length: count }, (_, index) => `p${index}`);
      const counted = await countedNodeLayoutEngine();
      const root = await scene(
        names.map((name) => page(name)),
        names.flatMap((name) => [
          body(`${name}Body`, {
            children: [0, 1, 2].map(
              (i) => `project:node:${name}Box${i}`,
            ) as never,
          }),
          ...[0, 1, 2].map((i) => box(`${name}Box${i}`, 300)),
        ]),
        { pageLayout: { direction: "auto", gap: 100, columns: 4 } },
        "desktop",
        "light",
        () => counted.engine,
      );
      counted.takeSolveVisits();
      root.execute(
        setFields({
          targets: [{ kind: "node", id: "project:node:p0Box0" as never }],
          sizing: { height: set(3000) },
        }),
      );
      visits.push(counted.takeSolveVisits());
    }
    // (Each other page: its frame's cell solve — a cache hit — per layout, not its subtree.)
    expect(visits[1]! - visits[0]!).toBeLessThanOrEqual(8 * 3);
  });

  it("consecutive edits on one binding end where a fresh bind does", async () => {
    const root = await grown();
    const roots = root.pageRootRecords();
    const canvas = bindCatalogCanvas(root, roots);
    for (const height of [3000, 1500, 200, 2400]) {
      grow(root, height);
      expect(canvas.update().status).toBe("patched");
      expect(canvas.movePageRoots()).not.toBeNull();
    }
    const patched = boundsOf(canvas);
    canvas.dispose();
    const fresh = bindCatalogCanvas(root, roots);
    expect(patched).toEqual(boundsOf(fresh));
    fresh.dispose();
  });

  it("a moved page that holds a fixed box is recorded again at its new place — no scene bind", async () => {
    // (A fixed box is drawn in its page's layer: the page's subtree cannot be translated.)
    const root = await scene(
      pages.map((name) => page(name)),
      pages.flatMap((name) => [
        body(`${name}Body`, {
          children: [
            `project:node:${name}Box`,
            ...(name === "contact" ? ["project:node:contactBar"] : []),
          ] as never,
        }),
        box(`${name}Box`, 300),
        ...(name === "contact"
          ? [
              {
                ...box("contactBar", 48),
                layout: {
                  position: set("fixed"),
                  insetLeft: set("0px"),
                  insetTop: set("0px"),
                },
              } as NodeEntry,
            ]
          : []),
      ]),
      { pageLayout: { direction: "auto", gap: 100, columns: 2 } },
    );
    const roots = root.pageRootRecords();
    const canvas = bindCatalogCanvas(root, roots);
    for (const height of [3000, 1500]) {
      grow(root, height);
      expect(canvas.update().status).toBe("patched");
      const moved = canvas.movePageRoots();
      // (contact · blog · faq are below Home's row.)
      expect(moved?.length).toBe(3);
    }
    const patched = boundsOf(canvas);
    const nodes = Object.fromEntries(
      Object.keys(patched).map((id) => [id, getSkiaNode(id)]),
    );
    canvas.dispose();
    const fresh = bindCatalogCanvas(root, roots);
    expect(patched).toEqual(boundsOf(fresh));
    for (const [id, data] of Object.entries(nodes))
      expect(data, id).toEqual(getSkiaNode(id));
    fresh.dispose();
  });

  it("records only the page that changed", async () => {
    const root = await grown();
    const canvas = bindCatalogCanvas(root, root.pageRootRecords());
    grow(root, 3000);
    const update = canvas.update();
    expect(update.status).toBe("patched");
    if (update.status !== "patched") return;
    const home = [...root.canvasInputs.values()].find(
      (record) => record.sourceId === "project:node:homeBody",
    )!.id;
    expect(update.patchRoots).toEqual([home]);
    // (The body and its box — not the other four pages' records.)
    expect(update.rebound.length).toBeLessThanOrEqual(2);
    canvas.dispose();
  });
});

/**
 * A page body is two boxes, as Chrome's page is (ledger §body 는 뷰포트가 아니다): the frame (the
 * viewport — its size, its clip and scroll) and the body's content, `min-height` the frame, growing
 * with its children. A vertical flex body taller than the frame no longer squeezes its children
 * (user 2026-11-13: Accordion · ListBox · Icon shrank in a `flex column` + gap body).
 */
describe("page body = viewport frame + growing content", () => {
  const tall = (id: string, patch: Partial<NodeEntry> = {}): NodeEntry => ({
    ...body(id),
    sizing: { height: set(400) },
    // (Chrome: a scroll container's automatic minimum size is 0 — it is the one a definite
    // column flex body squeezes to nothing.)
    visual: { overflow: set("hidden") },
    ...patch,
  });
  const flexBody = (patch: Partial<NodeEntry> = {}) =>
    body("homeBody", {
      children: ["project:node:a", "project:node:b", "project:node:c"],
      layout: {
        display: set("flex"),
        flexDirection: set("column"),
        rowGap: set("24px"),
      },
      ...patch,
    });
  const rectOf = (
    root: Awaited<ReturnType<typeof scene>>,
    sourceId: string,
  ) => {
    const record = [...root.canvasInputs.values()].find(
      (item) => item.sourceId === sourceId,
    )!;
    return root.getGeometry([record.id]).get(record.id)!;
  };

  it("keeps a column flex body's children at their size past the page; the frame grows with them", async () => {
    const root = await scene(
      [page("home"), page("about")],
      [flexBody(), tall("a"), tall("b"), tall("c"), body("aboutBody")],
      { pageLayout: { direction: "vertical", gap: 100 } },
    );
    // 3 × 400 + 2 × 24 = 1248 > 1080: Chrome's body grows, no child shrinks.
    expect(rectOf(root, "project:node:a").height).toBe(400);
    expect(rectOf(root, "project:node:b")).toMatchObject({
      y: 424,
      height: 400,
    });
    expect(rectOf(root, "project:node:c")).toMatchObject({
      y: 848,
      height: 400,
    });
    // The frame is the body as Publish draws it (Height auto — user 2026-11-13): it grows with
    // the content, and the next page is placed below it.
    const frames = root.pageFrameRects();
    expect(frames.get("project:page:home")).toMatchObject({
      height: 1248,
      width: 1920,
    });
    expect(frames.get("project:page:about")?.y).toBe(1348);
  });

  it("fills the frame with a short body (min-height): flex-grow and centering still see the page", async () => {
    const root = await scene(
      [page("home")],
      [
        flexBody({
          children: ["project:node:a"],
          layout: {
            display: set("flex"),
            flexDirection: set("column"),
            justifyContent: set("center"),
          },
        }),
        tall("a", { visual: {} }),
      ],
      {},
    );
    expect(rectOf(root, "project:node:a").y).toBe(340);
  });

  it("takes an authored min-height as the frame's height", async () => {
    const root = await scene(
      [page("home")],
      [
        flexBody({ sizing: { minHeight: set(1500) } }),
        ...["a", "b", "c"].map((id) => tall(id)),
      ],
      {},
    );
    expect(root.pageFrameRects().get("project:page:home")?.height).toBe(1500);
    expect(rectOf(root, "project:node:c").height).toBe(400);
  });

  it("keeps an authored height fixed (the author's choice): its frame, its column", async () => {
    const root = await scene(
      [page("home")],
      [
        flexBody({ sizing: { height: set(600) } }),
        // (An authored Height does not shrink unless the author lets it — `catalogFixedMainShrink`.)
        ...["a", "b", "c"].map((id) =>
          tall(id, { layout: { flexShrink: set("1") } }),
        ),
      ],
      {},
    );
    expect(root.pageFrameRects().get("project:page:home")?.height).toBe(600);
    // (Chrome: a definite column squeezes its scroll-container items.)
    expect(rectOf(root, "project:node:a").height).toBeLessThan(400);
  });
});

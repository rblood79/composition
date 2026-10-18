import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { createPage } from "../../../../../../packages/shared/src/catalog/commands";
import {
  catalogPageLayoutCommand,
  catalogPageLayoutView,
} from "../pageLayoutSettings";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 4e Settings page grid over the catalog document (ADR-232): gap, columns (a number or
 * "auto"), direction and a tier override are the project's `pageLayout` declaration, each edit one
 * step. `columns: "auto"` lays the pages out in the column count the monitor fits at the grid's
 * fit zoom (ADR-274) — the root derives it, so a breakpoint switch or an edit lays out once.
 */
async function open(screenWidth?: number) {
  const engine = await nodeLayoutEngine();
  let layouts = 0;
  const compute = engine.computeLayout.bind(engine);
  engine.computeLayout = (...args) => {
    layouts += 1;
    return compute(...args);
  };
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:grid" as EntryId<"project">,
        name: "Grid",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-4e-grid-${Math.random()}`),
    {
      engine,
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
      ...(screenWidth ? { root: { screenWidth } } : {}),
    },
  );
  for (const name of ["two", "three"])
    workspace.execute(
      createPage({
        page: {
          kind: "page",
          id: `project:page:${name}` as EntryId<"page">,
          route: `/${name}`,
          name,
          children: [`project:node:${name}-body` as NodeId],
        },
        entries: [
          {
            kind: "node",
            id: `project:node:${name}-body` as NodeId,
            definitionId: "lib:definition:type-body",
            children: [],
            props: {},
            visual: {},
            sizing: {},
            descendantOverrides: [],
          } as NodeEntry,
        ],
      }),
    );
  const layout = () => {
    const project = workspace.runtime.graph.getEntry(
      workspace.runtime.graph.projectId,
    );
    return project?.kind === "project" ? project.pageLayout : undefined;
  };
  const edit = (
    breakpoint: "desktop" | "tablet",
    change: Parameters<typeof catalogPageLayoutCommand>[2],
  ) => workspace.execute(catalogPageLayoutCommand(layout(), breakpoint, change));
  const rows = () =>
    new Set([...workspace.root.pageFrameRects().values()].map((r) => r.y)).size;
  const columns = () =>
    new Set([...workspace.root.pageFrameRects().values()].map((r) => r.x)).size;
  const counted = (run: () => void) => {
    const before = layouts;
    run();
    return layouts - before;
  };
  return { workspace, layout, edit, rows, columns, counted };
}

describe("ADR-248 4e page grid settings", () => {
  it("gap, columns, direction and a tier override write the project's pageLayout", async () => {
    const { workspace, layout, edit } = await open();
    expect(catalogPageLayoutView(undefined, "desktop")).toMatchObject({
      direction: "auto",
      columns: "auto",
      tierOverrideAvailable: false,
    });
    edit("desktop", { kind: "gap", gap: 120 });
    edit("desktop", { kind: "columns", columns: 3 });
    expect(layout()).toEqual({ gap: 120, columns: 3 });
    expect(workspace.runtime.historyLabels.undo.at(-1)).toBe("Page layout");
    edit("tablet", { kind: "tierOverride", enabled: true });
    expect(layout()?.breakpoints).toEqual({ tablet: { gap: 120, columns: 3 } });
    expect(catalogPageLayoutView(layout(), "tablet").hasTierOverride).toBe(true);
    edit("tablet", { kind: "columns", columns: "auto" });
    expect(layout()).toEqual({
      gap: 120,
      columns: 3,
      breakpoints: { tablet: { gap: 120, columns: "auto" } },
    });
    expect(catalogPageLayoutView(layout(), "tablet").columns).toBe("auto");
    expect(catalogPageLayoutView(layout(), "desktop").columns).toBe(3);
    edit("tablet", { kind: "tierOverride", enabled: false });
    edit("desktop", { kind: "direction", direction: "vertical" });
    expect(layout()).toEqual({ gap: 120, columns: 3, direction: "vertical" });
    workspace.undo();
    expect(layout()?.direction).toBeUndefined();
  });

  it("columns auto: the monitor width and fit zoom lay the pages out (no camera zoom input)", async () => {
    // 1920 · 40 % · gap 80: Desktop 2 columns (hand table) — three pages in two rows.
    const { workspace, rows, columns } = await open(1920);
    const layout = workspace.root.pageLayout();
    expect(layout.columnsAuto).toBe(true);
    expect(layout).toMatchObject({ columns: 2, autoFitZoom: 40 });
    expect(rows()).toBe(2);
    // The same monitor again (the Canvas checks every frame): nothing moves.
    expect(workspace.setScreenWidth(1920)).toBe(false);
    // Another monitor: 2560 → 3 columns, one row.
    expect(workspace.setScreenWidth(2560)).toBe(true);
    expect(rows()).toBe(1);
    // A wider monitor with the same count lays nothing out.
    expect(workspace.setScreenWidth(2600)).toBe(false);
    expect(workspace.setScreenWidth(1440)).toBe(true);
    expect(columns()).toBe(1);
    expect(rows()).toBe(3);
  });

  it("a breakpoint switch derives the new tier's columns in its one layout (ADR-274 F5)", async () => {
    const { workspace, columns, counted } = await open(1440);
    expect(columns()).toBe(1);
    // Tablet at 1440 · 40 %: 4 columns — the new root already has them.
    workspace.setBreakpoint("tablet");
    expect(workspace.root.pageLayout().columns).toBe(4);
    expect(columns()).toBe(3);
    // The Canvas's next frame check: no second pass.
    expect(counted(() => workspace.setScreenWidth(1440))).toBe(0);
    // Moved to a 2560 monitor, then Mobile: the new root takes the current monitor (13 columns),
    // not the one the workspace opened on.
    workspace.setScreenWidth(2560);
    workspace.setBreakpoint("mobile");
    expect(workspace.root.pageLayout().columns).toBe(13);
    expect(counted(() => workspace.setScreenWidth(2560))).toBe(0);
  });

  it("gap and fit zoom edits change the auto count in the edit's own step (ADR-274 F6)", async () => {
    const { workspace, layout, edit, rows, counted } = await open(1920);
    expect(rows()).toBe(2);
    // 1920 · 40 % · gap 0 → floor(4800 / 1920) = 2; at 20 % → floor(9600 / 2000) = 4 → one row.
    edit("desktop", { kind: "autoFitZoom", percent: 20 });
    expect(layout()).toEqual({ columns: "auto", autoFitZoom: 20 });
    expect(workspace.root.pageLayout().columns).toBe(4);
    expect(rows()).toBe(1);
    expect(counted(() => workspace.setScreenWidth(1920))).toBe(0);
    // gap 2000 at 20 %: floor((9600 + 2000) / 3920) = 2 → two rows, still within the edit.
    edit("desktop", { kind: "gap", gap: 2000 });
    expect(workspace.root.pageLayout().columns).toBe(2);
    expect(rows()).toBe(2);
    expect(counted(() => workspace.setScreenWidth(1920))).toBe(0);
    workspace.undo();
    workspace.undo();
    expect(layout()).toBeUndefined();
    expect(workspace.root.pageLayout().columns).toBe(2);
  });

  it("the fit zoom is breakpoint-wide and clamps to 10 ~ 100 % (user decisions 1 · 2)", async () => {
    const { layout, edit } = await open(2560);
    edit("tablet", { kind: "tierOverride", enabled: true });
    edit("tablet", { kind: "autoFitZoom", percent: 5 });
    expect(layout()).toEqual({
      autoFitZoom: 10,
      breakpoints: { tablet: { gap: 80, columns: "auto" } },
    });
    expect(catalogPageLayoutView(layout(), "desktop").autoFitZoom).toBe(10);
    edit("desktop", { kind: "autoFitZoom", percent: 140.4 });
    expect(layout()?.autoFitZoom).toBe(100);
    // A fixed count keeps the zoom (switching back to auto restores it).
    edit("desktop", { kind: "columns", columns: 3 });
    expect(catalogPageLayoutView(layout(), "desktop")).toMatchObject({
      columns: 3,
      autoFitZoom: 100,
    });
  });
});

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
  catalogAutoColumns,
  catalogPageLayoutCommand,
  catalogPageLayoutView,
} from "../pageLayoutSettings";
import { __resetAutoColumns } from "../../workspace/canvas/scene/pagePlacement";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 4e Settings page grid over the catalog document (ADR-232): gap, columns (a number or
 * "auto"), direction and a tier override are the project's `pageLayout` declaration, each edit one
 * step. `columns: "auto"` lays the pages out in the column count the Canvas fits — kept across a
 * breakpoint switch.
 */
async function open() {
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
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
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
  return { workspace, layout, edit, rows };
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

  it("columns auto: the Canvas's fitted count lays the pages out and survives a breakpoint switch", async () => {
    const { workspace, rows } = await open();
    const layout = workspace.root.pageLayout();
    expect(layout.columnsAuto).toBe(true);
    const width = (columns: number) =>
      columns * layout.trackWidth + (columns - 1) * layout.gap;
    expect(catalogAutoColumns(workspace.root, width(1), 1)).toBe(1);
    expect(catalogAutoColumns(workspace.root, width(3), 1)).toBe(3);
    // Zoomed out to half, the same screen width holds twice the page grid.
    expect(catalogAutoColumns(workspace.root, width(6) * 0.5, 0.5)).toBe(6);
    workspace.setAutoColumns(1);
    expect(rows()).toBe(3);
    expect(workspace.setAutoColumns(3)).toBe(true);
    expect(rows()).toBe(1);
    expect(workspace.setAutoColumns(3)).toBe(false);
    workspace.setAutoColumns(2);
    expect(rows()).toBe(2);
    // The new root of a breakpoint switch takes the count (not a leftover module value).
    __resetAutoColumns();
    workspace.setBreakpoint("tablet");
    expect(rows()).toBe(2);
  });
});

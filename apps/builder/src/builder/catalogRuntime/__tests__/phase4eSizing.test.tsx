import "fake-indexeddb/auto";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  setFillSizing,
} from "../../../../../../packages/shared/src/catalog/commands";
import { createCatalogStylesHost } from "../../panels/styles/catalog/catalogStylesHost";
import { newCatalogProjectDocument } from "../project";
import { CatalogWorkspaceProvider } from "../react";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 Phase 4e-4d-3 Size: the Size section's axis edits (fill with a weight, a CSS length,
 * reset) and the Ratio control as catalog field writes at the session breakpoint, each one step;
 * the size-mode reads (fill intent, parent layout, measured box) come from the catalog records.
 */
const BODY = "project:node:home-body" as NodeId;
const ROW = "project:node:row" as NodeId;
const BOX = "project:node:box" as NodeId;

const frame = (id: NodeId, extra: Partial<NodeEntry> = {}): NodeEntry => ({
  kind: "node",
  id,
  definitionId: "lib:definition:type-frame",
  children: [],
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
  ...extra,
});

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:sizing" as EntryId<"project">,
        name: "Sizing",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-phase4e-sizing-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        frame(ROW, {
          children: [BOX],
          layout: {
            display: { kind: "set", value: "flex" },
            flexDirection: { kind: "set", value: "column" },
          },
          sizing: {
            width: { kind: "set", value: 400 },
            height: { kind: "set", value: 300 },
          },
        }),
        frame(BOX, {
          sizing: {
            width: { kind: "set", value: 200 },
            height: { kind: "set", value: 100 },
          },
        }),
      ],
      rootIds: [ROW],
      newId: workspace.newId,
    }),
  );
  const record = workspace.root.recordsOfSource(BOX)[0];
  workspace.selectRecords([record]);
  const graph = workspace.runtime.graph;
  return {
    workspace,
    graph,
    record,
    node: () => graph.getEntry(BOX) as NodeEntry,
    host: createCatalogStylesHost(workspace),
  };
}

describe("ADR-248 Phase 4e-4d-3 Size", () => {
  it("setFillSizing writes the base value or a breakpoint layer's, and drops empty layers", async () => {
    const { workspace, node } = await open();
    const target = { kind: "node" as const, id: BOX };
    workspace.execute(
      setFillSizing({ targets: [target], axis: "width", value: { factor: 2 } }),
    );
    expect(node().fillSizing).toEqual({ width: { factor: 2 } });
    workspace.execute(
      setFillSizing({
        targets: [target],
        breakpoint: "tablet",
        axis: "width",
        value: null,
      }),
    );
    expect(node().fillSizing).toEqual({ width: { factor: 2 } });
    expect(node().responsive?.tablet?.fillSizing).toEqual({ width: null });
    workspace.execute(
      setFillSizing({
        targets: [target],
        breakpoint: "tablet",
        axis: "width",
        value: undefined,
      }),
    );
    expect(node().responsive).toBe(undefined);
    workspace.execute(
      setFillSizing({ targets: [target], axis: "width", value: undefined }),
    );
    expect(node().fillSizing).toBe(undefined);
  });

  it("an axis edit is one step: px = sizing, fill = the fill intent, reset clears the layer", async () => {
    const { workspace, graph, node, host, record } = await open();
    const revision = graph.revision;
    host.applySizing(record, { axis: "width", mode: "fill" });
    expect(graph.revision).toBe(revision + 1);
    expect(node().fillSizing).toEqual({ width: { factor: 1 } });
    expect(node().sizing.width).toBe(undefined);
    // The column parent stretches a fill width across its content box.
    expect(workspace.root.getGeometry([record]).get(record)?.width).toBe(400);

    host.applySizing(record, { axis: "width", mode: "fill", factor: 3 });
    expect(node().fillSizing).toEqual({ width: { factor: 3 } });

    host.applySizing(record, { axis: "width", mode: "css", value: "120px" });
    expect(node().fillSizing).toBe(undefined);
    expect(node().sizing.width).toEqual({ kind: "set", value: 120 });
    expect(workspace.root.getGeometry([record]).get(record)?.width).toBe(120);

    host.applySizing(record, {
      axis: "height",
      mode: "css",
      value: "fit-content",
    });
    expect(node().visual.height).toEqual({ kind: "set", value: "fit-content" });
    expect(node().sizing.height).toBe(undefined);

    host.applySizing(record, { axis: "width", mode: "reset" });
    expect(node().sizing.width).toBe(undefined);
    expect(node().visual.width).toBe(undefined);

    workspace.undo();
    expect(node().sizing.width).toEqual({ kind: "set", value: 120 });
    // A stale selection id is ignored.
    const before = graph.revision;
    host.applySizing("other", { axis: "width", mode: "fill" });
    expect(graph.revision).toBe(before);
  });

  it("a breakpoint edit writes that layer and releases an inherited fill with null", async () => {
    const { workspace, node, host, record } = await open();
    host.applySizing(record, { axis: "width", mode: "fill" });
    workspace.setBreakpoint("tablet");
    const tabletRecord = workspace.session.getSnapshot().selection[0].identity;
    host.applySizing(tabletRecord, {
      axis: "width",
      mode: "css",
      value: "150px",
    });
    expect(node().fillSizing).toEqual({ width: { factor: 1 } });
    expect(node().responsive?.tablet?.fillSizing).toEqual({ width: null });
    expect(node().responsive?.tablet?.sizing?.width).toEqual({
      kind: "set",
      value: 150,
    });
    expect(
      workspace.root.getGeometry([tabletRecord]).get(tabletRecord)?.width,
    ).toBe(150);
  });

  it("Ratio: a preset drops the height, null locks the measured ratio, unlock fixes the measured height", async () => {
    const { workspace, node, host, record } = await open();
    expect(host.applyRatio(record, null)).toBe(null);
    expect(node().visual.aspectRatio).toEqual({
      kind: "set",
      value: "200 / 100",
    });
    expect(node().sizing.height).toBe(undefined);
    expect(workspace.root.getGeometry([record]).get(record)?.height).toBe(100);

    expect(host.applyRatio(record, "1 / 1")).toBe(null);
    expect(node().visual.aspectRatio).toEqual({ kind: "set", value: "1 / 1" });
    expect(workspace.root.getGeometry([record]).get(record)?.height).toBe(200);

    expect(host.applyRatio(record, "")).toBe(null);
    expect(node().visual.aspectRatio).toBe(undefined);
    expect(node().sizing.height).toEqual({ kind: "set", value: 200 });

    // A height fill would keep the height independent (no dependent axis): locking drops it.
    host.applySizing(record, { axis: "height", mode: "fill" });
    expect(workspace.root.getGeometry([record]).get(record)?.height).toBe(300);
    expect(host.applyRatio(record, "1 / 1")).toBe(null);
    expect(node().fillSizing).toBe(undefined);
    expect(workspace.root.getGeometry([record]).get(record)?.height).toBe(200);

    workspace.setBreakpoint("tablet");
    const tabletRecord = workspace.session.getSnapshot().selection[0].identity;
    host.applyRatio(tabletRecord, "1 / 1");
    expect(host.applyRatio(tabletRecord, "")).toBe("tier-geometry-missing");
    expect(host.applyRatio("other", "1 / 1")).toBe("selection-changed");
  });

  it("size-mode reads: the fill intent, the parent's layout and the measured box", async () => {
    const { workspace, host, record } = await open();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <CatalogWorkspaceProvider workspace={workspace}>
        {children}
      </CatalogWorkspaceProvider>
    );
    const { result, rerender } = renderHook(
      () => ({
        context: host.useElementStyleContext(record),
        parentId: host.useParentId(record),
        parent: host.useParentLayout(record),
        width: host.useLayoutValue(record, "width"),
      }),
      { wrapper },
    );
    expect(result.current.parentId).toBe(
      workspace.root.recordsOfSource(ROW)[0],
    );
    expect(result.current.parent).toEqual({
      display: "flex",
      flexDirection: "column",
    });
    expect(result.current.width).toBe(200);
    expect(result.current.context.sizing).toBe(undefined);
    host.applySizing(record, { axis: "width", mode: "fill", factor: 2 });
    rerender();
    expect(result.current.context.sizing).toEqual({ width: { factor: 2 } });
    expect(result.current.width).toBe(400);
  });
});

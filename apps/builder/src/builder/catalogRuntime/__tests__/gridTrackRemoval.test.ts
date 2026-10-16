import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { createCatalogStylesHost } from "../../panels/styles/catalog/catalogStylesHost";
import { gridLinesAfterTrackRemoval } from "../gridTrackEdit";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * Figma grid (2026-10-16 「다음 단계」): removing a column · row moves the objects in it to the
 * nearest cells and shrinks the spans across it — the pinned items keep their cells (the ones past
 * it shift back by one), the removed track's items join the flow there.
 */
describe("grid lines after a track removal", () => {
  it("a start past the removed tracks shifts back; a span across them shrinks; an item only in them is unpinned", () => {
    // Pinned at column 3 (index 2), one cell: removing column 1 → column 2.
    expect(gridLinesAfterTrackRemoval({ start: "3" }, [0])).toEqual({
      start: 2,
    });
    // Pinned at column 1 spanning 3: removing column 2 → span 2.
    expect(
      gridLinesAfterTrackRemoval({ start: "1", end: "span 3" }, [1]),
    ).toEqual({ span: 2 });
    // Spanning 2 → 1: the span goes.
    expect(
      gridLinesAfterTrackRemoval({ start: "2", end: "span 2" }, [2]),
    ).toEqual({ span: null });
    // Only in the removed column: unpinned on that axis (the flow places it in a free cell).
    expect(gridLinesAfterTrackRemoval({ start: "2" }, [1])).toEqual({
      start: null,
    });
    expect(
      gridLinesAfterTrackRemoval({ start: "2", end: "span 2" }, [1, 2]),
    ).toEqual({ start: null, span: null });
    // Before the removed tracks, or not pinned: nothing.
    expect(gridLinesAfterTrackRemoval({ start: "1" }, [2])).toBeUndefined();
    expect(gridLinesAfterTrackRemoval({}, [0])).toBeUndefined();
  });
});

const BODY = "project:node:home-body" as NodeId;
const GRID = "project:node:grid" as NodeId;
const id = (name: string) => `project:node:${name}` as NodeId;
const frame = (node: NodeId, extra: Partial<NodeEntry> = {}): NodeEntry => ({
  kind: "node",
  id: node,
  definitionId: "lib:definition:type-frame",
  children: [],
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
  ...extra,
});
const lines = (column?: string, columnEnd?: string) => ({
  ...(column
    ? { gridColumnStart: { kind: "set" as const, value: column } }
    : {}),
  ...(columnEnd
    ? { gridColumnEnd: { kind: "set" as const, value: columnEnd } }
    : {}),
  gridRowStart: { kind: "set" as const, value: "1" },
});

describe("the 열 절 「−」 (host): one step for the template and the items", () => {
  it("removing column 2 of 4 shifts, shrinks and unpins the items, as one history step", async () => {
    const workspace = new CatalogWorkspace(
      new CatalogGraph(
        newCatalogProjectDocument({
          projectId: "project:project:tracks" as EntryId<"project">,
          name: "Tracks",
        }),
        await buildCodeCatalogLibrary(),
      ),
      new CatalogStorage(indexedDB, `grid-track-removal-${Math.random()}`),
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
          frame(GRID, {
            children: [id("a"), id("b"), id("c")],
            layout: {
              display: { kind: "set", value: "grid" },
              gridTemplateColumns: {
                kind: "set",
                value: "repeat(4, minmax(0, 1fr))",
              },
              gridTemplateRows: {
                kind: "set",
                value: "repeat(2, minmax(0, 1fr))",
              },
            },
            sizing: {
              width: { kind: "set", value: 400 },
              height: { kind: "set", value: 200 },
            },
          }),
          // a: columns 1–3 · b: column 2 only · c: column 4
          frame(id("a"), { layout: lines("1", "span 3") }),
          frame(id("b"), {
            layout: {
              ...lines("2"),
              gridRowStart: { kind: "set", value: "2" },
            },
          }),
          frame(id("c"), {
            layout: {
              ...lines("4"),
              gridRowStart: { kind: "set", value: "2" },
            },
          }),
        ],
        rootIds: [GRID],
        newId: workspace.newId,
      }),
    );
    const grid = workspace.root.recordsOfSource(GRID)[0]!;
    workspace.selectRecords([grid]);
    const host = createCatalogStylesHost(workspace);
    const graph = workspace.runtime.graph;
    const layoutOf = (name: string) => {
      const layout = (graph.getEntry(id(name)) as NodeEntry).layout ?? {};
      const value = (write: unknown) =>
        (write as { value?: string } | undefined)?.value;
      return [value(layout.gridColumnStart), value(layout.gridColumnEnd)];
    };
    const depth = workspace.runtime.historyDepth.undo;
    host.applyGridTracks?.(grid, [
      { axis: "column", template: "repeat(3, minmax(0, 1fr))", removed: [1] },
    ]);
    expect(workspace.runtime.historyDepth.undo).toBe(depth + 1);
    expect(
      (
        (graph.getEntry(GRID) as NodeEntry).layout?.gridTemplateColumns as {
          value: string;
        }
      ).value,
    ).toBe("repeat(3, minmax(0, 1fr))");
    expect(layoutOf("a")).toEqual(["1", "span 2"]);
    expect(layoutOf("b")).toEqual([undefined, undefined]);
    expect(layoutOf("c")).toEqual(["3", undefined]);
    // b joins the flow in its row (row 2): the first free column.
    const b = workspace.root.recordsOfSource(id("b"))[0]!;
    const box = workspace.root.getGeometry([b]).get(b)!;
    expect(box.y).toBeGreaterThanOrEqual(100);
    await workspace.undo();
    expect(layoutOf("b")).toEqual(["2", undefined]);

    // The grid picker (P23) sets both axes: one step for the columns, the rows and the items.
    const depth2 = workspace.runtime.historyDepth.undo;
    host.applyGridTracks?.(grid, [
      {
        axis: "column",
        template: "repeat(2, minmax(0, 1fr))",
        removed: [2, 3],
      },
      { axis: "row", template: "minmax(0, 1fr)", removed: [1] },
    ]);
    expect(workspace.runtime.historyDepth.undo).toBe(depth2 + 1);
    const rowOf = (name: string) =>
      (
        (graph.getEntry(id(name)) as NodeEntry).layout?.gridRowStart as
          { value?: string } | undefined
      )?.value;
    expect(layoutOf("a")).toEqual(["1", "span 2"]);
    expect([...layoutOf("b"), rowOf("b")]).toEqual(["2", undefined, undefined]);
    expect([...layoutOf("c"), rowOf("c")]).toEqual([
      undefined,
      undefined,
      undefined,
    ]);

    // A track reorder (Canvas header drag, P24): column 4 first — the pinned items follow.
    await workspace.undo();
    host.applyGridTracks?.(grid, [
      {
        axis: "column",
        template: "repeat(4, minmax(0, 1fr))",
        removed: [],
        order: [3, 0, 1, 2],
      },
    ]);
    expect(layoutOf("c")).toEqual(["1", undefined]);
    expect(layoutOf("a")).toEqual(["2", "span 3"]);
    expect(layoutOf("b")).toEqual(["3", undefined]);
    // A track delete (Layout 「−」 · Canvas Delete — Figma): what is only in it is deleted, a span
    // across it shrinks, the ones past it shift back.
    await workspace.undo();
    host.applyGridTracks?.(grid, [
      {
        axis: "column",
        template: "repeat(3, minmax(0, 1fr))",
        removed: [1],
        deleteContents: true,
      },
    ]);
    expect(graph.getEntry(id("b"))).toBeUndefined();
    expect(layoutOf("a")).toEqual(["1", "span 2"]);
    expect(layoutOf("c")).toEqual(["3", undefined]);
    await workspace.undo();
    expect(graph.getEntry(id("b"))).toBeDefined();
    // A column to Hug (Figma): b, filling column 2, keeps its drawn width (100) as a fixed width —
    // one step with the template; a (spans 3) and c (column 4) are not in it.
    const depth5 = workspace.runtime.historyDepth.undo;
    host.applyGridTracks?.(grid, [
      {
        axis: "column",
        template: "minmax(0, 1fr) auto minmax(0, 1fr) minmax(0, 1fr)",
        removed: [],
        hugged: [1],
      },
    ]);
    expect(workspace.runtime.historyDepth.undo).toBe(depth5 + 1);
    const widthOf = (name: string) =>
      (
        (graph.getEntry(id(name)) as NodeEntry).sizing?.width as
          { value?: number } | undefined
      )?.value;
    expect([widthOf("a"), widthOf("b"), widthOf("c")]).toEqual([
      undefined,
      100,
      undefined,
    ]);
    expect(workspace.root.getGeometry([b]).get(b)!.width).toBe(100);
  });
});

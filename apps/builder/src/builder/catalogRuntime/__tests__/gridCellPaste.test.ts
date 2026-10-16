import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  copyNodes,
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { catalogGridCellPasteCommand } from "../gridCellPaste";
import { createCatalogStylesHost } from "../../panels/styles/catalog/catalogStylesHost";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * Paste into a selected grid cell (Figma — 2026-10-16 사용자 「남은 차이 전부 맞춰」): the copy goes
 * into the grid, pinned to the cell, in one step.
 */
const BODY = "project:node:home-body" as NodeId;
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
const at = (column: string, row: string) => ({
  gridColumnStart: { kind: "set" as const, value: column },
  gridRowStart: { kind: "set" as const, value: row },
});

async function open(rows?: string) {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:cell-paste" as EntryId<"project">,
        name: "Cell paste",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `grid-cell-paste-${Math.random()}`),
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
        frame(id("grid"), {
          children: [id("a"), id("b"), id("c")],
          layout: {
            display: { kind: "set", value: "grid" },
            gridTemplateColumns: {
              kind: "set",
              value: "repeat(2, minmax(0, 1fr))",
            },
            ...(rows ? { gridTemplateRows: { kind: "set", value: rows } } : {}),
          },
        }),
        frame(id("a"), { layout: at("1", "1") }),
        frame(id("b"), { layout: at("1", "2") }),
        frame(id("c"), { layout: at("2", "3") }),
      ],
      rootIds: [id("grid")],
      newId: workspace.newId,
    }),
  );
  const rowOf = (name: string) =>
    (
      (workspace.runtime.graph.getEntry(id(name)) as NodeEntry).layout
        ?.gridRowStart as { value?: string } | undefined
    )?.value;
  return { workspace, rowOf };
}

describe("paste into a selected grid cell (Figma)", () => {
  it("the copy is the grid's child pinned to the cell — one step", async () => {
    const { workspace } = await open("repeat(3, minmax(0, 1fr))");
    const graph = workspace.runtime.graph;
    const depth = workspace.runtime.historyDepth.undo;
    const command = catalogGridCellPasteCommand({
      graph,
      target: { kind: "node", id: id("grid") },
      clipboard: copyNodes(graph, [id("a")]),
      newId: workspace.newId,
      breakpoint: "desktop",
      cell: { column: 1, row: 1 },
    });
    expect(command).toBeDefined();
    workspace.execute(command!);
    expect(workspace.runtime.historyDepth.undo).toBe(depth + 1);
    const grid = graph.getEntry(id("grid")) as NodeEntry;
    expect(grid.children).toHaveLength(4);
    const pasted = graph.getEntry(grid.children[3]!) as NodeEntry;
    expect(pasted.layout?.gridColumnStart).toEqual({ kind: "set", value: "2" });
    expect(pasted.layout?.gridRowStart).toEqual({ kind: "set", value: "2" });
  });
});

describe("an empty track to Hug keeps its size (Figma)", () => {
  it("its drawn size becomes its minimum — not 0", async () => {
    const { workspace } = await open("repeat(4, minmax(0, 1fr))");
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id("grid") }],
        sizing: { height: { kind: "set", value: 400 } },
      }),
    );
    const grid = workspace.root.recordsOfSource(id("grid"))[0]!;
    workspace.selectRecords([grid]);
    const host = createCatalogStylesHost(workspace);
    // Row 4 has no item: 100 px drawn.
    host.applyGridTracks?.(grid, [
      {
        axis: "row",
        template:
          "minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) auto",
        removed: [],
        hugged: [3],
      },
    ]);
    const rows = (
      (workspace.runtime.graph.getEntry(id("grid")) as NodeEntry).layout
        ?.gridTemplateRows as { value: string }
    ).value;
    expect(rows).toBe(
      "minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(100px, auto)",
    );
  });
});

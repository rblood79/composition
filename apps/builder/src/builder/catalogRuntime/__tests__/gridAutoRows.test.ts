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
  insertNodes,
  removeTargets,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * Rows 「자동」 (Figma — 2026-10-16 사용자 결정): a grid with no row template has no empty rows —
 * a step that leaves one (a delete, a pin further down) closes it in the same step.
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
        projectId: "project:project:auto-rows" as EntryId<"project">,
        name: "Auto rows",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `grid-auto-rows-${Math.random()}`),
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

describe("Rows Auto closes the empty rows (Figma)", () => {
  it("deleting the only item of a row: the items below move up, one step", async () => {
    const { workspace, rowOf } = await open();
    expect([rowOf("a"), rowOf("b"), rowOf("c")]).toEqual(["1", "2", "3"]);
    const depth = workspace.runtime.historyDepth.undo;
    workspace.execute(
      removeTargets({ targets: [{ kind: "node", id: id("b") }] }),
    );
    expect(workspace.runtime.historyDepth.undo).toBe(depth + 1);
    expect(rowOf("c")).toBe("2");
    await workspace.undo();
    expect([rowOf("b"), rowOf("c")]).toEqual(["2", "3"]);
  });

  it("a pin past an empty row closes it; a middle row emptied by a move closes too", async () => {
    const { workspace, rowOf } = await open();
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id("c") }],
        layout: { gridRowStart: { kind: "set", value: "6" } },
      }),
    );
    expect(rowOf("c")).toBe("3");
    // b to row 1 (beside a): row 2 empties, c goes up to 2.
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id("b") }],
        layout: at("2", "1"),
      }),
    );
    expect([rowOf("a"), rowOf("b"), rowOf("c")]).toEqual(["1", "1", "2"]);
  });

  it("a row template (not Auto) keeps its empty rows", async () => {
    const { workspace, rowOf } = await open("repeat(3, minmax(0, 1fr))");
    workspace.execute(
      removeTargets({ targets: [{ kind: "node", id: id("b") }] }),
    );
    expect(rowOf("c")).toBe("3");
  });
});

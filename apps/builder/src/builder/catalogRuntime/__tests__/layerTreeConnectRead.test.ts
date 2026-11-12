import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";
import { CatalogLayerTreeStore, type CatalogLayerNode } from "../layerTree";

/**
 * ADR-246 ratchet 조사 (2026-11-12) — the Layers tree reads its rows when made (the render) and
 * follows the document from `connect` (the effect). Reading again on connect when nothing moved in
 * between doubled each page switch's rows (`33d58176b`); a change in between is still read.
 */
const BODY = "project:node:home-body" as NodeId;
const text = (name: string): NodeEntry =>
  ({
    kind: "node",
    id: `project:node:${name}`,
    definitionId: "lib:definition:text",
    children: [],
    props: { children: { kind: "set", value: name } },
    visual: {},
    sizing: {},
    descendantOverrides: [],
  }) as NodeEntry;

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:layers-connect" as EntryId<"project">,
        name: "Layers connect",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `layers-connect-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  const insert = (name: string) =>
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [text(name)],
        rootIds: [`project:node:${name}` as NodeId],
        newId: workspace.newId,
      }),
    );
  insert("first");
  const pageRows = vi.spyOn(workspace.readModel, "pageRows");
  const tree = () =>
    new CatalogLayerTreeStore(
      {
        readModel: workspace.readModel,
        graph: workspace.runtime.graph,
        subscribeSteps: (listener) =>
          workspace.runtime.subscribeSteps(listener),
        boundRows: (position) => workspace.boundRowsOf(position),
        subscribeBoundRows: (listener) => workspace.subscribeRows(listener),
        subscribeRoot: (listener) => workspace.subscribeRoot(listener),
        inputsVersion: () => workspace.layerInputsVersion,
      },
      workspace.session.getSnapshot().pageId!,
    );
  return { workspace, insert, pageRows, tree };
}

const nodeOf = (row: CatalogLayerNode) =>
  row.position.target.kind === "node" ? row.position.target.id : undefined;

describe("Layers tree — connect reads again only when something moved", () => {
  it("made and connected with nothing in between: one read, and it follows the next step", async () => {
    const { insert, pageRows, tree } = await open();
    const store = tree();
    store.connect();
    expect(pageRows).toHaveBeenCalledTimes(1);
    // (Connected: the row lists are subscribed — the step's insert is read.)
    insert("second");
    const body = store.getSnapshot()[0]!;
    store.setExpanded(new Set([body.id]));
    expect(store.getSnapshot()[0]!.children?.map(nodeOf)).toEqual([
      "project:node:first",
      "project:node:second",
    ]);
  });

  it("a step or a new root between the render and the effect is read on connect", async () => {
    const { workspace, insert, pageRows, tree } = await open();
    const stepped = tree();
    insert("between");
    stepped.connect();
    expect(pageRows).toHaveBeenCalledTimes(2);
    stepped.setExpanded(new Set([stepped.getSnapshot()[0]!.id]));
    expect(
      stepped.getSnapshot()[0]!.children?.map(nodeOf),
    ).toContain("project:node:between");

    pageRows.mockClear();
    const rooted = tree();
    workspace.setBreakpoint("tablet");
    rooted.connect();
    expect(pageRows).toHaveBeenCalledTimes(2);
  });
});

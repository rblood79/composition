import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  EntryKind,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  renameNode,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import {
  catalogLayerDropCommand,
  CatalogLayerTreeStore,
  type CatalogLayerNode,
} from "../layerTree";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 Phase 4e-4 Layers: the tree of a page comes from the read model's rows (a collapsed row
 * reads no further); a leaf edit re-reads only its own child list and keeps every row object; a rename replaces
 * only that row; a drop is one move command over owned nodes (the body stays).
 */
const PROJECT = "project:project:layers" as EntryId<"project">;
const HOME = "project:page:home" as EntryId<"page">;
const BODY = "project:node:home-body" as NodeId;
const id = (name: string) => `project:node:${name}` as NodeId;
const node = (
  name: string,
  definitionId: string,
  children: NodeId[] = [],
): NodeEntry => ({
  kind: "node",
  id: id(name),
  definitionId: definitionId as NodeEntry["definitionId"],
  children,
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
});
const allocator = () => {
  let next = 0;
  return <K extends EntryKind>(kind: K) =>
    `project:${kind}:l${++next}` as EntryId<K>;
};

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({ projectId: PROJECT, name: "Layers" }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-phase4e-layers-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        node("list", "lib:definition:type-frame", [id("a"), id("b"), id("c")]),
        node("a", "lib:definition:text"),
        node("b", "lib:definition:text"),
        node("c", "lib:definition:text"),
        node("box", "lib:definition:type-frame"),
      ],
      rootIds: [id("list"), id("box")],
      newId: allocator(),
    }),
  );
  const tree = new CatalogLayerTreeStore(
    {
      readModel: workspace.readModel,
      graph: workspace.runtime.graph,
      subscribeSteps: (listener) => workspace.runtime.subscribeSteps(listener),
    },
    HOME,
  );
  const record = (name: string) => workspace.root.recordsOfSource(id(name))[0];
  const children = (name: string) => {
    const entry = workspace.runtime.graph.getEntry(id(name));
    return entry?.kind === "node" ? entry.children : [];
  };
  const names = (nodes: readonly CatalogLayerNode[] | undefined) =>
    (nodes ?? []).map((row) => row.name);
  return { workspace, tree, record, children, names };
}

describe("ADR-248 Phase 4e-4 Layers tree", () => {
  it("rows come from the read model; a collapsed row reads only whether it has children", async () => {
    const { tree, record, names } = await open();
    const [body] = tree.getSnapshot();
    // Keys are the drawn record identities (the Canvas selection's keys).
    expect(body).toMatchObject({
      id: record("home-body"),
      body: true,
      hasChildren: true,
      depth: 0,
    });
    expect(body.children).toBeUndefined();

    tree.setExpanded(new Set([record("home-body")]));
    const expandedBody = tree.getSnapshot()[0];
    expect(names(expandedBody.children)).toEqual(["frame", "frame"]);
    const list = expandedBody.children![0];
    expect(list).toMatchObject({
      id: record("list"),
      parentId: record("home-body"),
      depth: 1,
      hasChildren: true,
    });
    expect(list.children).toBeUndefined();
    expect(expandedBody.children![1].hasChildren).toBe(false);

    tree.setExpanded(new Set([record("home-body"), record("list")]));
    expect(
      tree.getSnapshot()[0].children![0].children!.map((row) => row.id),
    ).toEqual([record("a"), record("b"), record("c")]);
  });

  it("a leaf edit re-reads no row list and keeps every row; a rename replaces only its row; an insert shows", async () => {
    const { workspace, tree, record, names } = await open();
    tree.setExpanded(new Set([record("home-body"), record("list")]));
    const before = tree.getSnapshot();
    let notified = 0;
    tree.subscribe(() => notified++);
    const rows = workspace.readModel.stats.rows;

    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id("b") }],
        props: { children: { kind: "set", value: "Edited" } },
      }),
    );
    // Only the edited leaf's own (empty) child list is read again — not its siblings' list.
    expect(workspace.readModel.stats.rows).toBe(rows + 1);
    expect(notified).toBe(0);
    expect(tree.getSnapshot()).toBe(before);

    workspace.execute(renameNode({ id: id("b"), name: "Second" }));
    expect(notified).toBe(1);
    const list = tree.getSnapshot()[0].children![0];
    const beforeList = before[0].children![0];
    expect(names(list.children)).toEqual(["Text", "Second", "Text"]);
    expect(list.children![0]).toBe(beforeList.children![0]);
    expect(list.children![2]).toBe(beforeList.children![2]);
    expect(tree.getSnapshot()[0].children![1]).toBe(before[0].children![1]);

    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: id("box") },
        entries: [node("d", "lib:definition:text")],
        rootIds: [id("d")],
        newId: allocator(),
      }),
    );
    expect(tree.getSnapshot()[0].children![1].hasChildren).toBe(true);
  });

  it("a drop is one move over owned nodes; the body and a drop outside the page body are refused", async () => {
    const { workspace, tree, record, children } = await open();
    tree.setExpanded(new Set([record("home-body"), record("list")]));
    const drop = (
      dragged: string[],
      target: string,
      position: "before" | "after" | "on",
    ) =>
      catalogLayerDropCommand(
        tree,
        dragged.map(record),
        record(target),
        position,
        workspace.newId,
      );

    const revision = workspace.runtime.graph.revision;
    workspace.execute(drop(["c"], "a", "before")!);
    expect(children("list")).toEqual([id("c"), id("a"), id("b")]);
    expect(workspace.runtime.graph.revision).toBe(revision + 1);
    workspace.execute(drop(["c"], "b", "after")!);
    expect(children("list")).toEqual([id("a"), id("b"), id("c")]);
    // On a (collapsed) row: into it, at its end.
    workspace.execute(drop(["a", "b"], "box", "on")!);
    expect(children("box")).toEqual([id("a"), id("b")]);
    expect(children("list")).toEqual([id("c")]);
    workspace.undo();
    expect(children("list")).toEqual([id("a"), id("b"), id("c")]);

    expect(drop(["home-body"], "box", "on")).toBeUndefined();
    // Before the body = into the page itself: not a node parent.
    expect(drop(["box"], "home-body", "before")).toBeUndefined();
  });
});

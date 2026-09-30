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
import {
  catalogComponentCommands,
  catalogComponentState,
} from "../componentActions";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 Phase 4e-4 Component section: create a component from a node (an instance takes its
 * place), an instance's state (project or library, drawn instances), detach and dissolve — each
 * one history step.
 */
const PROJECT = "project:project:components" as EntryId<"project">;
const BODY = "project:node:home-body" as NodeId;
const id = (name: string) => `project:node:${name}` as NodeId;
const node = (
  name: string,
  definitionId: string,
  children: NodeId[] = [],
): NodeEntry => ({
  kind: "node",
  id: id(name),
  name: name === "card" ? "Card" : undefined,
  definitionId: definitionId as NodeEntry["definitionId"],
  children,
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
});

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({ projectId: PROJECT, name: "Components" }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-phase4e-components-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  let n = 0;
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        node("card", "lib:definition:type-frame", [id("title")]),
        node("title", "lib:definition:text"),
        node("icon", "lib:definition:origin-component-iconbutton"),
      ],
      rootIds: [id("card"), id("icon")],
      newId: (kind) => `project:${kind}:k${++n}` as never,
    }),
  );
  const children = () => {
    const entry = workspace.runtime.graph.getEntry(BODY);
    return entry?.kind === "node" ? entry.children : [];
  };
  return { workspace, children };
}

describe("ADR-248 Phase 4e-4 Component section", () => {
  it("create → the instance takes the node's place; dissolve → the instance keeps what it showed", async () => {
    const { workspace, children } = await open();
    const graph = workspace.runtime.graph;
    expect(catalogComponentState(graph, id("card"))).toEqual({});
    const revision = graph.revision;
    const { plan } = workspace.execute(
      catalogComponentCommands.create(id("card"), "Card", workspace.newId),
    );
    expect(graph.revision).toBe(revision + 1);
    const instance = plan.selectAfter![0];
    expect(children()[0]).toBe(instance);
    const state = catalogComponentState(graph, instance);
    expect(state.instanceOf).toMatchObject({
      name: "Card",
      project: true,
      instanceIds: [instance],
    });
    expect(workspace.readModel.components()).toHaveLength(1);

    workspace.execute(
      catalogComponentCommands.dissolve(
        state.instanceOf!.definitionId,
        workspace.newId,
      ),
    );
    expect(workspace.readModel.components()).toHaveLength(0);
    const detached = graph.getEntry(children()[0]);
    expect(detached).toMatchObject({
      definitionId: "lib:definition:type-frame",
    });
    expect((detached as NodeEntry).children).toHaveLength(1);
    workspace.undo();
    workspace.undo();
    expect(children()[0]).toBe(id("card"));
  });

  it("a library component instance detaches into owned nodes", async () => {
    const { workspace } = await open();
    const graph = workspace.runtime.graph;
    expect(catalogComponentState(graph, id("icon")).instanceOf).toMatchObject({
      project: false,
      instanceIds: [],
    });
    workspace.execute(
      catalogComponentCommands.detach(id("icon"), workspace.newId),
    );
    // The instance keeps its id and shows its template as owned nodes (root Button + children).
    const detached = graph.getEntry(id("icon")) as NodeEntry;
    expect(detached.definitionId).toBe("lib:definition:type-Button");
    expect(detached.children.length).toBeGreaterThan(0);
    expect(catalogComponentState(graph, id("icon")).instanceOf).toBeUndefined();
  });
});

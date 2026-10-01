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
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import {
  catalogComponentCommands,
  catalogComponentState,
} from "../componentActions";
import { CatalogLayerTreeStore } from "../layerTree";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 4e definition edit view: the Canvas draws one project definition's template instead of
 * the pages; its nodes are owned nodes, so picking selects them as `node` targets and an edit is
 * the ordinary command — the page's instances follow it.
 */
const BODY = "project:node:home-body" as NodeId;
const id = (name: string) => `project:node:${name}` as NodeId;
const node = (
  name: string,
  definitionId: string,
  children: NodeId[] = [],
  text?: string,
): NodeEntry => ({
  kind: "node",
  id: id(name),
  definitionId: definitionId as NodeEntry["definitionId"],
  children,
  props: text === undefined ? {} : { children: { kind: "set", value: text } },
  visual: {},
  sizing: {},
  descendantOverrides: [],
});

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:defview" as EntryId<"project">,
        name: "Definition view",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-4e-defview-${Math.random()}`),
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
        node("card", "lib:definition:type-frame", [id("title")]),
        node("title", "lib:definition:heading", [], "Hello"),
      ],
      rootIds: [id("card")],
      newId: workspace.newId,
    }),
  );
  const { plan } = workspace.execute(
    catalogComponentCommands.create(id("card"), "Card", workspace.newId),
  );
  const instance = plan.selectAfter![0] as NodeId;
  const definitionId = catalogComponentState(
    workspace.runtime.graph,
    instance,
  ).instanceOf!.definitionId as EntryId<"definition">;
  return { workspace, instance, definitionId };
}

const textOf = (workspace: CatalogWorkspace, recordId: string) =>
  workspace.root.domInputs.get(recordId)?.props.children;

describe("ADR-248 4e definition edit view", () => {
  it("draws the template alone, selects its nodes, and an edit reaches the page's instance", async () => {
    const { workspace, instance, definitionId } = await open();
    const graph = workspace.runtime.graph;
    const definition = graph.getEntry(definitionId);
    const templateRoot =
      definition?.kind === "definition" ? definition.templateRootId! : undefined;
    expect(templateRoot).toBeDefined();
    // The page draws the instance (its title a template record under it).
    const instanceTitle = () =>
      workspace.root
        .recordsOfSource(id("title"))
        .find((record) => textOf(workspace, record) !== undefined);
    expect(workspace.root.recordsOfSource(instance)).toHaveLength(1);

    workspace.showDefinition(definitionId);
    expect(workspace.session.getSnapshot().definitionView).toBe(definitionId);
    expect([...workspace.root.pageFrameRects().keys()]).toEqual([definitionId]);
    expect(workspace.root.recordsOfSource(instance)).toHaveLength(0);
    // The template's nodes are drawn and picked as owned node targets.
    const [titleRecord] = workspace.root.recordsOfSource(id("title"));
    expect(textOf(workspace, titleRecord)).toBe("Hello");
    workspace.selectRecords([titleRecord]);
    expect(workspace.session.getSnapshot().selection[0]?.target).toEqual({
      kind: "node",
      id: id("title"),
    });
    // Layers lists the template root.
    const layers = new CatalogLayerTreeStore(
      {
        readModel: workspace.readModel,
        graph,
        subscribeSteps: (listener) =>
          workspace.runtime.subscribeSteps(listener),
      },
      definitionId,
    );
    expect(layers.getSnapshot().map((row) => row.position.target)).toEqual([
      { kind: "node", id: templateRoot },
    ]);
    // Its root row carries the old row's origin mark.
    expect(layers.getSnapshot()[0].role).toBe("origin");
    layers.dispose();
    // An origin edit: one step, drawn in the view; back on the page the instance shows it.
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id("title") }],
        props: { children: { kind: "set", value: "Edited" } },
      }),
    );
    expect(textOf(workspace, workspace.root.recordsOfSource(id("title"))[0])).toBe(
      "Edited",
    );
    workspace.showDefinition(undefined);
    expect(workspace.session.getSnapshot().definitionView).toBeUndefined();
    // On the page the instance row carries the instance mark (the body row none).
    const project = graph.getEntry(graph.projectId);
    const pageLayers = new CatalogLayerTreeStore(
      {
        readModel: workspace.readModel,
        graph,
        subscribeSteps: (listener) =>
          workspace.runtime.subscribeSteps(listener),
      },
      project?.kind === "project" ? project.pageIds[0] : ("" as never),
    );
    const [bodyRow] = pageLayers.getSnapshot();
    pageLayers.setExpanded(new Set([bodyRow.id]));
    const [pageBody] = pageLayers.getSnapshot();
    expect(pageBody.role).toBeUndefined();
    expect(
      pageBody.children?.find(
        (row) =>
          row.position.target.kind === "node" &&
          row.position.target.id === instance,
      )?.role,
    ).toBe("instance");
    pageLayers.dispose();
    expect(workspace.root.pageFrameRects().has(definitionId)).toBe(false);
    expect(textOf(workspace, instanceTitle()!)).toBe("Edited");
    workspace.undo();
    expect(textOf(workspace, instanceTitle()!)).toBe("Hello");
    workspace.dispose();
  });

  it("leaves the view when its definition goes away", async () => {
    const { workspace, definitionId } = await open();
    workspace.showDefinition(definitionId);
    workspace.undo(); // the component's creation
    expect(workspace.session.getSnapshot().definitionView).toBeUndefined();
    expect(workspace.root.pageFrameRects().size).toBeGreaterThan(0);
    expect(() =>
      workspace.showDefinition("project:definition:nope" as EntryId<"definition">),
    ).toThrow(/CATALOG_DEFINITION_NOT_FOUND/);
    workspace.dispose();
  });
});

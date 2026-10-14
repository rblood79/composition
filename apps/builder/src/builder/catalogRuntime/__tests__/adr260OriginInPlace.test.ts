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
  duplicateNodes,
  insertNodes,
  removeTargets,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import {
  catalogComponentCommands,
  catalogComponentRole,
  catalogComponentState,
} from "../componentActions";
import {
  watchCatalogComponentEdits,
  type CatalogComponentConfirm,
} from "../componentConfirm";
import { catalogItemInsertChoices } from "../itemInsert";
import {
  PROJECT_COMPONENTS_VIEW,
  PROJECT_ORIGIN_VIEW_NODE,
  projectComponentCardId,
  projectComponentOriginCellId,
} from "../originView";
import { catalogComponentsPageRows } from "../componentsPage";
import { resolveCatalogClickRecord } from "../canvasPick";
import { CatalogLayerTreeStore } from "../layerTree";
import { catalogSlotDeclaration } from "../slots";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-260 Phase 3 — the Builder over a component whose origin stays in place: its marks, Go to
 * component, Restore origin, the first-edit question and the slot section.
 */
const PROJECT = "project:project:adr260" as EntryId<"project">;
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
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({ projectId: PROJECT, name: "ADR-260" }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr260-${Math.random()}`),
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
        {
          ...node("title", "lib:definition:text"),
          props: { children: { kind: "set", value: "Hello" } },
        },
      ],
      rootIds: [id("card")],
      newId: workspace.newId,
    }),
  );
  const graph = workspace.runtime.graph;
  workspace.execute(
    catalogComponentCommands.create(id("card"), "Card", workspace.newId),
  );
  const definitionId = graph.definitionOfTemplateRoot(id("card"))!;
  return { workspace, graph, definitionId };
}

describe("ADR-260 Phase 3 — the origin in place in the Builder", () => {
  it("marks the node ORIGIN on the page: Component section, Canvas chrome and Layers", async () => {
    const { workspace, graph, definitionId } = await open();
    expect(workspace.session.getSnapshot().selection[0]?.target).toEqual({
      kind: "node",
      id: id("card"),
    });
    expect(catalogComponentState(graph, id("card"))).toMatchObject({
      originOf: { definitionId, name: "Card", project: true },
    });
    expect(catalogComponentRole(graph, id("card"))).toBe("origin");
    // Its parts are ordinary nodes of the origin.
    expect(catalogComponentRole(graph, id("title"))).toBeUndefined();
    const project = graph.getEntry(graph.projectId);
    const layers = new CatalogLayerTreeStore(
      {
        readModel: workspace.readModel,
        graph,
        subscribeSteps: (listener) =>
          workspace.runtime.subscribeSteps(listener),
      },
      project?.kind === "project" ? project.pageIds[0] : ("" as never),
    );
    const [bodyRow] = layers.getSnapshot();
    layers.setExpanded(new Set([bodyRow.id]));
    const cardRow = layers
      .getSnapshot()[0]
      .children?.find(
        (row) =>
          row.position.target.kind === "node" &&
          row.position.target.id === id("card"),
      );
    expect(cardRow?.role).toBe("origin");
    layers.dispose();
    // Slots are declared on the origin in place, as in a template.
    expect(catalogSlotDeclaration(graph, id("title"))).toEqual({});
    workspace.dispose();
  });

  it("Go to component opens the origin's page and selects it (no definition view)", async () => {
    const { workspace, definitionId } = await open();
    const copy = workspace.execute(
      duplicateNodes({ ids: [id("card")], newId: workspace.newId }),
    ).plan.selectAfter![0]!;
    expect(workspace.session.getSnapshot().selection[0]?.target).toEqual({
      kind: "node",
      id: copy,
    });
    workspace.showDefinition(definitionId as never);
    expect(workspace.session.getSnapshot().definitionView).toBeUndefined();
    expect(workspace.session.getSnapshot().selection[0]?.target).toEqual({
      kind: "node",
      id: id("card"),
    });
    workspace.dispose();
  });

  it("an instance of a deleted origin restores it beside itself", async () => {
    const { workspace, graph } = await open();
    const copy = workspace.execute(
      duplicateNodes({ ids: [id("card")], newId: workspace.newId }),
    ).plan.selectAfter![0]!;
    expect(
      catalogComponentState(graph, copy).instanceOf?.restorable,
    ).toBeUndefined();
    workspace.execute(
      removeTargets({ targets: [{ kind: "node", id: id("card") }] }),
    );
    expect(catalogComponentState(graph, copy).instanceOf).toMatchObject({
      restorable: true,
    });
    workspace.execute(catalogComponentCommands.restore(copy));
    const body = graph.getEntry(BODY) as NodeEntry;
    expect(body.children.slice(-2)).toEqual([copy, id("card")]);
    expect(catalogComponentRole(graph, id("card"))).toBe("origin");
    workspace.dispose();
  });

  it("the first edit of the origin with instances asks; Cancel undoes it", async () => {
    const { workspace, graph } = await open();
    const requests: (number | undefined)[] = [];
    const answers = [false, true];
    const confirm: CatalogComponentConfirm = {
      detach: () => Promise.resolve(false),
      impact: (request) => {
        requests.push(request.instanceCount);
        return Promise.resolve(answers.shift() ?? false);
      },
    } as CatalogComponentConfirm;
    const stop = watchCatalogComponentEdits(workspace, confirm);
    const edit = (value: string) =>
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: id("title") }],
          props: { children: { kind: "set", value } },
        }),
      );
    const text = () =>
      (graph.getEntry(id("title")) as NodeEntry).props.children;
    // No instance yet: nothing to ask.
    edit("Alone");
    await flush();
    expect(requests).toEqual([]);
    workspace.execute(
      duplicateNodes({ ids: [id("card")], newId: workspace.newId }),
    );
    edit("Cancelled");
    await flush();
    expect(requests).toEqual([1]);
    expect(text()).toEqual({ kind: "set", value: "Alone" });
    edit("Kept");
    await flush();
    expect(requests).toEqual([1, 1]);
    expect(text()).toEqual({ kind: "set", value: "Kept" });
    stop();
    workspace.dispose();
  });

  it("the project components page lists every component on one page — its origin itself, deleted from its Layers row (user 2026-10-14)", async () => {
    const { workspace, graph, definitionId } = await open();
    const copy = workspace.execute(
      duplicateNodes({ ids: [id("card")], newId: workspace.newId }),
    ).plan.selectAfter![0]!;
    workspace.showDefinition(PROJECT_COMPONENTS_VIEW);
    const root = () => workspace.root;
    expect(root().recordsOfSource(PROJECT_ORIGIN_VIEW_NODE)).toHaveLength(1);
    // Its Layers root is a body named by its type, as a page's body (user 2026-10-14).
    expect(
      (graph.getEntry(PROJECT_ORIGIN_VIEW_NODE) as NodeEntry).name,
    ).toBeUndefined();
    // The card draws the origin node itself, nothing else (no instance beside it; the page's
    // instance is not drawn).
    const [originRecord] = root().recordsOfSource(id("card"));
    expect(originRecord).toBeDefined();
    expect(root().recordsOfSource(id("title"))).toHaveLength(1);
    expect(root().recordsOfSource(copy)).toHaveLength(0);
    // A card is its title and the origin — no "Origin" line label, no caption (user 2026-10-14).
    const card = graph.getEntry(projectComponentCardId(definitionId)) as NodeEntry;
    expect(card.children).toEqual([
      expect.stringMatching(/\/title$/),
      projectComponentOriginCellId(definitionId),
    ]);
    expect(
      (graph.getEntry(projectComponentOriginCellId(definitionId)) as NodeEntry)
        .children,
    ).toEqual([id("card")]);
    // Layers lists the origin itself under the page root (its row deletes it).
    const pageRoot = workspace.readModel.definitionRows(
      PROJECT_COMPONENTS_VIEW,
    )[0]!;
    expect(
      catalogComponentsPageRows(graph, pageRoot)?.map((row) => row.target),
    ).toEqual([{ kind: "node", id: id("card") }]);
    // A click inside the origin selects the origin (not the card's frames).
    expect(
      resolveCatalogClickRecord(
        root().domInputs,
        root().recordsOfSource(id("title"))[0]!,
        undefined,
      ),
    ).toBe(originRecord);
    expect(workspace.itemOfRecord(originRecord!)?.target).toEqual({
      kind: "node",
      id: id("card"),
    });
    // An edit there is an edit of the origin (the page shows it at once).
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id("title") }],
        props: { children: { kind: "set", value: "Edited on the page" } },
      }),
    );
    expect((graph.getEntry(id("title")) as NodeEntry).props.children).toEqual({
      kind: "set",
      value: "Edited on the page",
    });
    expect(
      root().canvasInputs.get(root().recordsOfSource(id("title"))[0]!)?.props
        .children,
    ).toBe("Edited on the page");
    // A component made inside it is drawn once — in the outer origin's card (its own card names
    // where it is).
    workspace.execute(
      catalogComponentCommands.create(id("title"), "Title", workspace.newId),
    );
    const titleDefinition = graph.definitionOfTemplateRoot(id("title"))!;
    expect(
      root().recordsOfSource(projectComponentOriginCellId(titleDefinition)),
    ).toHaveLength(1);
    expect(root().recordsOfSource(id("title"))).toHaveLength(1);
    workspace.undo();
    expect(
      root().recordsOfSource(projectComponentOriginCellId(titleDefinition)),
    ).toHaveLength(0);
    // Deleting the origin (its Layers row): the component leaves the page; its instance stays
    // and can restore it (Figma). Undo brings it back.
    workspace.execute(
      removeTargets({ targets: [{ kind: "node", id: id("card") }] }),
    );
    expect(
      root().recordsOfSource(projectComponentOriginCellId(definitionId)),
    ).toHaveLength(0);
    expect(catalogComponentState(graph, copy).instanceOf).toMatchObject({
      restorable: true,
    });
    workspace.undo();
    expect(root().recordsOfSource(id("card"))).toHaveLength(1);
    // Nothing of the page is saved.
    workspace.showDefinition(undefined);
    expect(graph.getEntry(PROJECT_ORIGIN_VIEW_NODE)).toBeUndefined();
    workspace.dispose();
  });

  it("an instance of a RadioGroup component adds a Radio (「+」) and takes its own Orientation (user 2026-10-14)", async () => {
    const { workspace } = await open();
    const graph = workspace.runtime.graph;
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [node("group", "lib:definition:origin-component-radiogroup")],
        rootIds: [id("group")],
        newId: workspace.newId,
      }),
    );
    workspace.execute(
      catalogComponentCommands.create(id("group"), "Choice", workspace.newId),
    );
    const instance = workspace.execute(
      duplicateNodes({ ids: [id("group")], newId: workspace.newId }),
    ).plan.selectAfter![0]!;
    const radiosOf = (nodeId: NodeId) => {
      const top = workspace.root.recordsOfSource(nodeId)[0]!;
      return [...workspace.root.canvasInputs.values()].filter((record) => {
        if (workspace.root.typeOf(record) !== "Radio") return false;
        for (
          let at: string | undefined = record.parentId;
          at;
          at = workspace.root.canvasInputs.get(at)?.parentId
        )
          if (at === top) return true;
        return false;
      });
    };
    const before = radiosOf(id("group")).length;
    expect(before).toBeGreaterThan(0);
    // The origin's own first Radio says something else than the library's.
    const firstRadio = workspace.itemOfRecord(
      radiosOf(id("group"))[0]!.id,
    )!.target;
    expect(firstRadio.kind).toBe("node");
    workspace.execute(
      setFields({
        targets: [firstRadio],
        props: { children: { kind: "set", value: "Renamed" } },
      }),
    );
    const texts = (nodeId: NodeId) =>
      radiosOf(nodeId).map((record) =>
        JSON.stringify(
          [...workspace.root.canvasInputs.values()]
            .filter(
              (child) => child.parentId === record.id || child.id === record.id,
            )
            .map((child) => child.props.children),
        ),
      );
    expect(radiosOf(instance)).toHaveLength(before);
    const position = workspace.positionOfRecord(
      workspace.root.recordsOfSource(instance)[0]!,
    )!;
    const host = {
      graph,
      readModel: workspace.readModel,
      newId: workspace.newId,
    };
    const radio = catalogItemInsertChoices(host, position).find(
      (choice) => choice.type === "Radio",
    );
    expect(radio).toBeDefined();
    expect(texts(instance).join()).toContain("Renamed");
    workspace.execute(radio!.build());
    expect(radiosOf(instance)).toHaveLength(before + 1);
    // The instance's list copies the origin's items (not the library's) and adds one.
    expect(texts(instance).join()).toContain("Renamed");
    // The origin keeps its own items.
    expect(radiosOf(id("group"))).toHaveLength(before);
    // Orientation written on the instance reaches the group it draws.
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: instance }],
        props: { orientation: { kind: "set", value: "horizontal" } },
      }),
    );
    const drawn = workspace.root.canvasInputs.get(
      workspace.root.recordsOfSource(instance)[0]!,
    )!;
    expect(drawn.props.orientation).toBe("horizontal");
    expect(
      workspace.root.canvasInputs.get(
        workspace.root.recordsOfSource(id("group"))[0]!,
      )!.props.orientation,
    ).not.toBe("horizontal");
    workspace.dispose();
  });
});

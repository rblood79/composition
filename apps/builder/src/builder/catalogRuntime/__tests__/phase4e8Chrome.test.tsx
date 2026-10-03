import "fake-indexeddb/auto";
import { fireEvent, render } from "@testing-library/react";
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
  moveNodes,
  removeTargets,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import {
  catalogLeafRecords,
  catalogSlotMarks,
} from "../../workspace/canvas/catalog/catalogChrome";
import { CatalogCanvasScene } from "../canvasScene";
import {
  catalogComponentCommands,
  catalogComponentRole,
} from "../componentActions";
import { CatalogComponentSection } from "../../panels/properties/catalog/CatalogComponentSection";
import { I18nProvider } from "../../../i18n";
import { useToastStore } from "../../stores/toast";
import { CatalogWorkspaceProvider } from "../react";
import { catalogDefinitionList, catalogNewLayoutCommand } from "../layouts";
import { catalogPageCommands, catalogPageContentTarget } from "../pageSettings";
import {
  catalogPaletteDefinitionId,
  catalogPaletteInsertCommand,
} from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 4e-8 Canvas chrome: the editing role colors (an instance of a component, the origin the
 * definition view shows), the group hover's leaves, and the slot marks — every declared slot in
 * the definition view, an empty one on the pages.
 */
const BODY = "project:node:home-body" as NodeId;
const node = (
  id: string,
  definitionId: string,
  children: string[] = [],
): NodeEntry => ({
  kind: "node",
  id: id as NodeId,
  definitionId: definitionId as NodeEntry["definitionId"],
  children: children as NodeId[],
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
});

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:chrome" as EntryId<"project">,
        name: "Chrome",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-4e8-chrome-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  return workspace;
}

describe("ADR-248 4e-8 Canvas chrome", () => {
  it("roles: a component instance, none for a primitive, the origin in the definition view", async () => {
    const workspace = await open();
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          node(
            "project:node:btn",
            catalogPaletteDefinitionId(
              workspace.runtime.graph.library,
              "Button",
            ),
          ),
          node("project:node:txt", "lib:definition:text"),
        ],
        rootIds: ["project:node:btn", "project:node:txt"] as NodeId[],
        newId: workspace.newId,
      }),
    );
    const graph = workspace.runtime.graph;
    expect(catalogComponentRole(graph, "project:node:btn" as NodeId)).toBe(
      "instance",
    );
    expect(
      catalogComponentRole(graph, "project:node:txt" as NodeId),
    ).toBeUndefined();
    workspace.execute(catalogNewLayoutCommand("Shell", workspace.newId));
    const [layout] = catalogDefinitionList(graph, "layout");
    const root = (graph.getEntry(layout!.id) as { templateRootId: NodeId })
      .templateRootId;
    // A layout is not a component: its root is no origin.
    expect(catalogComponentRole(graph, root, layout!.id)).toBeUndefined();
  });

  it("group hover leaves: the leaf records under a record; a leaf is its own", () => {
    const records = new Map([
      ["a", { children: ["b", "c"] }],
      ["b", { children: ["d", "e"] }],
      ["c", { children: [] }],
      ["d", { children: [] }],
      ["e", { children: [] }],
    ]);
    expect(catalogLeafRecords(records, "a")).toEqual(["d", "e", "c"]);
    expect(catalogLeafRecords(records, "c")).toEqual(["c"]);
  });

  it("slot marks: the empty slot of a layout on a page (instance color), gone once it holds content; the definition view marks every slot (origin)", async () => {
    const workspace = await open();
    workspace.execute(catalogNewLayoutCommand("Shell", workspace.newId));
    const graph = workspace.runtime.graph;
    const [layout] = catalogDefinitionList(graph, "layout");
    const pageId = workspace.session.getSnapshot().pageId!;
    workspace.execute(
      catalogPageCommands.layout(pageId, layout!.id, workspace.newId),
    );
    const scene = new CatalogCanvasScene(workspace.root);
    const marks = () => {
      scene.sync();
      return catalogSlotMarks(
        workspace,
        scene.stream.boundsMap,
        scene.stream.hitBoundsMap,
      );
    };
    expect(marks()).toEqual([
      expect.objectContaining({ empty: true, role: "instance" }),
    ]);
    // Page content in the slot: no mark.
    workspace.execute(
      catalogPaletteInsertCommand(
        {
          graph,
          records: workspace.root.domInputs,
          selection: () => [],
          itemOfRecord: (identity) => workspace.itemOfRecord(identity),
          pageContent: () => catalogPageContentTarget(graph, BODY),
          newId: workspace.newId,
        },
        "Button",
      )!,
    );
    expect(marks()).toEqual([]);
    workspace.showDefinition(layout!.id as never);
    const viewScene = new CatalogCanvasScene(workspace.root);
    viewScene.sync();
    expect(
      catalogSlotMarks(
        workspace,
        viewScene.stream.boundsMap,
        viewScene.stream.hitBoundsMap,
      ),
    ).toEqual([expect.objectContaining({ empty: true, role: "origin" })]);
  });
});

describe("ADR-248 4e-8 History subjects", () => {
  it("each entry names the element it acted on: created, edited, moved, removed (the snapshot name)", async () => {
    const workspace = await open();
    const subjects = () => workspace.history.getSnapshot().subjects;
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          {
            ...node("project:node:box", "lib:definition:type-frame", [
              "project:node:hello",
            ]),
            name: "Card box",
          },
          node("project:node:hello", "lib:definition:text"),
          node("project:node:other", "lib:definition:type-frame"),
        ],
        rootIds: ["project:node:box", "project:node:other"] as NodeId[],
        newId: workspace.newId,
      }),
    );
    // Two roots: the first one names the entry.
    expect(subjects()).toEqual(["Card box"]);
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: "project:node:hello" as NodeId }],
        visual: { color: { kind: "set", value: "#f00" } },
      }),
    );
    expect(subjects().at(-1)).toBe("Text");
    workspace.execute(
      moveNodes({
        ids: ["project:node:hello" as NodeId],
        parent: { kind: "node", id: "project:node:other" as NodeId },
        index: 0,
        newId: workspace.newId,
      }),
    );
    expect(subjects().at(-1)).toBe("Text");
    workspace.execute(
      removeTargets({
        targets: [{ kind: "node", id: "project:node:box" as NodeId }],
      }),
    );
    expect(subjects().at(-1)).toBe("Card box");
    expect(subjects()).toHaveLength(4);
  });
});

describe("ADR-248 4e-8 instance override rows", () => {
  it("lists the instance's writes at its template positions; a reset is one step with an undo toast", async () => {
    const workspace = await open();
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          node("project:node:tile", "lib:definition:type-frame", [
            "project:node:caption",
          ]),
          node("project:node:caption", "lib:definition:text"),
        ],
        rootIds: ["project:node:tile"] as NodeId[],
        newId: workspace.newId,
      }),
    );
    workspace.execute(
      catalogComponentCommands.create(
        "project:node:tile" as NodeId,
        "Tile",
        workspace.newId,
      ),
    );
    const graph = workspace.runtime.graph;
    const instance = (graph.getEntry(BODY) as NodeEntry).children[0]!;
    const record = workspace.root.recordsOfSource(instance)[0]!;
    const child = workspace.root.domInputs.get(record)!.children[0]!;
    const target = workspace.itemOfRecord(child)!.target;
    expect(target.kind).toBe("descendant");
    workspace.execute(
      setFields({
        targets: [target],
        visual: { color: { kind: "set", value: "#ff0000" } },
      }),
    );
    useToastStore.setState({ toasts: [] } as never);
    const view = render(
      <I18nProvider initialLocale="en-US">
        <CatalogWorkspaceProvider workspace={workspace}>
          <CatalogComponentSection nodeId={instance as NodeId} />
        </CatalogWorkspaceProvider>
      </I18nProvider>,
    );
    const row = view.getByRole("button", { name: /Text\.color/ });
    const depth = workspace.runtime.historyDepth.undo;
    fireEvent.click(row);
    expect(workspace.runtime.historyDepth.undo).toBe(depth + 1);
    const patch = (graph.getEntry(instance) as NodeEntry)
      .descendantOverrides[0];
    expect(
      patch?.kind === "patch" ? patch.visual?.color : undefined,
    ).toBeUndefined();
    expect(useToastStore.getState().toasts.at(-1)).toMatchObject({
      type: "info",
    });
    expect(view.queryByRole("button", { name: /Text\.color/ })).toBeNull();
    // An instance has no instances to pick (the old app showed the count on the origin only).
    expect(view.queryByRole("button", { name: /Select instances/ })).toBeNull();
    view.unmount();

    const definitionId = (graph.getEntry(instance) as NodeEntry).definitionId;
    workspace.showDefinition(definitionId as never);
    const originRoot = (
      graph.getEntry(definitionId) as unknown as { templateRootId: NodeId }
    ).templateRootId;
    const origin = render(
      <I18nProvider initialLocale="en-US">
        <CatalogWorkspaceProvider workspace={workspace}>
          <CatalogComponentSection nodeId={originRoot} />
        </CatalogWorkspaceProvider>
      </I18nProvider>,
    );
    expect(
      origin.getByRole("button", { name: "Select instances (1)" }),
    ).toBeTruthy();
    origin.unmount();
  });
});

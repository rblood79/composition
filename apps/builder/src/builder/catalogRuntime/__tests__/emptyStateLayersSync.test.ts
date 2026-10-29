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
import type { CatalogBoundRow } from "../../../../../../packages/shared/src/catalog/resolution/resolver";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { CatalogLayerTreeStore, type CatalogLayerNode } from "../layerTree";
import { catalogBindingRef } from "../dataBinding";
import { catalogBindingCommand } from "../dataBindingCommand";

/**
 * A collection's EmptyState row follows the Canvas at once (2026-10-23 user report 「동기화가
 * 느리다 — empty 를 선택하니 갱신된다」): a binding flips it without the Layers row list changing,
 * so the tree re-reads its judgment each step instead of waiting for a selection.
 */
const BODY = "project:node:home-body" as NodeId;
const GROUP = "project:node:tags" as NodeId;

describe("EmptyState in Layers — synced on the step", () => {
  it("a TagGroup bound to rows drops its EmptyState row in the binding's step", async () => {
    const library = await buildCodeCatalogLibrary();
    let rows: CatalogBoundRow[] | undefined;
    const workspace = new CatalogWorkspace(
      new CatalogGraph(
        newCatalogProjectDocument({
          projectId: "project:project:empty-sync" as EntryId<"project">,
          name: "Empty sync",
        }),
        library,
      ),
      new CatalogStorage(indexedDB, `empty-sync-${Math.random()}`),
      {
        engine: await nodeLayoutEngine(),
        viewport: { width: 1200, height: 800 },
        autosaveSchedule: () => {},
        root: { rows: () => rows },
      },
    );
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          {
            kind: "node",
            id: GROUP,
            definitionId: catalogPaletteDefinitionId(library, "TagGroup"),
            children: [],
            props: {},
            visual: {},
            sizing: {},
            descendantOverrides: [],
          } as NodeEntry,
        ],
        rootIds: [GROUP],
        newId: workspace.newId,
      }),
    );
    // (Its data is empty: the Canvas draws the EmptyState.)
    rows = [];
    const store = new CatalogLayerTreeStore(
      {
        readModel: workspace.readModel,
        graph: workspace.runtime.graph,
        subscribeSteps: (listener) =>
          workspace.runtime.subscribeSteps(listener),
        boundRows: (position) => workspace.boundRowsOf(position),
        subscribeBoundRows: (listener) => workspace.subscribeRows(listener),
        collectionRowHidden: (position, parentType) =>
          workspace.collectionRowHidden(position, parentType),
      },
      workspace.session.getSnapshot().pageId!,
    );
    store.connect();
    const expandAll = () =>
      store.setExpanded(new Set(workspace.root.domInputs.keys()));
    const tags = () => {
      const find = (
        nodes: readonly CatalogLayerNode[],
      ): CatalogLayerNode | undefined => {
        for (const node of nodes) {
          if (node.typeName === "TagList") return node;
          const inner = find(node.children ?? []);
          if (inner) return inner;
        }
        return undefined;
      };
      return (find(store.getSnapshot())?.children ?? []).map(
        (child) => child.name,
      );
    };
    expandAll();
    // (Unbound: its own tags, no EmptyState.)
    expect(tags().length).toBeGreaterThan(0);
    expect(tags()).not.toContain("EmptyState");
    workspace.execute(
      catalogBindingCommand(
        [{ kind: "node", id: GROUP }],
        catalogBindingRef({
          source: "dataTable",
          collectionId: "users",
          name: "Users",
        })!,
      ),
    );
    // (No re-expand or selection — the step alone updates the tree.)
    expect(tags()).toEqual(["EmptyState"]);
    // Rows arrive: no selection needed for the tree to follow.
    rows = [
      { key: "a", values: { id: "a", label: "a", name: "a" } },
      { key: "b", values: { id: "b", label: "b", name: "b" } },
    ];
    workspace.refreshRows(["users"]);
    expect(tags()).toEqual(["a", "b"]);
  });
});

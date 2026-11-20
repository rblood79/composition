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
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { CatalogLayerTreeStore, type CatalogLayerNode } from "../layerTree";

/**
 * ADR-315 Phase 4 증분 1: a Column 「Hidden by default」 keeps its Layers row (the author selects
 * it there to turn the switch off — the Canvas does not draw it), marked hidden with its Cells —
 * in the edit's step, with no selection or re-expansion.
 */
const BODY = "project:node:home-body" as NodeId;
const TABLE = "project:node:table" as NodeId;

describe("a hidden Column in Layers (ADR-315 Phase 4)", () => {
  it("marks the Column 「Hidden by default」 and its Cells, and drops the mark when shown", async () => {
    const library = await buildCodeCatalogLibrary();
    const workspace = new CatalogWorkspace(
      new CatalogGraph(
        newCatalogProjectDocument({
          projectId: "project:project:hidden-column" as EntryId<"project">,
          name: "Hidden column",
        }),
        library,
      ),
      new CatalogStorage(indexedDB, `hidden-column-${Math.random()}`),
      {
        engine: await nodeLayoutEngine(),
        viewport: { width: 1200, height: 800 },
        autosaveSchedule: () => {},
      },
    );
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          {
            kind: "node",
            id: TABLE,
            definitionId: catalogPaletteDefinitionId(library, "Table"),
            children: [],
            props: {},
            visual: {},
            sizing: {},
            descendantOverrides: [],
          } as NodeEntry,
        ],
        rootIds: [TABLE],
        newId: workspace.newId,
      }),
    );
    const store = new CatalogLayerTreeStore(
      {
        readModel: workspace.readModel,
        graph: workspace.runtime.graph,
        subscribeSteps: (listener) =>
          workspace.runtime.subscribeSteps(listener),
        columnHidden: (position) => workspace.columnHidden(position),
      },
      workspace.session.getSnapshot().pageId!,
    );
    store.connect();
    store.setExpanded(new Set(workspace.root.domInputs.keys()));
    const all = (): CatalogLayerNode[] => {
      const out: CatalogLayerNode[] = [];
      const walk = (nodes: readonly CatalogLayerNode[]) => {
        for (const node of nodes) {
          out.push(node);
          walk(node.children ?? []);
        }
      };
      walk(store.getSnapshot());
      return out;
    };
    const hiddenRows = () =>
      all()
        .filter((node) => node.columnHidden)
        .map((node) => node.typeName)
        .sort();
    expect(hiddenRows()).toEqual([]);
    // (The data Columns: the selection Column is the first.)
    const columns = [...workspace.root.domInputs.values()].filter(
      (record) =>
        record.ruleId === "Column" &&
        !record.children.some(
          (part) =>
            workspace.root.domInputs.get(part)?.props.slot === "selection",
        ),
    );
    const type = columns[1]!;
    workspace.execute(
      setFields({
        targets: [workspace.positionOfRecord(type.id)!.target],
        props: { defaultHidden: { kind: "set", value: true } },
      }),
    );
    // The step alone: the Column row and its Cell row are marked — and still listed.
    expect(hiddenRows()).toEqual(["Cell", "Column"]);
    expect(all().find((node) => node.id === type.id)?.columnHidden).toBe(true);
    workspace.execute(
      setFields({
        targets: [workspace.positionOfRecord(type.id)!.target],
        props: { defaultHidden: { kind: "set", value: false } },
      }),
    );
    expect(hiddenRows()).toEqual([]);
    store.dispose();
  }, 60_000);
});

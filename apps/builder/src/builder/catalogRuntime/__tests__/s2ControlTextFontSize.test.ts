/**
 * 2026-11-24 (사용자 「components library 의 M size fontsize 전체 체크」 → 「5곳 전부 S2 기준으로」):
 * the words in an S2 control row take the control's font, not a Text's own M (16).
 *
 * - Table: a Cell's and a Column's words — S2 `TableView.tsx` `controlFont()` (M = `ui` 14).
 * - Tree: a row's words — S2 `TreeView.tsx` `font: 'ui'` (14).
 * - ActionBar: the selected count — S2 `ActionBar.tsx` `font: 'ui'` (14).
 * - InlineAlert: the heading — S2 `InlineAlert.tsx` `font: 'title-sm'` (14).
 * - CollectionCard: the description in its meta `div` — S2 Card `TextContext` reaches it through
 *   the `div` (M `body-xs` 12, L `body-sm` 14); the DOM's sheet is a descendant selector.
 */
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  DefinitionId,
  EntryId,
  LibraryDefinitionId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import type { CatalogConsumerNode } from "../../../../../../packages/shared/src/catalog/runtime/compositionRoot";
import {
  catalogCreationProps,
  catalogPaletteDefinitionId,
} from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const BODY = "project:node:home-body" as NodeId;
const NODE = "project:node:s2-control-text" as NodeId;
const set = <T>(value: T) => ({ kind: "set" as const, value });

async function placed(type: string, definition?: string) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:s2-control-text" as EntryId<"project">,
        name: "S2 control text",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `s2-control-text-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  const definitionId = (definition ??
    catalogPaletteDefinitionId(library, type)) as LibraryDefinitionId;
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: NODE,
          definitionId,
          children: [],
          props: catalogCreationProps(
            workspace.runtime.graph,
            definitionId,
            type,
            {},
          ),
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
      ],
      rootIds: [NODE],
      newId: workspace.newId,
    }),
  );
  const records = () => [...workspace.root.canvasInputs.values()];
  /** The drawn font size of the record whose words are `text` (a parent's derived size wins). */
  const fontOf = (text: string) => {
    const record = records().find(
      (item) =>
        item.props.children === text &&
        item.children.length === 0 &&
        item.bindingId !== undefined,
    ) as CatalogConsumerNode | undefined;
    expect(record, text).toBeDefined();
    return Number(record!.derivedProps?.fontSize ?? record!.visual.fontSize);
  };
  return { workspace, fontOf };
}

describe("S2 control rows — the words take the control font", () => {
  it("Table: a cell's and a column's words are 14 (S2 controlFont M)", async () => {
    const { fontOf } = await placed("Table");
    expect(fontOf("Item 1")).toBe(14);
    expect(fontOf("Name")).toBe(14);
  });

  it("Tree: a row's words are 14 at M, one control step per item size", async () => {
    const tree = await placed("Tree");
    expect(tree.fontOf("Node 1")).toBe(14);
    expect(tree.fontOf("Node 1.1")).toBe(14);
    // (A TreeItem the author builds: its own size reaches its row's words.)
    const node = (
      id: string,
      definitionId: string,
      children: string[],
      props: Record<string, ReturnType<typeof set<string>>>,
    ) => ({
      kind: "node" as const,
      id: id as NodeId,
      definitionId: definitionId as DefinitionId,
      children: children as NodeId[],
      props,
      visual: {},
      sizing: {},
      descendantOverrides: [],
    });
    const ITEM = "project:node:tree-item" as NodeId;
    tree.workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          node(ITEM, "lib:definition:type-TreeItem", ["project:node:tree-row"], {}),
          node(
            "project:node:tree-row",
            "lib:definition:type-TreeItemContent",
            ["project:node:tree-words"],
            {},
          ),
          node("project:node:tree-words", "lib:definition:text", [], {
            children: set("Built row"),
          }),
        ],
        rootIds: [ITEM],
        newId: tree.workspace.newId,
      }),
    );
    expect(tree.fontOf("Built row")).toBe(14);
    tree.workspace.execute(
      setFields({
        targets: [{ kind: "node", id: ITEM }],
        props: { size: set("L") },
      }),
    );
    // (S2 `controlFont()` L = `ui-lg` 16 — the Text's M.)
    expect(tree.fontOf("Built row")).toBe(16);
  });

  it("ActionBar: the selected count is 14 (S2 `ui`)", async () => {
    const { fontOf } = await placed("ActionBar");
    expect(fontOf("1 selected")).toBe(14);
  });

  it("InlineAlert: the heading is 14 (S2 `title-sm`)", async () => {
    const { fontOf } = await placed("InlineAlert");
    expect(fontOf("Alert Heading")).toBe(14);
  });

  it("CollectionCard: the description in its meta row takes the Card size (12 · 14)", async () => {
    const { workspace, fontOf } = await placed(
      "Card",
      "lib:definition:origin-component-collectioncard",
    );
    expect(fontOf("20 photos")).toBe(12);
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: NODE }],
        props: { size: set("L") },
      }),
    );
    expect(fontOf("20 photos")).toBe(14);
  });
});

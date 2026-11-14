// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import {
  insertNodes,
  removeTargets,
  setFields,
  setRowTemplate,
} from "../../../../../../packages/shared/src/catalog/commands";
import { definitionTypeName } from "../../../../../../packages/shared/src/catalog/commands/context";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  DataBindingRef,
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import type { CatalogBoundRow } from "../../../../../../packages/shared/src/catalog/resolution/resolver";
import { catalogBindingCommand } from "../dataBindingCommand";
import { renderCatalogDom } from "../domBinding";
import { CatalogLayerTreeStore, type CatalogLayerNode } from "../layerTree";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-310 G3 — a list mixes static items and a repeated one (the reference's 「Combining
 * collections」): `[static A, repeated B (3 rows), static C]` is five items in the same order on
 * the Canvas, in the DOM and (as A · B × 3 · C) in Layers; unbinding leaves B one static item; a
 * data row whose key a static item has is reported, not dropped or re-keyed.
 */
const BODY = "project:node:home-body" as NodeId;
const LIST = "project:node:list" as NodeId;
const BINDING = {
  collectionId: "data:collection:c1",
  fieldMap: {},
} as DataBindingRef;
const ROWS: CatalogBoundRow[] = ["r1", "r2", "r3"].map((key) => ({
  key,
  values: { id: key, label: `Row ${key}`, value: key },
}));

it("ADR-310 G3: [static A, repeated B (3 rows), static C] — Canvas · DOM · Layers in one order; unbind; key conflict", async () => {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:mixed" as EntryId<"project">,
        name: "Mixed",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr310-mixed-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
      root: {
        rows: (binding) =>
          binding.collectionId === BINDING.collectionId ? ROWS : undefined,
      },
    },
  );
  const graph = workspace.runtime.graph;
  try {
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          {
            kind: "node",
            id: LIST,
            definitionId: catalogPaletteDefinitionId(library, "ListBox"),
            children: [],
            props: {},
            visual: {},
            sizing: {},
            descendantOverrides: [],
          } as NodeEntry,
        ],
        rootIds: [LIST],
        newId: workspace.newId,
      }),
    );
    const fill = () =>
      (
        (graph.getEntry(LIST) as NodeEntry).descendantOverrides.find(
          (override) => override.kind === "fillSlot",
        ) as { childIds: readonly NodeId[] }
      ).childIds.filter(
        (id) =>
          definitionTypeName(graph, (graph.getEntry(id) as NodeEntry).definitionId) ===
          "ListBoxItem",
      );
    const [a, b, c] = fill() as [NodeId, NodeId, NodeId];
    expect(fill()).toHaveLength(3);
    // 「모두 고정 항목으로」 then B as the rows' template (its copy at the end goes): A · B* · C.
    workspace.execute(
      catalogBindingCommand(
        [{ kind: "node", id: LIST }],
        BINDING,
        workspace.newId,
        "keep",
      ),
    );
    const copy = fill().at(-1)!;
    expect((graph.getEntry(copy) as NodeEntry).repeat).toBe(true);
    workspace.execute(setRowTemplate({ itemId: b }));
    expect((graph.getEntry(b) as NodeEntry).repeat).toBe(true);
    expect((graph.getEntry(copy) as NodeEntry).repeat).toBeUndefined();
    // (「템플릿 바꾸기」 is one step: Undo puts the mark back on the copy.)
    workspace.undo();
    expect((graph.getEntry(copy) as NodeEntry).repeat).toBe(true);
    expect((graph.getEntry(b) as NodeEntry).repeat).toBeUndefined();
    workspace.redo();
    workspace.execute(removeTargets({ targets: [{ kind: "node", id: copy }] }));
    expect(fill()).toEqual([a, b, c]);

    // Canvas: five item records, in order A · B(r1 r2 r3) · C.
    const root = workspace.root;
    const [listRecord] = root.recordsOfSource(LIST);
    const items = () => {
      const out: { source: string; row?: number }[] = [];
      const visit = (id: string) => {
        const record = root.canvasInputs.get(id)!;
        if (root.typeOf(record) === "ListBoxItem") {
          out.push({ source: record.sourceId, row: record.rowIndex });
          return;
        }
        record.children.forEach(visit);
      };
      visit(listRecord!);
      return out;
    };
    expect(items()).toEqual([
      { source: a, row: undefined },
      { source: b, row: 0 },
      { source: b, row: 1 },
      { source: b, row: 2 },
      { source: c, row: undefined },
    ]);
    // DOM (Preview · Publish): five options, the rows between A and C.
    const html = () =>
      renderToStaticMarkup(renderCatalogDom(root, listRecord!));
    const options = () =>
      [...html().matchAll(/role="option"[^>]*>(.*?)<\/div>/g)].length;
    expect(html().match(/role="option"/g)).toHaveLength(5);
    const at = (text: string) => html().indexOf(text);
    expect(at("Row r1")).toBeGreaterThan(-1);
    expect(at("Row r1")).toBeLessThan(at("Row r2"));
    expect(at("Row r2")).toBeLessThan(at("Row r3"));
    void options;

    // Layers: A · B (repeat, × 3) · C.
    const layers = new CatalogLayerTreeStore(
      {
        readModel: workspace.readModel,
        graph,
        subscribeSteps: (listener) =>
          workspace.runtime.subscribeSteps(listener),
        boundRows: (position) => workspace.boundRowsOf(position),
        subscribeBoundRows: (listener) => workspace.subscribeRows(listener),
        collectionRowHidden: (position, parentType) =>
          workspace.collectionRowHidden(position, parentType),
        recordDrawn: (position) => root.domInputs.has(position.identity),
      },
      workspace.session.getSnapshot().pageId!,
    );
    const stopLayers = layers.connect();
    layers.setExpanded(new Set([root.recordsOfSource(BODY)[0]!, listRecord!]));
    const listRow = () => {
      const find = (
        nodes: readonly CatalogLayerNode[],
      ): CatalogLayerNode | undefined => {
        for (const node of nodes) {
          if (node.id === listRecord) return node;
          const inner = find(node.children ?? []);
          if (inner) return inner;
        }
        return undefined;
      };
      return find(layers.getSnapshot())!;
    };
    const itemRows = () =>
      (listRow().children ?? [])
        .filter((row) => row.typeName === "ListBoxItem")
        .map((row) => [
          (row.position.target as { id: NodeId }).id,
          row.repeat?.count ?? null,
          row.repeat?.keyConflicts ?? null,
        ]);
    expect(itemRows()).toEqual([
      [a, null, null],
      [b, 3, null],
      [c, null, null],
    ]);

    // A static item with a data row's key: reported on the template row — every row still shows.
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: c }],
        props: { id: { kind: "set", value: "r2" } },
      }),
    );
    expect(items()).toHaveLength(5);
    expect(itemRows()[1]).toEqual([b, 3, ["r2"]]);

    // Unbinding: B stays as one static item between A and C.
    workspace.execute(
      catalogBindingCommand([{ kind: "node", id: LIST }], undefined),
    );
    expect((graph.getEntry(b) as NodeEntry).repeat).toBeUndefined();
    expect(fill()).toEqual([a, b, c]);
    expect(items()).toEqual([
      { source: a, row: undefined },
      { source: b, row: undefined },
      { source: c, row: undefined },
    ]);
    expect(itemRows()).toEqual([
      [a, null, null],
      [b, null, null],
      [c, null, null],
    ]);
    stopLayers();
  } finally {
    workspace.dispose();
  }
});

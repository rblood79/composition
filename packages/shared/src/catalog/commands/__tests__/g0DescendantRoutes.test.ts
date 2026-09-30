import { existsSync, readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import {
  buildCodeCatalogLibrary,
  catalogTypeDefinitionId,
} from "../../document/codeCatalogLibrary";
import { CatalogGraph } from "../../document/graph";
import type {
  CatalogFillLayer,
  CatalogLibrary,
  EntryId,
  NodeEntry,
  NodeId,
  PageEntry,
  ProjectEntry,
  TemplateId,
} from "../../document/types";
import {
  resolveCatalogNode,
  type ResolvedCatalogNode,
} from "../../resolution/resolver";
import { applyCatalogTransaction } from "../../transactions/transaction";
import {
  insertCollectionItem,
  insertGroupItem,
  insertTableColumns,
} from "../collections";
import { createComponent, detachInstances } from "../components";
import type { NodeParent } from "../context";
import {
  renameNode,
  resetDescendant,
  setFields,
  setWholeField,
} from "../fields";
import { applyLayout, createLayout } from "../project";
import {
  copyNodes,
  duplicateNodes,
  insertNodes,
  moveNodes,
  pasteNodes,
  removeTargets,
} from "../structure";
import {
  allocator,
  documentOf,
  node,
  PAGE,
  PROJECT,
  run,
  text,
  undo,
} from "./fixture";

/**
 * ADR-248 Phase 4b — the G0 active descendant routes (13, `descendant-route-closure.json`) each run
 * one new command on the code catalog library and compare the resolved reader values with the
 * frozen old writer→reader sample. Old node IDs are mapped to the new records; model differences
 * are asserted explicitly (origins live in Components, fills use `kind`). The frozen baseline is
 * local only (user decision 2026-09-30): without it the routes are skipped.
 */
const BASELINE = new URL(
  "../../../../../../docs/adr/design/248-baseline/",
  import.meta.url,
);
const BASELINE_ABSENT = !existsSync(BASELINE);
const oracle = (file: string) =>
  JSON.parse(readFileSync(new URL(file, BASELINE), "utf8"));
const routeOutput = (key: string) =>
  oracle("descendant-route-oracle.json").oldOutput[key];

let library: CatalogLibrary;
beforeAll(async () => {
  library = await buildCodeCatalogLibrary();
});

const graphWith = (
  nodes: NodeEntry[],
  roots: string[],
  extra: Parameters<typeof documentOf>[2] = [],
) => new CatalogGraph(documentOf(nodes, roots, extra), library);
const id = (name: string) => `project:node:${name}` as NodeId;
const set = <T>(value: T) => ({ kind: "set" as const, value });
const T = (name: string) => `lib:template:component-${name}` as TemplateId;
const ORIGIN = (name: string) =>
  `lib:definition:origin-component-${name}` as NodeEntry["definitionId"];
/** An old origin ref (`component-iconbutton`) → its origin definition. */
const OLD_REF = (ref: string) =>
  `lib:definition:origin-${ref}` as NodeEntry["definitionId"];
const TYPE = (name: string) =>
  catalogTypeDefinitionId(name) as NodeEntry["definitionId"];
const at = (
  ownerId: NodeId,
  templatePath: readonly TemplateId[],
  nested: readonly TemplateId[] = [],
): Extract<NodeParent, { kind: "descendant" }> => ({
  kind: "descendant",
  ownerId,
  address: { instances: [ownerId, ...nested], templatePath },
});
const redo = (graph: CatalogGraph, forward: readonly unknown[]) =>
  applyCatalogTransaction(graph, {
    projectId: graph.projectId,
    expectedRevision: graph.revision,
    history: { kind: "record", label: "redo" },
    ops: forward as never,
  });

const all = (root: ResolvedCatalogNode): ResolvedCatalogNode[] => [
  root,
  ...root.children.flatMap(all),
];
const resolved = (graph: CatalogGraph, rootId: NodeId) =>
  all(resolveCatalogNode(graph, rootId));
const ofType = (graph: CatalogGraph, rootId: NodeId, type: string) =>
  resolved(graph, rootId).filter((item) => item.definitionId === TYPE(type));
const bySource = (graph: CatalogGraph, rootId: NodeId, sourceId: string) =>
  resolved(graph, rootId).find((item) => item.sourceId === sourceId);
const pageChildren = (graph: CatalogGraph) =>
  (graph.getEntry(PAGE) as PageEntry).children;
/** Old fill layer (`type`) → the typed layer (`kind`). */
const typedFills = (
  fills: ReadonlyArray<Record<string, unknown>>,
): CatalogFillLayer[] =>
  fills.map(
    ({ type, ...rest }) => ({ ...rest, kind: type }) as CatalogFillLayer,
  );

describe.skipIf(BASELINE_ABSENT)("ADR-248 G0 active descendant routes", () => {
  it("frozen samples: 13 routes, each linked to an old writer→reader oracle", () => {
    const closure = oracle("descendant-route-closure.json");
    expect(closure.summary.activeRoutes).toBe(13);
    expect(closure.routes.map((route: { id: string }) => route.id)).toEqual([
      "canonical-actions",
      "collection-item-insert",
      "element-mutation",
      "group-item-insert",
      "history-inverse",
      "inspector-child-edit",
      "page-binding",
      "presentation-fills",
      "presentation-style",
      "reset-override",
      "slot-owned-edit",
      "structural-order",
      "table-column-insert",
    ]);
  });

  it("collection-item-insert: a keyed Tab and its TabPanel in a Tabs instance", () => {
    const old = routeOutput("collection");
    const tabs = id("tabs");
    const graph = graphWith([node("tabs", ORIGIN("tabs"))], ["tabs"]);
    run(
      graph,
      insertCollectionItem({
        host: at(tabs, [T("tabs"), T("tabs__1")]),
        entries: [
          node("tab3", ORIGIN("tab-item-default"), {
            props: { id: set("k3") },
            descendantOverrides: [
              {
                kind: "patch",
                address: {
                  instances: [id("tab3")],
                  templatePath: [
                    T("tab-item-default"),
                    T("tab-item-default__label"),
                  ],
                },
                props: { children: set("Tab 3") },
              },
            ],
          }),
        ],
        rootId: id("tab3"),
        key: "k3",
        panel: node("panel3", TYPE("TabPanel"), {
          props: { itemId: set("k3") },
        }),
        newId: allocator(),
      }),
    );
    const tabNodes = ofType(graph, tabs, "Tab");
    expect(
      tabNodes.map(
        (tab) =>
          all(tab).find((item) => item.definitionId === TYPE("Text"))?.props
            .children,
      ),
    ).toEqual(old.reader.tabLabels);
    expect(tabNodes.at(-1)?.props.id).toBe(old.reader.addedTabKey);
    expect(ofType(graph, tabs, "TabPanel").at(-1)?.props.itemId).toBe(
      old.reader.addedPanelKey,
    );
  });

  it("group-item-insert: a selected Radio takes a unique value and the group's selection", () => {
    const old = routeOutput("group");
    const group = id("group");
    const graph = graphWith([node("group", ORIGIN("radiogroup"))], ["group"]);
    run(
      graph,
      insertGroupItem({
        hostId: group,
        entries: [
          node("radioNew", ORIGIN("radio"), {
            props: { isSelected: set(true) },
          }),
        ],
        rootId: id("radioNew"),
        newId: allocator(),
      }),
    );
    expect(ofType(graph, group, "RadioGroup")[0].props.value).toBe(
      old.reader.value,
    );
    const radios = ofType(graph, group, "Radio");
    expect(radios).toHaveLength(3);
    for (const inherited of radios.slice(0, -1))
      expect(inherited.props.isSelected).toBe(old.reader.inheritedSelected);
    expect(radios.at(-1)?.props).toMatchObject({
      isSelected: old.reader.addedSelected,
      value: old.reader.addedValue,
    });
  });

  it("table-column-insert: the first column of a Table instance's header", () => {
    const old = routeOutput("table");
    const table = id("table");
    const graph = graphWith([node("table", ORIGIN("table"))], ["table"]);
    run(
      graph,
      insertTableColumns({
        header: at(table, [T("table"), T("table__1")]),
        buildColumn: (spec) => ({
          entries: [node(`column-${spec.key}`, ORIGIN("table-column"))],
          rootId: id(`column-${spec.key}`),
        }),
        buildCell: (rowId) => ({
          entries: [node(`cell-${rowId}`, TYPE("Cell"))],
          rootId: id(`cell-${rowId}`),
        }),
        newId: allocator(),
      }),
    );
    expect(
      ofType(graph, table, "Column").map((column) => ({
        key: column.props.key,
        label: column.props.children,
      })),
    ).toEqual(old.reader.columns);
  });

  /** A user component with a `content` slot filled with "First", and a page text "Moved". */
  const slotComponent = () => {
    const newId = allocator();
    const graph = graphWith(
      [
        node("card", TYPE("frame"), { children: [id("slot")] }),
        node("slot", TYPE("frame"), {
          slot: { name: "content", required: false },
        }),
        text("moved", "Moved"),
      ],
      ["card", "moved"],
    );
    const created = run(
      graph,
      createComponent({ id: id("card"), name: "Card", newId }),
    );
    const instance = created.plan.selectAfter![0];
    const slot = at(instance, [id("card") as never, id("slot") as never]);
    run(
      graph,
      insertNodes({
        parent: slot,
        entries: [text("first", "First")],
        rootIds: [id("first")],
        newId,
      }),
    );
    const slotTexts = () =>
      ofType(graph, instance, "Text").map((item) => item.props.children);
    return { graph, newId, instance, slot, slotTexts };
  };

  it("structural-order: a page insert between the instance and a later root keeps the slot fill", () => {
    const old = routeOutput("structural");
    const { graph, newId, instance, slotTexts } = slotComponent();
    run(
      graph,
      insertNodes({
        parent: { kind: "page", id: PAGE },
        index: 1,
        entries: [text("later", "Later")],
        rootIds: [id("later")],
        newId,
      }),
    );
    // Model difference: the origin is a definition in Components, not a page root.
    const oldOrder = (old.reader.rootOrder as string[]).filter(
      (name) => name !== "adr248-origin",
    );
    expect(
      pageChildren(graph).map((child) =>
        child === instance ? "adr248-instance" : `adr248-${child.slice(13)}`,
      ),
    ).toEqual(oldOrder);
    expect(slotTexts()).toEqual(old.reader.retainedDescendantText);
  });

  it("element-mutation + history-inverse: a move into an instance slot, undo and redo", () => {
    const move = routeOutput("elementMutation");
    const history = routeOutput("historyInverse");
    const { graph, newId, slot, slotTexts } = slotComponent();
    const moved = run(
      graph,
      moveNodes({ ids: [id("moved")], parent: slot, index: 1, newId }),
    );
    expect(slotTexts()).toEqual(move.reader.childTexts);
    expect(slotTexts()).toEqual(history.reader.before);
    undo(graph, moved.result.inverse);
    expect(slotTexts()).toEqual(history.reader.undo);
    redo(graph, moved.result.forward);
    expect(slotTexts()).toEqual(history.reader.redo);
  });

  it("slot-owned-edit: an owned slot child's text and weight", () => {
    const old = routeOutput("slotOwnedEdit");
    const { graph, instance } = slotComponent();
    run(
      graph,
      setFields({
        targets: [{ kind: "node", id: id("first") }],
        props: { children: set(old.writer.children) },
        visual: { fontWeight: set(old.writer.style.fontWeight) },
      }),
    );
    const first = bySource(graph, instance, id("first"))!;
    expect(first.props.children).toBe(old.reader.children);
    expect(first.visual.fontWeight).toBe(old.reader.style.fontWeight);
  });

  it("page-binding: page content in a layout's header slot, kept across save and load", () => {
    const old = routeOutput("pageBinding");
    const newId = allocator();
    const graph = graphWith([text("note", "Header note")], ["note"]);
    run(
      graph,
      createLayout({
        name: "Shell",
        rootId: id("shell"),
        entries: [
          node("shell", TYPE("frame"), {
            children: [id("header"), id("main")],
          }),
          node("header", TYPE("frame"), {
            slot: { name: "header", required: false },
          }),
          node("main", TYPE("frame"), {
            slot: { name: "content", required: false },
          }),
        ],
        newId,
      }),
    );
    const [layoutId] = (graph.getEntry(PROJECT) as ProjectEntry).definitionIds;
    run(
      graph,
      applyLayout({
        pageId: PAGE,
        definitionId: layoutId as EntryId<"definition">,
        slotPath: [id("shell") as never, id("header") as never],
        newId,
      }),
    );
    const read = (target: CatalogGraph) => {
      const [instance] = pageChildren(target);
      const header = bySource(target, instance, id("header"))!;
      return {
        type: bySource(target, instance, id("shell"))?.definitionId,
        headerNote: all(header).some((item) => item.sourceId === id("note")),
      };
    };
    expect(read(graph)).toEqual({
      type: TYPE(old.reader.type),
      headerNote: old.reader.headerNote,
    });
    const reloaded = new CatalogGraph(graph.exportDocument(), library);
    expect(read(reloaded).headerNote).toBe(
      old.persistedAndRefreshed.readerHeaderNote,
    );
  });

  describe("IconButton label position (descendant-active)", () => {
    const icon = id("icon");
    const list = id("list");
    const labelPath = [T("iconbutton"), T("iconbutton__label")];
    const label = at(icon, labelPath);
    const activeGraph = () =>
      graphWith(
        [node("icon", ORIGIN("iconbutton")), node("list", ORIGIN("listbox"))],
        ["icon", "list"],
      );
    const labelNode = (graph: CatalogGraph) =>
      bySource(graph, icon, T("iconbutton__label"))!;

    it("presentation-style + presentation-fills + canonical-actions: style and fills on the label", () => {
      const old = oracle("descendant-active/baseline.json");
      const graph = activeGraph();
      run(
        graph,
        setFields({
          targets: [label],
          visual: {
            borderColor: set(old.reader.iconLabel.style.borderColor),
          },
        }),
      );
      run(
        graph,
        setWholeField({
          targets: [label],
          field: "fills",
          value: typedFills(old.reader.iconLabel.fills),
        }),
      );
      expect(labelNode(graph).visual.borderColor).toBe(
        old.reader.iconLabel.style.borderColor,
      );
      expect(labelNode(graph).fills).toEqual(
        typedFills(old.reader.iconLabel.fills),
      );
    });

    it("reset-override: resetting the label's style keeps its fills", () => {
      const old = oracle("descendant-active/baseline.json");
      const graph = activeGraph();
      const definitionBorder = labelNode(graph).visual.borderColor;
      run(
        graph,
        setFields({
          targets: [label],
          visual: {
            borderColor: set(old.reader.iconLabel.style.borderColor),
          },
        }),
      );
      run(
        graph,
        setWholeField({
          targets: [label],
          field: "fills",
          value: typedFills(old.reader.iconLabel.fills),
        }),
      );
      run(
        graph,
        resetDescendant({
          ownerId: icon,
          address: label.address,
          scope: "visual",
        }),
      );
      expect(labelNode(graph).visual.borderColor).toBe(definitionBorder);
      expect(labelNode(graph).fills).toEqual(
        typedFills(old.afterReset.icon.label.fills),
      );
    });

    it("inspector-child-edit: turning off a ListBox item's description role", () => {
      const old = oracle("descendant-active/baseline.json");
      const graph = activeGraph();
      run(
        graph,
        setWholeField({
          targets: [
            at(
              list,
              [
                T("listbox-item-default"),
                T("listbox-item-default__description"),
              ],
              [T("listbox__item-1")],
            ),
          ],
          field: "enabled",
          value: old.afterReset.list.description.enabled,
        }),
      );
      const roleName = (item: ResolvedCatalogNode) =>
        item.definitionId === TYPE("Icon")
          ? "Icon"
          : String(item.props.slot).replace(/^./, (c) => c.toUpperCase());
      expect(
        ofType(graph, list, "ListBoxItem").map((item) =>
          item.children.map(roleName),
        ),
      ).toEqual(
        old.reader.listItems.map(
          (item: { childNames: string[] }) => item.childNames,
        ),
      );
    });

    it("canonical-actions (isolated mode B): a replacement for the label position", () => {
      // The old mode B store write had no product caller (coverage manifest: updateDescendant →
      // setFields/setWholeField); the typed model keeps it as a `replace` override transaction.
      const old = oracle("descendant-active/baseline.json");
      const graph = activeGraph();
      applyCatalogTransaction(graph, {
        projectId: graph.projectId,
        expectedRevision: graph.revision,
        history: { kind: "record", label: "replace" },
        ops: [
          {
            kind: "put",
            entry: node("replacement", TYPE("Heading"), {
              props: { children: set("Transient") },
            }),
          },
          {
            kind: "upsertDescendant",
            id: icon,
            override: {
              kind: "replace",
              address: label.address,
              replacementId: id("replacement"),
            },
          },
        ],
      });
      const button = ofType(graph, icon, "Button")[0];
      expect(
        button.children.map((child) => ({
          type:
            child.definitionId === TYPE("Icon")
              ? "Icon"
              : child.definitionId === TYPE("Heading")
                ? "Heading"
                : child.definitionId,
          text: child.props.children ?? null,
        })),
      ).toEqual(
        old.isolatedStoreProbe.oldReader.modeB.map(
          (item: { type: string; text: string | null }) => ({
            type: item.type,
            text: item.text,
          }),
        ),
      );
    });
  });

  describe("IconButton public routes (element-mutation · history-inverse · reset-override)", () => {
    const a = id("a");
    const b = id("b");
    const labelOf = (owner: NodeId) =>
      at(owner, [T("iconbutton"), T("iconbutton__label")]);
    const labelText = (graph: CatalogGraph, owner: NodeId) =>
      bySource(graph, owner, T("iconbutton__label"))?.props.children;
    const setup = () => {
      const graph = graphWith(
        [node("a", ORIGIN("iconbutton")), node("b", ORIGIN("iconbutton"))],
        ["a", "b"],
      );
      run(
        graph,
        setFields({
          targets: [labelOf(a)],
          props: { children: set("Ordered label") },
        }),
      );
      return graph;
    };
    const order = (graph: CatalogGraph) =>
      pageChildren(graph).map((child) => `adr248-ordered-${child.slice(13)}`);

    it("reorder, undo, redo, delete; the layer name survives the reorder", () => {
      const old = routeOutput("publicReorderHistory").reader;
      const graph = setup();
      const newId = allocator();
      run(graph, renameNode({ id: a, name: old.before.storeName }));
      const moved = run(
        graph,
        moveNodes({
          ids: [a],
          parent: { kind: "page", id: PAGE },
          index: 1,
          newId,
        }),
      );
      const name = () => (graph.getEntry(a) as NodeEntry).name;
      expect(order(graph)).toEqual(old.after.siblingOrder);
      expect(labelText(graph, a)).toBe(old.after.label);
      // Old defect: the reorder dropped the layer name (storeName null); the new model keeps it.
      expect(old.after.storeName).toBeNull();
      expect(name()).toBe(old.before.storeName);
      undo(graph, moved.result.inverse);
      expect(order(graph)).toEqual(old.undo.siblingOrder);
      redo(graph, moved.result.forward);
      expect(order(graph)).toEqual(old.redo.siblingOrder);
      run(graph, removeTargets({ targets: [{ kind: "node", id: b }] }));
      expect(order(graph)).toEqual(old.deleted.siblingOrder);
      expect(labelText(graph, a)).toBe(old.deleted.label);
    });

    it("duplicate, copy/paste and detach keep the authored label", () => {
      const old = routeOutput("publicClonePasteDetach").reader;
      const graph = setup();
      const newId = allocator();
      const duplicated = run(graph, duplicateNodes({ ids: [a], newId }));
      const [duplicate] = duplicated.plan.selectAfter!;
      const pasted = run(
        graph,
        pasteNodes({
          clipboard: copyNodes(graph, [a]),
          parent: { kind: "page", id: PAGE },
          newId,
        }),
      );
      const originOf = (target: NodeId) =>
        (graph.getEntry(target) as NodeEntry).definitionId;
      expect(originOf(duplicate)).toBe(OLD_REF(old.duplicate.ref));
      expect(labelText(graph, duplicate)).toBe(old.duplicate.label);
      expect(
        pasted.plan.selectAfter!.map((target) => ({
          ref: originOf(target),
          label: labelText(graph, target),
        })),
      ).toEqual(
        old.pasted.map((item: { ref: string; label: string }) => ({
          ref: OLD_REF(item.ref),
          label: item.label,
        })),
      );
      run(graph, detachInstances({ ids: [duplicate], newId }));
      expect(originOf(duplicate)).toBe(TYPE(old.detached.type));
      expect(
        ofType(graph, duplicate, "Text").map((item) => item.props.children),
      ).toContain(old.duplicate.label);
    });

    it("resetting the label text: undo and redo", () => {
      const old = routeOutput("publicDescendantResetHistory").reader;
      const graph = setup();
      expect(labelText(graph, a)).toBe(old.before);
      const reset = run(
        graph,
        resetDescendant({
          ownerId: a,
          address: labelOf(a).address,
          scope: "props",
          keys: ["children"],
        }),
      );
      expect(labelText(graph, a)).toBe(old.reset);
      undo(graph, reset.result.inverse);
      expect(labelText(graph, a)).toBe(old.undo);
      redo(graph, reset.result.forward);
      expect(labelText(graph, a)).toBe(old.redo);
    });
  });
});

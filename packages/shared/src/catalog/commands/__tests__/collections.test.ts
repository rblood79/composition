import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../document/graph";
import { buildCatalogLibrary } from "../../document/library";
import type {
  CatalogDocument,
  EntryId,
  EntryKind,
  InstanceAddress,
  LibraryDefinition,
  NodeEntry,
  NodeId,
  PageEntry,
  ProjectEntry,
  ValueType,
} from "../../document/types";
import { CatalogValidationError } from "../../document/validation";
import { resolveCatalogNode } from "../../resolution/resolver";
import { applyCatalogTransaction } from "../../transactions/transaction";
import type { CatalogCommand } from "../compose";
import {
  insertCollectionItem,
  insertGroupItem,
  insertTableColumns,
  insertTableRow,
} from "../collections";

/**
 * ADR-248 Phase 4b component-aware item insertion (old Slot "+" planners): Tab ↔ TabPanel
 * pairing, owner selection keys, Tree expansion, group selection normalization and unique Radio
 * values / swatch colors, table columns with row cells — on owned hosts and instance positions.
 */
const primitive = (
  name: string,
  accepts: Record<string, ValueType> = {},
): LibraryDefinition => ({
  id: `lib:definition:${name}` as LibraryDefinition["id"],
  name,
  mode: "primitive",
  bindingId: name.toLowerCase(),
  accepts: { id: "string", ...accepts },
  defaults: {},
  visual: {},
  stateRules: {},
});
const NAMES = [
  ["Tabs", { selectedKey: "string", defaultSelectedKey: "string" }],
  ["TabList", {}],
  ["Tab", { children: "string" }],
  ["TabPanels", {}],
  ["TabPanel", { itemId: "string" }],
  ["ListBox", { selectedKeys: "string[]", selectionMode: "string" }],
  ["ListBoxItem", { children: "string" }],
  ["Tree", { expandedKeys: "string[]" }],
  ["TreeItem", { children: "string" }],
  ["RadioGroup", { value: "string" }],
  ["RadioItems", {}],
  ["Radio", { value: "string", isSelected: "boolean" }],
  ["ColorSwatchPicker", {}],
  ["ColorSwatchPickerItem", { color: "string" }],
  ["ColorSwatch", { color: "string" }],
  ["TableView", {}],
  ["TableHeader", {}],
  ["Column", { key: "string", children: "string" }],
  ["TableBody", {}],
  ["Row", {}],
  ["Cell", { children: "string" }],
] as const;
const library = () =>
  buildCatalogLibrary({
    contractVersion: 23,
    revision: "phase4b-collections",
    bindingIds: [...NAMES.map(([name]) => name.toLowerCase()), "box"],
    actionOpCodes: [],
    definitions: [
      ...NAMES.map(([name, accepts]) =>
        primitive(name, accepts as Record<string, ValueType>),
      ),
      {
        id: "lib:definition:TabsBox",
        name: "TabsBox",
        mode: "composite",
        templateRootId: "lib:template:tabs",
        accepts: {},
        defaults: {},
        visual: {},
        stateRules: {},
      },
      {
        id: "lib:definition:Choice",
        name: "Choice",
        mode: "composite",
        templateRootId: "lib:template:group",
        accepts: {},
        defaults: {},
        visual: {},
        stateRules: {},
      },
    ],
    templates: [
      tpl("tabs", "Tabs", ["lib:template:tablist", "lib:template:panels"]),
      tpl("tablist", "TabList", ["lib:template:tab1"]),
      tpl("tab1", "Tab", [], { id: "a", children: "Tab A" }),
      tpl("panels", "TabPanels", ["lib:template:panel1"]),
      tpl("panel1", "TabPanel", [], { itemId: "a" }),
      // ADR-251: the Radios sit in the RadioItems wrapper.
      tpl("group", "RadioGroup", ["lib:template:items"], {
        value: "option1",
      }),
      tpl("items", "RadioItems", ["lib:template:r1", "lib:template:r2"]),
      tpl("r1", "Radio", [], { value: "option1", isSelected: true }),
      tpl("r2", "Radio", [], { value: "option2" }),
    ],
    tokens: [],
  });
function tpl(
  id: string,
  type: string,
  children: string[],
  props: Record<string, string | boolean> = {},
) {
  return {
    id: `lib:template:${id}` as `lib:template:${string}`,
    definitionId: `lib:definition:${type}` as `lib:definition:${string}`,
    children: children as `lib:template:${string}`[],
    props,
    visual: {},
  };
}
const PAGE = "project:page:main" as const;
const node = (
  id: string,
  type: string,
  children: string[] = [],
  props: Record<string, unknown> = {},
): NodeEntry => ({
  kind: "node",
  id: `project:node:${id}` as NodeId,
  definitionId: `lib:definition:${type}` as NodeEntry["definitionId"],
  children: children.map((child) => `project:node:${child}` as NodeId),
  props: Object.fromEntries(
    Object.entries(props).map(([key, value]) => [
      key,
      { kind: "set", value: value as never },
    ]),
  ),
  visual: {},
  sizing: {},
  descendantOverrides: [],
});
function graphOf(nodes: NodeEntry[], roots: string[]) {
  const document: CatalogDocument = {
    format: "composition-catalog",
    schemaVersion: 1,
    libraryContractVersion: 23,
    revision: 0,
    projectId: "project:project:p",
    rootId: "project:project:p",
    entries: Object.fromEntries(
      [
        {
          kind: "project",
          id: "project:project:p",
          name: "p",
          pageIds: [PAGE],
          definitionIds: [],
          overrideIds: [],
          themeIds: [],
          tokenIds: [],
          stateVariableIds: [],
          interactionIds: [],
          assetIds: [],
        } as ProjectEntry,
        {
          kind: "page",
          id: PAGE,
          route: "/",
          name: "main",
          children: roots.map((id) => `project:node:${id}` as NodeId),
        } as PageEntry,
        ...nodes,
      ].map((entry) => [entry.id, entry]),
    ),
  };
  return new CatalogGraph(document, library());
}
const allocator = () => {
  let next = 0;
  return <K extends EntryKind>(kind: K) =>
    `project:${kind}:n${++next}` as EntryId<K>;
};
function run(graph: CatalogGraph, command: CatalogCommand) {
  const plan = command(graph);
  return applyCatalogTransaction(graph, {
    projectId: graph.projectId,
    expectedRevision: graph.revision,
    history: { kind: "record", label: plan.label },
    ops: plan.ops,
  });
}
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    if (error instanceof CatalogValidationError) return error.code;
    throw error;
  }
  return "ACCEPTED";
};
const props = (graph: CatalogGraph, id: string) =>
  resolveCatalogNode(graph, id as NodeId).props;
const childProps = (graph: CatalogGraph, id: string, key: string) =>
  resolveCatalogNode(graph, id as NodeId).children.map(
    (child) => child.props[key],
  );

describe("ADR-248 Phase 4b component-aware item insertion", () => {
  it("adds a Tab with its TabPanel and selects it (owned Tabs)", () => {
    const graph = graphOf(
      [
        node("tabs", "Tabs", ["list", "panels"]),
        node("list", "TabList", ["t1"]),
        node("t1", "Tab", [], { id: "a" }),
        node("panels", "TabPanels", ["p1"]),
        node("p1", "TabPanel", [], { itemId: "a" }),
      ],
      ["tabs"],
    );
    const result = run(
      graph,
      insertCollectionItem({
        host: { kind: "node", id: "project:node:list" },
        entries: [node("t2", "Tab", [], { id: "b", children: "Tab B" })],
        rootId: "project:node:t2",
        key: "b",
        selectItem: true,
        panel: node("p2", "TabPanel", [], { itemId: "b" }),
        newId: allocator(),
      }),
    );
    expect(result.impact.structural).toBe(true);
    expect(childProps(graph, "project:node:list", "id")).toEqual(["a", "b"]);
    expect(childProps(graph, "project:node:panels", "itemId")).toEqual([
      "a",
      "b",
    ]);
    expect(props(graph, "project:node:tabs").selectedKey).toBe("b");
    expect(
      code(() =>
        insertCollectionItem({
          host: { kind: "node", id: "project:node:list" },
          entries: [node("t3", "Tab", [], { id: "c" })],
          rootId: "project:node:t3",
          key: "c",
          newId: allocator(),
        })(graph),
      ),
    ).toBe("TAB_PANEL_REQUIRED");
  });

  it("adds a Tab inside a Tabs instance: both list positions become the instance's own", () => {
    const graph = graphOf([node("inst", "TabsBox")], ["inst"]);
    const tablist: InstanceAddress = {
      instances: ["project:node:inst"],
      templatePath: ["lib:template:tabs", "lib:template:tablist"],
    };
    run(
      graph,
      insertCollectionItem({
        host: {
          kind: "descendant",
          ownerId: "project:node:inst",
          address: tablist,
        },
        entries: [node("t2", "Tab", [], { id: "b", children: "Tab B" })],
        rootId: "project:node:t2",
        key: "b",
        selectItem: true,
        panel: node("p2", "TabPanel", [], { itemId: "b" }),
        newId: allocator(),
      }),
    );
    const [tabs] = resolveCatalogNode(graph, "project:node:inst").children;
    const [list, panels] = tabs.children;
    expect(list.children.map((tab) => tab.props.children)).toEqual([
      "Tab A",
      "Tab B",
    ]);
    expect(panels.children.map((panel) => panel.props.itemId)).toEqual([
      "a",
      "b",
    ]);
    expect(tabs.props.selectedKey).toBe("b");
  });

  it("adds the key to a ListBox's multiple selection, and expands the Tree host item", () => {
    const graph = graphOf(
      [
        node("list", "ListBox", ["i1"], {
          selectedKeys: ["x"],
          selectionMode: "multiple",
        }),
        node("i1", "ListBoxItem", [], { id: "x" }),
        node("tree", "Tree", ["ti"]),
        node("ti", "TreeItem", [], { id: "root" }),
        node("lone", "TreeItem", [], { id: "lone" }),
      ],
      ["list", "tree", "lone"],
    );
    run(
      graph,
      insertCollectionItem({
        host: { kind: "node", id: "project:node:list" },
        entries: [node("i2", "ListBoxItem", [], { id: "y" })],
        rootId: "project:node:i2",
        key: "y",
        selectItem: true,
        newId: allocator(),
      }),
    );
    expect(props(graph, "project:node:list").selectedKeys).toEqual(["x", "y"]);
    run(
      graph,
      insertCollectionItem({
        host: { kind: "node", id: "project:node:ti" },
        entries: [node("child", "TreeItem", [], { id: "leaf" })],
        rootId: "project:node:child",
        key: "leaf",
        selectItem: true,
        newId: allocator(),
      }),
    );
    expect(props(graph, "project:node:tree").expandedKeys).toEqual(["root"]);
    expect(
      code(() =>
        insertCollectionItem({
          host: { kind: "node", id: "project:node:lone" },
          entries: [node("x2", "TreeItem", [], { id: "x2" })],
          rootId: "project:node:x2",
          key: "x2",
          newId: allocator(),
        })(graph),
      ),
    ).toBe("TREE_ITEM_OUTSIDE_TREE");
  });

  it("adds a selected Radio: unique value, siblings cleared, group value moves (owned and instance)", () => {
    const graph = graphOf(
      [
        node("group", "RadioGroup", ["items"], { value: "option1" }),
        node("items", "RadioItems", ["r1", "r2"]),
        node("r1", "Radio", [], { value: "option1", isSelected: true }),
        node("r2", "Radio", [], { value: "option2" }),
        node("choice", "Choice"),
        node("swatches", "ColorSwatchPicker", ["s1"]),
        node("s1", "ColorSwatchPickerItem", ["s1-swatch"], {
          color: "#ff0000",
        }),
        node("s1-swatch", "ColorSwatch", []),
      ],
      ["group", "choice", "swatches"],
    );
    run(
      graph,
      insertGroupItem({
        hostId: "project:node:group",
        entries: [node("r3", "Radio", [], { isSelected: true })],
        rootId: "project:node:r3",
        newId: allocator(),
      }),
    );
    expect(childProps(graph, "project:node:items", "value")).toEqual([
      "option1",
      "option2",
      "option3",
    ]);
    expect(childProps(graph, "project:node:items", "isSelected")).toEqual([
      false,
      undefined,
      true,
    ]);
    expect(props(graph, "project:node:group").value).toBe("option3");
    // Instance host: the new Radio goes into the template wrapper (its items become the
    // instance's own nodes) and the inherited selected Radio is cleared.
    run(
      graph,
      insertGroupItem({
        hostId: "project:node:choice",
        entries: [node("c3", "Radio", [], { isSelected: true })],
        rootId: "project:node:c3",
        newId: allocator(),
      }),
    );
    const choice = resolveCatalogNode(graph, "project:node:choice");
    // Choice > RadioGroup root > RadioItems (filled) > the three Radios.
    const wrapper = choice.children[0].children;
    expect(wrapper.length).toBe(1);
    const radios = wrapper[0].children;
    expect(radios.map((radio) => radio.props.isSelected)).toEqual([
      false,
      undefined,
      true,
    ]);
    expect(radios.map((radio) => radio.props.value)).toEqual([
      "option1",
      "option2",
      "option3",
    ]);
    run(
      graph,
      insertGroupItem({
        hostId: "project:node:swatches",
        entries: [node("s2", "ColorSwatchPickerItem")],
        rootId: "project:node:s2",
        // (Its own ids: the item's new ColorSwatch takes one.)
        newId: (
          (next = allocator()) =>
          (kind: EntryKind) =>
            `${next(kind)}-swatch` as never
        )(),
      }),
    );
    expect(childProps(graph, "project:node:swatches", "color")).toEqual([
      "#ff0000",
      "#00FF00",
    ]);
    // ADR-256 Phase 5b: the new item holds the reference's ColorSwatch.
    const added = graph.getEntry("project:node:s2");
    expect(added?.kind === "node" && added.children.length).toBe(1);
  });

  it("adds table columns with a cell per row, replaces columns, and adds aligned rows", () => {
    const graph = graphOf(
      [
        node("view", "TableView", ["header", "body"]),
        node("header", "TableHeader", ["c1"]),
        node("c1", "Column", [], { key: "name", children: "Name" }),
        node("body", "TableBody", ["row1"]),
        node("row1", "Row", ["cell1"]),
        node("cell1", "Cell", [], { children: "Ada" }),
      ],
      ["view"],
    );
    const newId = allocator();
    let n = 0;
    const buildColumn = () => {
      const column = node(`col${++n}`, "Column");
      return { entries: [column], rootId: column.id };
    };
    const buildCell = () => {
      const cell = node(`cell-new${++n}`, "Cell", [], { children: "" });
      return { entries: [cell], rootId: cell.id };
    };
    run(
      graph,
      insertTableColumns({
        header: { kind: "node", id: "project:node:header" },
        buildColumn,
        buildCell,
        newId,
      }),
    );
    expect(childProps(graph, "project:node:header", "key")).toEqual([
      "name",
      "column2",
    ]);
    expect(childProps(graph, "project:node:header", "children")).toEqual([
      "Name",
      "Column 2",
    ]);
    expect(
      (graph.getEntry("project:node:row1") as NodeEntry).children,
    ).toHaveLength(2);
    run(
      graph,
      insertTableRow({
        body: { kind: "node", id: "project:node:body" },
        buildRow: (count) => {
          const cells = Array.from({ length: count }, () =>
            node(`rc${++n}`, "Cell", [], { children: "" }),
          );
          const row = node(
            `r${++n}`,
            "Row",
            cells.map((cell) => cell.id.slice(13)),
          );
          return { entries: [row, ...cells], rootId: row.id };
        },
        newId,
      }),
    );
    const rows = (graph.getEntry("project:node:body") as NodeEntry).children;
    expect(rows).toHaveLength(2);
    expect((graph.getEntry(rows[1]) as NodeEntry).children).toHaveLength(2);
    run(
      graph,
      insertTableColumns({
        header: { kind: "node", id: "project:node:header" },
        columns: [{ key: "email", label: "Email" }],
        replace: true,
        buildColumn,
        buildCell,
        newId,
      }),
    );
    expect(childProps(graph, "project:node:header", "key")).toEqual(["email"]);
    expect(graph.getEntry("project:node:c1")).toBeUndefined();
    // Replacing columns leaves rows with two cells for one column: rows no longer align.
    expect(
      code(() =>
        insertTableRow({
          body: { kind: "node", id: "project:node:body" },
          buildRow: () => ({ entries: [], rootId: "project:node:none" }),
          newId,
        })(graph),
      ),
    ).toBe("TABLE_ROWS_NOT_ALIGNED");
  });
});

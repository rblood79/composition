import { beforeAll, describe, expect, it } from "vitest";
import {
  buildCodeCatalogLibrary,
  catalogTypeDefinitionId,
} from "../../document/codeCatalogLibrary";
import { CatalogGraph } from "../../document/graph";
import type {
  CatalogLibrary,
  NodeEntry,
  NodeId,
  TemplateId,
} from "../../document/types";
import {
  resolveCatalogNode,
  type ResolvedCatalogNode,
} from "../../resolution/resolver";
import {
  insertCollectionItem,
  insertGroupItem,
  insertTableColumns,
} from "../collections";
import { allocator, documentOf, node, run } from "./fixture";

/**
 * ADR-248 Phase 4b item commands on the code catalog library's origins (the G0 descendant route
 * shapes without the local-only baseline): collection keys are accepted props, a Table header
 * position takes its own columns, and a RadioGroup origin's radios (a `selected` state origin)
 * lose the selection a new selected radio takes.
 */
let library: CatalogLibrary;
beforeAll(async () => {
  library = await buildCodeCatalogLibrary();
});
const graphWith = (roots: NodeEntry[]) =>
  new CatalogGraph(
    documentOf(
      roots,
      roots.map((root) => root.id.slice("project:node:".length)),
    ),
    library,
  );
const id = (name: string) => `project:node:${name}` as NodeId;
const set = <T>(value: T) => ({ kind: "set" as const, value });
const T = (name: string) => `lib:template:component-${name}` as TemplateId;
const ORIGIN = (name: string) =>
  `lib:definition:origin-component-${name}` as NodeEntry["definitionId"];
const TYPE = (name: string) =>
  catalogTypeDefinitionId(name) as NodeEntry["definitionId"];
const all = (root: ResolvedCatalogNode): ResolvedCatalogNode[] => [
  root,
  ...root.children.flatMap(all),
];
const ofType = (graph: CatalogGraph, rootId: NodeId, type: string) =>
  all(resolveCatalogNode(graph, rootId)).filter(
    (item) => item.definitionId === TYPE(type),
  );

describe("ADR-248 Phase 4b item commands on code library origins", () => {
  it("accepts collection keys on items, panels, columns and selection owners", () => {
    const accepts = (type: string) =>
      library.definitions.get(TYPE(type) as never)!.accepts;
    expect(accepts("Tab").id).toBe("string");
    expect(accepts("ListBoxItem").id).toBe("string");
    expect(accepts("TabPanel").itemId).toBe("string");
    expect(accepts("Column").key).toBe("string");
    expect(accepts("Tabs").selectedKey).toBe("string");
    expect(accepts("ListBox").selectedKeys).toBe("string[]");
    expect(accepts("Tree").expandedKeys).toBe("string[]");
  });

  it("adds a keyed Tab with its TabPanel and selects it in a Tabs origin instance", () => {
    const tabs = id("tabs");
    const graph = graphWith([node("tabs", ORIGIN("tabs"))]);
    run(
      graph,
      insertCollectionItem({
        host: {
          kind: "descendant",
          ownerId: tabs,
          address: {
            instances: [tabs],
            templatePath: [T("tabs"), T("tabs__1")],
          },
        },
        entries: [
          node("tab3", ORIGIN("tab-item-default"), {
            props: { id: set("k3") },
          }),
        ],
        rootId: id("tab3"),
        key: "k3",
        selectItem: true,
        panel: node("panel3", TYPE("TabPanel"), {
          props: { itemId: set("k3") },
        }),
        newId: allocator(),
      }),
    );
    expect(ofType(graph, tabs, "Tab").map((tab) => tab.props.id)).toEqual([
      undefined,
      undefined,
      "k3",
    ]);
    expect(ofType(graph, tabs, "TabPanel").at(-1)?.props.itemId).toBe("k3");
    expect(ofType(graph, tabs, "Tabs")[0].props.selectedKey).toBe("k3");
  });

  it("adds a column to a Table origin instance's header position", () => {
    const table = id("table");
    const graph = graphWith([node("table", ORIGIN("table"))]);
    run(
      graph,
      insertTableColumns({
        header: {
          kind: "descendant",
          ownerId: table,
          address: {
            instances: [table],
            templatePath: [T("table"), T("table__1")],
          },
        },
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
      ofType(graph, table, "Column").map((column) => [
        column.props.key,
        column.props.children,
      ]),
    ).toEqual([["column1", "Column 1"]]);
  });

  it("a new selected Radio clears the radios a `selected` state origin shows", () => {
    const group = id("group");
    const graph = graphWith([node("group", ORIGIN("radiogroup"))]);
    // The Radio origin template displays `selected`, but inside its RadioGroup a Radio's selection
    // is the group's value (ADR-256 후속 7): none shows selected.
    expect(
      ofType(graph, group, "Radio").map((radio) => radio.props.isSelected),
    ).toEqual([false, false]);
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
    expect(
      ofType(graph, group, "Radio").map((radio) => [
        radio.props.value,
        radio.props.isSelected,
      ]),
    ).toEqual([
      ["option1", false],
      ["option2", false],
      ["option3", true],
    ]);
    expect(ofType(graph, group, "RadioGroup")[0].props.value).toBe("option3");
  });
});

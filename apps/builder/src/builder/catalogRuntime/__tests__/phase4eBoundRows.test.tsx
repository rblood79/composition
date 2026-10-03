import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  DataBindingRef,
  DefinitionId,
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import type { CatalogBoundRow } from "../../../../../../packages/shared/src/catalog/resolution/resolver";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { catalogBoundRows } from "../dataBinding";
import { catalogBindingCommand } from "../dataBindingCommand";
import { catalogItemRoleCommand, catalogItemRoles } from "../itemRoles";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands";
import {
  CATALOG_ROW_SEPARATOR,
  type CatalogConsumerNode,
} from "../compositionRoot";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 Phase 4e-4e bound rows: a bound ListBox/GridList repeats its first item position per
 * data row (row values fill its `{field}` templates; the sample items go), in the shared
 * resolution both consumers read; a data store change re-resolves the bound roots without a
 * document step; a row record maps back to the row template position.
 */
const BODY = "project:node:home-body" as NodeId;
const LIST = "project:node:list" as NodeId;
const BINDING: DataBindingRef = {
  collectionId: "data:collection:c1" as DataBindingRef["collectionId"],
  fieldMap: {},
};
const row = (
  key: string,
  label: string,
  description = "",
): CatalogBoundRow => ({
  key,
  values: { id: key, label, description, icon: "", value: key },
});

/** A collection's own records (a Chart's data): raw fields, no item reader. */
const RECORDS: CatalogBoundRow[] = [
  { key: "0", values: { category: "Q1", value: 12, series: "A" } },
  { key: "1", values: { category: "Q2", value: 30, series: "A" } },
  { key: "2", values: { category: "Q3", value: 7, series: "A" } },
];

async function open(type: string, bound = true) {
  const library = await buildCodeCatalogLibrary();
  let rows: CatalogBoundRow[] | undefined = [
    row("a", "Alpha", "first"),
    row("b", "Beta", "second"),
  ];
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:rows" as EntryId<"project">,
        name: "Rows",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr248-phase4e-rows-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
      root: {
        rows: (binding, kind) =>
          binding.collectionId !== BINDING.collectionId
            ? undefined
            : kind === "records"
              ? RECORDS
              : rows,
      },
    },
  );
  const node: NodeEntry = {
    kind: "node",
    id: LIST,
    definitionId: catalogPaletteDefinitionId(library, type),
    children: [],
    props: {},
    visual: {},
    sizing: {},
    descendantOverrides: [],
    ...(bound ? { binding: BINDING } : {}),
  };
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [node],
      rootIds: [LIST],
      newId: workspace.newId,
    }),
  );
  return {
    workspace,
    setRows: (next: CatalogBoundRow[] | undefined) => {
      rows = next;
    },
  };
}

const typeOf = (workspace: CatalogWorkspace, record: CatalogConsumerNode) =>
  workspace.runtime.graph.getDefinition(record.definitionId as DefinitionId)
    ?.name ?? "";
/** The item records of the list (in order) with their label text. */
function items(workspace: CatalogWorkspace, itemType = "ListBoxItem") {
  const records = workspace.root.domInputs;
  const [list] = workspace.root.recordsOfSource(LIST);
  const out: { id: string; key: unknown; texts: string[] }[] = [];
  const visit = (id: string) => {
    const record = records.get(id);
    if (!record) return;
    if (typeOf(workspace, record) === itemType) {
      const texts: string[] = [];
      const collect = (childId: string) => {
        const child = records.get(childId);
        if (!child) return;
        if (typeof child.props.children === "string" && child.id !== id)
          texts.push(child.props.children);
        child.children.forEach(collect);
      };
      record.children.forEach(collect);
      out.push({ id, key: record.props.id, texts });
      return;
    }
    record.children.forEach(visit);
  };
  visit(list!);
  return out;
}

describe("ADR-248 Phase 4e-4e bound rows", () => {
  it("a bound ListBox repeats its row template per row: row values fill {label}/{description}, sample items go, the first row keeps the template identity", async () => {
    const { workspace } = await open("ListBox");
    const shown = items(workspace);
    expect(shown.map((item) => [item.key, item.texts])).toEqual([
      ["a", ["Alpha", "first"]],
      ["b", ["Beta", "second"]],
    ]);
    expect(shown[0]!.id).not.toContain(CATALOG_ROW_SEPARATOR);
    expect(shown[1]!.id).toContain(`${CATALOG_ROW_SEPARATOR}b`);
    // Both rows are the row template position's records; the Layers position of a row is it.
    const template = workspace.positionOfRecord(shown[0]!.id)!;
    expect(workspace.positionOfRecord(shown[1]!.id)?.identity).toBe(
      template.identity,
    );
  });

  it("without a binding (or with rows unknown) the template's sample items show", async () => {
    const plain = await open("ListBox", false);
    expect(items(plain.workspace).map((item) => item.texts[0])).toEqual([
      "Inbox",
      "Starred",
      "Archive",
    ]);
    const unknown = await open("ListBox");
    unknown.setRows(undefined);
    unknown.workspace.refreshRows(["c1"]);
    expect(items(unknown.workspace)).toHaveLength(3);
  });

  it("a data change re-resolves the bound root without a document step; row listeners follow", async () => {
    const { workspace, setRows } = await open("ListBox");
    const revision = workspace.runtime.graph.revision;
    let notified = 0;
    workspace.subscribeRows(() => notified++);
    setRows([row("c", "Gamma"), row("a", "Alpha 2"), row("d", "Delta")]);
    workspace.refreshRows(["c1"]);
    expect(items(workspace).map((item) => [item.key, item.texts[0]])).toEqual([
      ["c", "Gamma"],
      ["a", "Alpha 2"],
      ["d", "Delta"],
    ]);
    expect(workspace.runtime.graph.revision).toBe(revision);
    expect(notified).toBe(1);
    // Another collection's change leaves it alone.
    setRows([]);
    workspace.refreshRows(["other"]);
    expect(items(workspace)).toHaveLength(3);
    workspace.refreshRows(["c1"]);
    expect(items(workspace)).toHaveLength(0);
  });

  it("binding a collection is a structural step (rows appear), undo shows the sample items again", async () => {
    const { workspace } = await open("ListBox", false);
    workspace.execute(
      catalogBindingCommand([{ kind: "node", id: LIST }], BINDING),
    );
    expect(items(workspace).map((item) => item.texts[0])).toEqual([
      "Alpha",
      "Beta",
    ]);
    workspace.undo();
    expect(items(workspace)).toHaveLength(3);
  });

  it("a bound GridList repeats its item template too", async () => {
    const { workspace } = await open("GridList");
    const shown = items(workspace, "GridListItem");
    expect(shown.map((item) => item.key)).toEqual(["a", "b"]);
    expect(shown[1]!.texts).toContain("Beta");
  });

  it("the data store rows: projection rows with label heuristics and field roles; unknown collection = undefined", () => {
    const collections = [
      {
        id: "c1",
        name: "Users",
        schema: [
          { id: "f1", key: "id" },
          { id: "f2", key: "name" },
        ],
        mockData: [
          { id: 1, name: "Ann" },
          { id: 2, name: "Bob" },
          { id: 2, name: "Bea" },
        ],
        useMockData: true,
      },
    ];
    const rows = catalogBoundRows(BINDING, collections)!;
    expect(rows.map((item) => [item.key, item.values.label])).toEqual([
      ["1", "Ann"],
      ["2", "Bob"],
      ["2~2", "Bea"],
    ]);
    expect(rows[0]!.values.name).toBe("Ann");
    expect(
      catalogBoundRows(
        { ...BINDING, collectionId: "data:collection:nope" as never },
        collections,
      ),
    ).toBeUndefined();
  });

  it("edits keep the rows: a value edit on the bound list (fast path), and a role switched off on the row template reaches every row", async () => {
    const { workspace } = await open("ListBox");
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: LIST }],
        props: { selectionMode: { kind: "set", value: "multiple" } },
      }),
    );
    expect(items(workspace).map((item) => item.key)).toEqual(["a", "b"]);
    const first = items(workspace)[0]!;
    const position = workspace.positionOfRecord(first.id)!;
    const icon = catalogItemRoles(workspace.runtime.graph, position)!.rows.find(
      (entry) => entry.role === "icon",
    )!;
    const iconsBefore = [...workspace.root.domInputs.values()].filter(
      (record) => typeOf(workspace, record) === "Icon",
    ).length;
    workspace.execute(catalogItemRoleCommand(icon, false));
    const iconsAfter = [...workspace.root.domInputs.values()].filter(
      (record) => typeOf(workspace, record) === "Icon",
    ).length;
    expect(iconsBefore - iconsAfter).toBe(2);
    expect(items(workspace).map((item) => item.texts[0])).toEqual([
      "Alpha",
      "Beta",
    ]);
  });

  it("a bound TagGroup repeats its first Tag under the TagList (the rows pass the TagList part)", async () => {
    const { workspace } = await open("TagGroup");
    const shown = items(workspace, "Tag");
    expect(shown.map((item) => [item.key, item.texts[0]])).toEqual([
      ["a", "Alpha"],
      ["b", "Beta"],
    ]);
    // The group's own label is the group's, not a row's.
    const [group] = workspace.root.recordsOfSource(LIST);
    const label = workspace.root.domInputs.get(
      workspace.root.domInputs.get(group!)!.children[0]!,
    )!;
    expect(label.props.children).toBe("Tag Group");
    const plain = await open("TagGroup", false);
    expect(items(plain.workspace, "Tag").map((item) => item.texts[0])).toEqual([
      "Chocolate",
      "Mint",
      "Strawberry",
      "Vanilla",
    ]);
  });

  it("a bound Breadcrumbs shows one crumb per row with the row's label (the item label is literal text)", async () => {
    const { workspace } = await open("Breadcrumbs");
    const shown = items(workspace, "Breadcrumb");
    expect(shown.map((item) => [item.key, item.texts[0]])).toEqual([
      ["a", "Alpha"],
      ["b", "Beta"],
    ]);
    const plain = await open("Breadcrumbs", false);
    expect(
      items(plain.workspace, "Breadcrumb").map((item) => item.texts[0]),
    ).toEqual(["Home", "Category", "Page"]);
  });

  it("a bound Chart reads the collection's records as its data (raw fields, not the item reader's)", async () => {
    const { workspace } = await open("Chart");
    const records = workspace.root.domInputs;
    const chart = [...records.values()].find(
      (record) => typeOf(workspace, record) === "Chart" && record.ruleId,
    )!;
    expect(chart.props.data).toEqual(RECORDS.map((record) => record.values));
    const plain = await open("Chart", false);
    const sample = [...plain.workspace.root.domInputs.values()].find(
      (record) => typeOf(plain.workspace, record) === "Chart" && record.ruleId,
    )!;
    expect(sample.props.data).not.toEqual(chart.props.data);
  });

  it("records kind: every raw record, no item reader fields", () => {
    const collections = [
      {
        id: "c1",
        name: "Sales",
        schema: [
          { id: "f1", key: "category" },
          { id: "f2", key: "value" },
        ],
        mockData: Array.from({ length: 150 }, (_, index) => ({
          category: `C${index}`,
          value: index,
        })),
      },
    ] as never;
    const records = catalogBoundRows(BINDING, collections, "records")!;
    expect(records).toHaveLength(150);
    expect(records[3]!.values).toEqual({ category: "C3", value: 3 });
    const items = catalogBoundRows(BINDING, collections)!;
    expect(items).toHaveLength(100);
    // The window holds 100; the collection's count goes with them (the sample's "+N more").
    expect(items.total).toBe(150);
  });
});

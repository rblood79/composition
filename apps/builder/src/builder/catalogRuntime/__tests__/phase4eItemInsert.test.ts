import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { definitionTypeName } from "../../../../../../packages/shared/src/catalog/commands/context";
import type {
  DefinitionId,
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import type { CatalogConsumerNode } from "../compositionRoot";
import { catalogItemInsertChoices } from "../itemInsert";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 4e: the old Properties slot section's "+" — a list frame, a group, a TableHeader and a
 * TableBody each offer their item types, and "+" adds one item as one history step (a Tab with
 * its TabPanel, a Radio with an unused value, a column with a cell per row, a row with a cell per
 * column). Other elements offer nothing.
 */
const BODY = "project:node:home-body" as NodeId;
const HOST = "project:node:host" as NodeId;

async function open(type: string) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:item-insert" as EntryId<"project">,
        name: "Item insert",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr248-4e-item-insert-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  const node: NodeEntry = {
    kind: "node",
    id: HOST,
    definitionId: catalogPaletteDefinitionId(library, type),
    children: [],
    props: {},
    visual: {},
    sizing: {},
    descendantOverrides: [],
  };
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [node],
      rootIds: [HOST],
      newId: workspace.newId,
    }),
  );
  return workspace;
}

const typeOf = (workspace: CatalogWorkspace, record: CatalogConsumerNode) =>
  definitionTypeName(
    workspace.runtime.graph,
    record.definitionId as DefinitionId,
  );
/** The first record of a type in the host's subtree (the host itself included). */
function recordOf(workspace: CatalogWorkspace, type: string) {
  const records = workspace.root.domInputs;
  const find = (id: string): CatalogConsumerNode | undefined => {
    const record = records.get(id);
    if (!record) return undefined;
    if (typeOf(workspace, record) === type) return record;
    for (const child of record.children) {
      const found = find(child);
      if (found) return found;
    }
    return undefined;
  };
  return find(workspace.root.recordsOfSource(HOST)[0]!)!;
}
const childTypes = (workspace: CatalogWorkspace, type: string) =>
  recordOf(workspace, type).children.map((id) =>
    typeOf(workspace, workspace.root.domInputs.get(id)!),
  );
function choicesOf(workspace: CatalogWorkspace, type: string) {
  const position = workspace.positionOfRecord(recordOf(workspace, type).id)!;
  return catalogItemInsertChoices(
    {
      graph: workspace.runtime.graph,
      readModel: workspace.readModel,
      newId: workspace.newId,
    },
    position,
  );
}
function add(workspace: CatalogWorkspace, host: string, itemType: string) {
  const choice = choicesOf(workspace, host).find(
    (item) => item.type === itemType,
  )!;
  const before = workspace.history.getSnapshot().labels.length;
  workspace.execute(choice.build());
  expect(workspace.history.getSnapshot().labels.length).toBe(before + 1);
}

describe("ADR-248 4e item insert ('+')", () => {
  it("a ListBox adds an item (a new key) or a section", async () => {
    const workspace = await open("ListBox");
    expect(choicesOf(workspace, "ListBox").map((item) => item.type)).toEqual([
      "ListBoxItem",
      "ListBoxSection",
    ]);
    const before = childTypes(workspace, "ListBox");
    add(workspace, "ListBox", "ListBoxItem");
    expect(childTypes(workspace, "ListBox")).toEqual([
      ...before,
      "ListBoxItem",
    ]);
    const ids = recordOf(workspace, "ListBox").children.map(
      (id) => workspace.root.domInputs.get(id)!.props.id,
    );
    // The new item reads "Item <n>" (its description and icon parts hidden), not the bare
    // `{label}` · `{description}` · `{icon}` row placeholders.
    const items = recordOf(workspace, "ListBox").children;
    const added = workspace.root.domInputs.get(items[items.length - 1]!)!;
    const parts = added.children.map((id) => workspace.root.domInputs.get(id)!);
    expect(
      parts.map((part) => part.props.children ?? part.props.iconName),
    ).toEqual([`Item ${items.length}`]);
    expect(
      Object.values(added.props).some(
        (value) => typeof value === "string" && value.includes("{"),
      ),
    ).toBe(false);
    // Every item has a collection key (the new one a fresh id), none shared.
    expect(ids.every((id) => typeof id === "string" && id !== "")).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    workspace.dispose();
  });

  it("a TabList adds a Tab with its TabPanel", async () => {
    const workspace = await open("Tabs");
    const tabs = childTypes(workspace, "TabList").length;
    const panels = childTypes(workspace, "TabPanels").length;
    add(workspace, "TabList", "Tab");
    expect(childTypes(workspace, "TabList")).toHaveLength(tabs + 1);
    expect(childTypes(workspace, "TabPanels")).toHaveLength(panels + 1);
    const list = recordOf(workspace, "TabList").children;
    const tab = workspace.root.domInputs.get(list[list.length - 1]!)!;
    const texts = [
      tab,
      ...tab.children.map((id) => workspace.root.domInputs.get(id)!),
    ]
      .flatMap((record) => [record.props.children, record.props.title])
      .filter((value) => typeof value === "string");
    expect(texts).toContain(`Tab ${tabs + 1}`);
    expect(texts.some((text) => String(text).includes("{"))).toBe(false);
    workspace.dispose();
  });

  it("a RadioGroup adds a Radio with a value its siblings do not use", async () => {
    const workspace = await open("RadioGroup");
    expect(choicesOf(workspace, "RadioGroup").map((item) => item.type)).toEqual(
      ["Radio"],
    );
    // ADR-251: the items sit in the RadioItems node, which offers the same "+".
    expect(choicesOf(workspace, "RadioItems").map((item) => item.type)).toEqual(
      ["Radio"],
    );
    const values = () =>
      recordOf(workspace, "RadioItems")
        .children.map((id) => workspace.root.domInputs.get(id)!)
        .filter((record) => typeOf(workspace, record) === "Radio")
        .map((record) => record.props.value);
    expect(values()).toEqual(["option1", "option2"]);
    // Two adds in a row (the first materializes the template items into the instance's own
    // nodes): each new Radio takes a value its siblings do not use, inside the wrapper.
    add(workspace, "RadioGroup", "Radio");
    add(workspace, "RadioItems", "Radio");
    expect(values()).toEqual(["option1", "option2", "option3", "option4"]);
    expect(childTypes(workspace, "RadioGroup")).toEqual([
      "Label",
      "RadioItems",
      // ADR-253: the group's hint parts (instances of the Description · FieldError origins).
      "Description",
      "FieldError",
    ]);
    workspace.dispose();
  });

  it("a CheckboxGroup adds a Checkbox inside its CheckboxItems (ADR-251)", async () => {
    const workspace = await open("CheckboxGroup");
    const before = childTypes(workspace, "CheckboxItems").length;
    add(workspace, "CheckboxItems", "Checkbox");
    add(workspace, "CheckboxGroup", "Checkbox");
    expect(childTypes(workspace, "CheckboxItems")).toEqual(
      Array.from({ length: before + 2 }, () => "Checkbox"),
    );
    expect(childTypes(workspace, "CheckboxGroup")).toEqual([
      "Label",
      "CheckboxItems",
      // ADR-253: the group's hint parts (instances of the Description · FieldError origins).
      "Description",
      "FieldError",
    ]);
    workspace.dispose();
  });

  it("a Table's header adds a column; its data body takes no rows (the old rule: TableView only)", async () => {
    const workspace = await open("Table");
    const columns = childTypes(workspace, "TableHeader").length;
    add(workspace, "TableHeader", "Column");
    expect(childTypes(workspace, "TableHeader")).toHaveLength(columns + 1);
    expect(choicesOf(workspace, "TableBody")).toEqual([]);
    workspace.dispose();
  });

  it("a TableView body adds a row with a cell per column; a new column gives every row a cell", async () => {
    const workspace = await open("TableView");
    const columns = childTypes(workspace, "TableHeader").length;
    const rows = childTypes(workspace, "TableBody").length;
    add(workspace, "TableBody", "Row");
    const body = () => recordOf(workspace, "TableBody").children;
    expect(body()).toHaveLength(rows + 1);
    const cells = () =>
      body().map((id) => workspace.root.domInputs.get(id)!.children.length);
    expect(cells().every((count) => count === columns)).toBe(true);
    add(workspace, "TableHeader", "Column");
    expect(cells().every((count) => count === columns + 1)).toBe(true);
    workspace.dispose();
  });

  it("an element that holds no items offers nothing", async () => {
    const workspace = await open("Button");
    expect(choicesOf(workspace, "Button")).toEqual([]);
    workspace.dispose();
  });
});

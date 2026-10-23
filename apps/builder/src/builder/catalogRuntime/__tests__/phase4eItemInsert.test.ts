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
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import type { CatalogConsumerNode } from "../compositionRoot";
import { resolveStaticItemKey } from "../../../../../../packages/shared/src/catalog/slotRoles";
import { catalogTabsSelection } from "../../../../../../packages/shared/src/catalog/runtime/presence";
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
    // (The new item goes after the items, before the list's empty state.)
    expect(before.at(-1)).toBe("IllustratedMessage");
    expect(childTypes(workspace, "ListBox")).toEqual([
      ...before.slice(0, -1),
      "ListBoxItem",
      "IllustratedMessage",
    ]);
    const items = recordOf(workspace, "ListBox").children.filter(
      (id) =>
        workspace.root.typeOf(workspace.root.domInputs.get(id)!) ===
        "ListBoxItem",
    );
    const ids = items.map((id) => workspace.root.domInputs.get(id)!.props.id);
    // The new item reads "Item <n>" (its description and icon parts hidden), not the bare
    // `{label}` · `{description}` · `{icon}` row placeholders.
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

  it("sections in one ListBox · GridList give every item its own key (G5 example 1)", async () => {
    for (const [host, section, item] of [
      ["ListBox", "ListBoxSection", "ListBoxItem"],
      ["GridList", "GridListSection", "GridListItem"],
    ] as const) {
      const workspace = await open(host);
      // (The section origins — a Header and two items each.)
      const parent = recordOf(workspace, host).id;
      for (let index = 0; index < 2; index++) {
        const node: NodeEntry = {
          kind: "node",
          id: workspace.newId("node") as NodeId,
          definitionId:
            `lib:definition:origin-component-${host.toLowerCase()}-section` as DefinitionId,
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        };
        workspace.execute(
          insertNodes({
            parent: workspace.positionOfRecord(parent)!.target,
            entries: [node],
            rootIds: [node.id],
            newId: workspace.newId,
          }),
        );
      }
      expect(
        childTypes(workspace, host).filter((type) => type === section),
      ).toHaveLength(2);
      const keys: string[] = [];
      const visit = (id: string) => {
        const record = workspace.root.domInputs.get(id)!;
        if (typeOf(workspace, record) === item)
          keys.push(
            resolveStaticItemKey(
              record.props as Record<string, unknown>,
              record.id,
            ),
          );
        record.children.forEach(visit);
      };
      visit(recordOf(workspace, host).id);
      expect(keys.length).toBeGreaterThanOrEqual(4);
      expect(new Set(keys).size).toBe(keys.length);
      if (host === "ListBox") {
        // 2026-10-13 — the RAC reference `ListBox.css` (no margin between sections — G5 example 1's
        // `--spacing-md` was the old starter's): each item 4 in from the list's sides, 4 below
        // the first · above the last of its run (the list's, a section's), the run's last item
        // with no line under it. The Canvas reads the ListBox rule's item selectors.
        const list = recordOf(workspace, host);
        const sections = list.children
          .map((id) => workspace.root.domInputs.get(id)!)
          .filter((record) => typeOf(workspace, record) === section);
        const items = list.children
          .map((id) => workspace.root.domInputs.get(id)!)
          .filter((record) => typeOf(workspace, record) === item);
        const inSection = sections[0]!.children
          .map((id) => workspace.root.domInputs.get(id)!)
          .filter((record) => typeOf(workspace, record) === item);
        const geometry = workspace.root.getGeometry([
          list.id,
          ...[...items, ...sections, ...inSection].map((record) => record.id),
        ]);
        const box = (record: CatalogConsumerNode) => geometry.get(record.id)!;
        const listBox = geometry.get(list.id)!;
        const border = 0.5;
        expect(box(items[0]).x - listBox.x).toBeCloseTo(border + 4);
        expect(box(items[0]).y - listBox.y).toBeCloseTo(border + 4);
        expect(box(items[0]).width).toBeCloseTo(
          listBox.width - 2 * (border + 4),
        );
        // (Items touch — the list's padding holds them off its border; each at least 32 high.)
        expect(box(items[1]).y).toBeCloseTo(
          box(items[0]).y + box(items[0]).height,
        );
        expect(box(items[0]).height).toBeGreaterThanOrEqual(32);
        // No item margins (사용자 2026-10-13): the first section starts right under the list's
        // last item.
        const lastItem = items.at(-1)!;
        expect(
          box(sections[0]).y - (box(lastItem).y + box(lastItem).height),
        ).toBeCloseTo(0);
        expect(items.map((record) => record.derivedProps?._lastItem)).toEqual(
          items.map(() => false),
        );
        // In a section: the last item with no line under it.
        expect(
          inSection.map((record) => record.derivedProps?._lastItem),
        ).toEqual(inSection.map((_, index) => index === inSection.length - 1));
        // (Section children stand in the section's box.) Its last item at the section's end; the
        // next section starts right there (no margin between sections).
        const sectionLast = inSection.at(-1)!;
        expect(
          box(sections[0]).height -
            (box(sectionLast).y + box(sectionLast).height),
        ).toBeCloseTo(0);
        expect(box(sections[1]).y).toBeCloseTo(
          box(sections[0]).y + box(sections[0]).height,
        );
      }
      workspace.dispose();
    }
  });

  it("a section put in an instance's ListBox (a Select's) takes items (G5 example 3 — its template ancestors count)", async () => {
    const workspace = await open("Select");
    const node = (definitionId: string): NodeEntry => ({
      kind: "node",
      id: workspace.newId("node") as NodeId,
      definitionId: definitionId as DefinitionId,
      children: [],
      props: {},
      visual: {},
      sizing: {},
      descendantOverrides: [],
    });
    const section = node("lib:definition:origin-component-listbox-section");
    workspace.execute(
      insertNodes({
        parent: workspace.positionOfRecord(recordOf(workspace, "ListBox").id)!
          .target,
        entries: [section],
        rootIds: [section.id],
        newId: workspace.newId,
      }),
    );
    const item = node("lib:definition:origin-component-listbox-item-default");
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: section.id },
        entries: [item],
        rootIds: [item.id],
        newId: workspace.newId,
      }),
    );
    expect(childTypes(workspace, "ListBoxSection")).toContain("ListBoxItem");
    workspace.dispose();
  });

  it("a NumberField's Group takes a child; its Input keeps the field's placeholder as a value (G5 example 7 — user decision 2026-10-12 「A」)", async () => {
    const workspace = await open("NumberField");
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: HOST }],
        props: { placeholder: { kind: "set", value: "Amount" } },
      }),
    );
    const text: NodeEntry = {
      kind: "node",
      id: workspace.newId("node") as NodeId,
      definitionId: "lib:definition:text" as DefinitionId,
      children: [],
      props: { children: { kind: "set", value: "kg" } },
      visual: {},
      sizing: {},
      descendantOverrides: [],
    };
    workspace.execute(
      insertNodes({
        parent: workspace.positionOfRecord(recordOf(workspace, "Group").id)!
          .target,
        entries: [text],
        rootIds: [text.id],
        newId: workspace.newId,
      }),
    );
    expect(childTypes(workspace, "Group")).toContain("Text");
    const placeholder = () => recordOf(workspace, "Input").props.placeholder;
    expect(placeholder()).toBe("Amount");
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: HOST }],
        props: { placeholder: { kind: "set", value: "Weight" } },
      }),
    );
    expect(placeholder()).toBe("Amount");
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
    // G5 example 8: the template's pairs (no item keys — paired by order) keep their panels next
    // to the new keyed pair.
    const { pairs } = catalogTabsSelection(
      recordOf(workspace, "Tabs"),
      (id) => workspace.root.domInputs.get(id),
      (record) => typeOf(workspace, record),
    );
    expect(pairs).toHaveLength(tabs + 1);
    expect(pairs.every((pair) => pair.panel !== undefined)).toBe(true);
    expect(new Set(pairs.map((pair) => pair.panel!.id)).size).toBe(tabs + 1);
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

  it("a Table's header adds a column and its body a row with a cell per column (ADR-256 Phase 5i — the node tree RAC Table)", async () => {
    const workspace = await open("Table");
    const columns = childTypes(workspace, "TableHeader").length;
    add(workspace, "TableHeader", "Column");
    expect(childTypes(workspace, "TableHeader")).toHaveLength(columns + 1);
    expect(
      choicesOf(workspace, "TableBody").map((choice) => choice.type),
    ).toEqual(["Row"]);
    add(workspace, "TableBody", "Row");
    const rows = recordOf(workspace, "TableBody").children;
    // (ADR-277: the starter Row and the new one — each with a cell per column.)
    expect(rows).toHaveLength(2);
    for (const row of rows)
      expect(workspace.root.domInputs.get(row)!.children).toHaveLength(
        columns + 1,
      );
    workspace.dispose();
  });

  it("a Table body adds a row with a cell per column; a new column gives every row a cell", async () => {
    const workspace = await open("Table");
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

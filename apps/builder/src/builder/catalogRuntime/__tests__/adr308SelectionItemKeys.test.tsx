// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  copyNodes,
  duplicateNodes,
  insertGroupItem,
  insertNodes,
  pasteNodes,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
  NodeParent,
} from "../../../../../../packages/shared/src/catalog/document/types";
import type { CatalogConsumerNode } from "../../../../../../packages/shared/src/catalog/runtime/compositionRoot";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-308 G1 (b) — every selection · expansion group keeps unique item keys when an item is
 * duplicated or pasted into its own group: the item-command families (Tabs · TagGroup · ListBox …)
 * did before, and Decision 7 extends the renaming to CardView · Table · ToggleButtonGroup ·
 * Accordion · SegmentedControl and a group Radio's · Checkbox's `value`. A key RAC sees twice in one
 * collection throws for the whole Preview (2026-11-08 「Duplicate key」).
 */
const BODY = "project:node:home-body" as NodeId;
const GROUP = "project:node:group" as NodeId;

/** Group (palette type) → its item type and the prop holding the item's key. */
const FAMILIES: ReadonlyArray<[string, string, "id" | "value"]> = [
  ["Tabs", "Tab", "id"],
  ["SegmentedControl", "SegmentedControlItem", "id"],
  ["ComboBox", "ListBoxItem", "id"],
  ["Select", "ListBoxItem", "id"],
  ["ListBox", "ListBoxItem", "id"],
  ["GridList", "GridListItem", "id"],
  ["Table", "Row", "id"],
  ["Tree", "TreeItem", "id"],
  ["TagGroup", "Tag", "id"],
  ["Menu", "MenuItem", "id"],
  ["CardView", "Card", "id"],
  ["ToggleButtonGroup", "ToggleButton", "id"],
  ["SelectBoxGroup", "SelectBox", "id"],
  ["RadioGroup", "Radio", "value"],
  ["CheckboxGroup", "Checkbox", "value"],
  ["Accordion", "Disclosure", "id"],
];

async function open(groupType: string) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr308-keys" as EntryId<"project">,
        name: "ADR-308 keys",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr308-keys-${Math.random()}`),
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
          id: GROUP,
          definitionId: catalogPaletteDefinitionId(library, groupType),
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
  const root = workspace.root;
  const groupRecord = () =>
    [...root.domInputs.values()].find(
      (r) => r.id.split("::").pop() === GROUP || r.id === GROUP,
    )!;
  /** The group's items of `itemType` (at any depth, not inside another group of the same type). */
  const items = (itemType: string) => {
    const out: CatalogConsumerNode[] = [];
    // (The palette group may hold its group node deeper — a MenuTrigger's Menu: the first one is
    //  this group, a second would be another collection.)
    let groups = root.typeOf(groupRecord()) === groupType ? 1 : 0;
    const visit = (record: CatalogConsumerNode) => {
      for (const id of record.children) {
        const child = root.domInputs.get(id);
        if (!child) continue;
        const type = root.typeOf(child);
        if (type === itemType) {
          out.push(child);
          if (itemType === "TreeItem") visit(child);
        } else if (type !== groupType || groups++ === 0) visit(child);
      }
    };
    visit(groupRecord());
    return out;
  };
  return { workspace, items, library };
}

const ownedNodeOf = (record: CatalogConsumerNode) =>
  record.id.split("::").pop() as NodeId;

describe("ADR-308 G1 (b) — item keys stay unique inside a group", () => {
  it.each(FAMILIES)(
    "%s: the Library origin's %s items have keys of their own",
    async (group, item, prop) => {
      const scene = await open(group);
      const keys = scene.items(item).map((r) => r.props[prop]);
      expect(keys.length).toBeGreaterThan(0);
      expect(keys.every((key) => typeof key === "string" && key !== "")).toBe(
        true,
      );
      expect(new Set(keys).size).toBe(keys.length);
    },
  );

  it.each(FAMILIES)(
    "%s: a duplicated %s takes a new key beside its original",
    async (group, item, prop) => {
      const scene = await open(group);
      const before = scene.items(item);
      scene.workspace.execute(
        duplicateNodes({
          ids: [ownedNodeOf(before[0])],
          newId: scene.workspace.newId,
        }),
      );
      const keys = scene.items(item).map((r) => String(r.props[prop]));
      // (A TreeItem copy brings its child items.)
      expect(keys.length).toBeGreaterThan(before.length);
      expect(new Set(keys).size).toBe(keys.length);
    },
  );

  it.each(FAMILIES)(
    "%s: a %s pasted beside its original takes a new key",
    async (group, item, prop) => {
      const scene = await open(group);
      const before = scene.items(item);
      const source = ownedNodeOf(before[0]);
      const graph = scene.workspace.root.runtime.graph;
      const ownerId = graph.ownerOf(source) as NodeId;
      const owner = graph.getEntry(ownerId) as NodeEntry;
      // (Its own position: the owner's child list, or the slot its owner fills.)
      const fill = owner.descendantOverrides.find(
        (o) => o.kind === "fillSlot" && o.childIds.includes(source),
      );
      const parent: NodeParent =
        fill && fill.kind === "fillSlot"
          ? { kind: "descendant", ownerId, address: fill.address }
          : { kind: "node", id: ownerId };
      scene.workspace.execute(
        pasteNodes({
          clipboard: copyNodes(graph, [source]),
          parent,
          newId: scene.workspace.newId,
        }),
      );
      const keys = scene.items(item).map((r) => String(r.props[prop]));
      expect(keys.length).toBeGreaterThan(before.length);
      expect(new Set(keys).size).toBe(keys.length);
    },
  );

  // (Decision 1 — the group "+" (`insertGroupItem`) gives a new item a key its group lacks, also when
  //  the new item comes as a copy of a sibling's props.)
  it.each([
    ["ToggleButtonGroup", "ToggleButton", "id"],
    ["Accordion", "Disclosure", "id"],
    ["SegmentedControl", "SegmentedControlItem", "id"],
    ["CheckboxGroup", "Checkbox", "value"],
    ["RadioGroup", "Radio", "value"],
  ] as const)(
    "%s: its + gives the new %s a key of its own",
    async (group, item, prop) => {
      const scene = await open(group);
      const first = String(scene.items(item)[0].props[prop]);
      for (const props of [{}, { [prop]: { kind: "set", value: first } }]) {
        const id = scene.workspace.newId("node");
        scene.workspace.execute(
          insertGroupItem({
            hostId: GROUP,
            entries: [
              {
                kind: "node",
                id,
                definitionId: catalogPaletteDefinitionId(scene.library, item),
                children: [],
                props,
                visual: {},
                sizing: {},
                descendantOverrides: [],
              } as NodeEntry,
            ],
            rootId: id,
            newId: scene.workspace.newId,
          }),
        );
      }
      const keys = scene.items(item).map((r) => r.props[prop]);
      expect(keys.every((key) => typeof key === "string" && key !== "")).toBe(
        true,
      );
      expect(new Set(keys).size).toBe(keys.length);
    },
  );
});

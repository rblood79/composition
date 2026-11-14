// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
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
import { catalogItemInsertChoices } from "../itemInsert";
import { CatalogLayerTreeStore, type CatalogLayerNode } from "../layerTree";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-310 G5 — a list's items read data of their own (Decision 2 ①): in one list a static item and
 * two runs over two collections, in document order on the Canvas and in the DOM with every key
 * once; two sections showing different data; a section repeated over grouped rows whose item
 * repeats over each group's child rows (②).
 */
const BODY = "project:node:home-body" as NodeId;
const LIST = "project:node:list" as NodeId;
const ref = (id: string): DataBindingRef =>
  ({ collectionId: `data:collection:${id}`, fieldMap: {} }) as DataBindingRef;
const PEOPLE = ref("people");
const TEAMS = ref("teams");
const GROUPS = ref("groups");
const row = (key: string, label: string, children?: CatalogBoundRow[]) =>
  ({
    key,
    values: { id: key, label, value: key },
    ...(children ? { children } : {}),
  }) satisfies CatalogBoundRow;
const DATA: Record<string, CatalogBoundRow[]> = {
  [PEOPLE.collectionId]: [
    row("p1", "Kim"),
    row("p2", "Lee"),
    row("p3", "Park"),
  ],
  [TEAMS.collectionId]: [row("t1", "Design"), row("t2", "Sales")],
  [GROUPS.collectionId]: [
    row("g1", "Fruit", [row("g1a", "Apple"), row("g1b", "Pear")]),
    row("g2", "Veg", [row("g2a", "Leek"), row("g2b", "Kale")]),
  ],
};

async function open() {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:own-rows" as EntryId<"project">,
        name: "Own rows",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr310-own-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
      root: { rows: (binding) => DATA[binding.collectionId] },
    },
  );
  const graph = workspace.runtime.graph;
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
  const typeOf = (id: NodeId) =>
    definitionTypeName(graph, (graph.getEntry(id) as NodeEntry).definitionId);
  const fill = (owner: NodeId) =>
    (
      (graph.getEntry(owner) as NodeEntry).descendantOverrides.find(
        (override) => override.kind === "fillSlot",
      ) as { childIds: readonly NodeId[] } | undefined
    )?.childIds ?? (graph.getEntry(owner) as NodeEntry).children;
  const root = workspace.root;
  const [listRecord] = root.recordsOfSource(LIST);
  const html = () => renderToStaticMarkup(renderCatalogDom(root, listRecord!));
  /** The "+" of a record (by its source node). */
  const add = (owner: NodeId, type: string) => {
    const [record] = root.recordsOfSource(owner);
    workspace.execute(
      catalogItemInsertChoices(
        { graph, readModel: workspace.readModel, newId: workspace.newId },
        workspace.positionOfRecord(record!)!,
      )
        .find((choice) => choice.type === type)!
        .build(),
    );
  };
  const bind = (id: NodeId, binding: DataBindingRef | undefined) =>
    workspace.execute(
      catalogBindingCommand([{ kind: "node", id }], binding, workspace.newId),
    );
  /** The Canvas item records under the list, in order: [source, row index]. */
  const items = () => {
    const out: [string, number | undefined][] = [];
    const visit = (id: string) => {
      const record = root.canvasInputs.get(id)!;
      if (root.typeOf(record) === "ListBoxItem") {
        out.push([record.sourceId, record.rowIndex]);
        return;
      }
      record.children.forEach(visit);
    };
    visit(listRecord!);
    return out;
  };
  const keys = () =>
    [...html().matchAll(/data-key="([^"]*)"/g)].map((m) => m[1]);
  /** Layers: the list's item rows — [item, its × count, its key conflicts]. */
  const layerItems = () => {
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
    const stop = layers.connect();
    layers.setExpanded(new Set([root.recordsOfSource(BODY)[0]!, listRecord!]));
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
    const out = (find(layers.getSnapshot())?.children ?? [])
      .filter((row) => row.typeName === "ListBoxItem")
      .map((row) => [
        (row.position.target as { id: NodeId }).id,
        row.repeat?.count ?? null,
        row.repeat?.keyConflicts ?? null,
      ]);
    stop();
    return out;
  };
  return {
    workspace,
    graph,
    typeOf,
    fill,
    html,
    add,
    bind,
    items,
    keys,
    layerItems,
  };
}

it("ADR-310 G5 ①: [static A, B over People, C over Teams] — one order on the Canvas and in the DOM, every key once; unbinding B leaves it static", async () => {
  const {
    workspace,
    graph,
    typeOf,
    fill,
    html,
    bind,
    items,
    keys,
    layerItems,
  } = await open();
  try {
    const [a, b, c] = fill(LIST).filter(
      (id) => typeOf(id) === "ListBoxItem",
    ) as [NodeId, NodeId, NodeId];
    bind(b, PEOPLE);
    bind(c, TEAMS);
    // (The list itself holds no binding — each run reads its own.)
    expect((graph.getEntry(LIST) as NodeEntry).binding).toBeUndefined();
    expect((graph.getEntry(b) as NodeEntry).repeat).toBe(true);
    expect((graph.getEntry(c) as NodeEntry).repeat).toBe(true);
    expect(items()).toEqual([
      [a, undefined],
      [b, 0],
      [b, 1],
      [b, 2],
      [c, 0],
      [c, 1],
    ]);
    const markup = html();
    expect(markup.match(/role="option"/g)).toHaveLength(6);
    const order = ["Kim", "Lee", "Park", "Design", "Sales"].map((text) =>
      markup.indexOf(text),
    );
    expect(order.every((at) => at > -1)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
    const shown = keys();
    expect(shown).toEqual(
      expect.arrayContaining(["p1", "p2", "p3", "t1", "t2"]),
    );
    expect(new Set(shown).size).toBe(shown.length);
    // Layers: each run's template with its own row count.
    expect(layerItems()).toEqual([
      [a, null, null],
      [b, 3, null],
      [c, 2, null],
    ]);
    // Two runs over the same data share keys — reported on the templates (every row stays).
    bind(c, PEOPLE);
    expect(items()).toHaveLength(7);
    expect(layerItems()[1]).toEqual([b, 3, ["p1", "p2", "p3"]]);
    bind(c, TEAMS);

    // Unbinding B: one static item again, C's run stays.
    bind(b, undefined);
    expect((graph.getEntry(b) as NodeEntry).repeat).toBeUndefined();
    expect(items()).toEqual([
      [a, undefined],
      [b, undefined],
      [c, 0],
      [c, 1],
    ]);
  } finally {
    workspace.dispose();
  }
});

it("ADR-310 G5: two sections show different data (an item of each reads its own)", async () => {
  const { workspace, typeOf, fill, html, add, bind } = await open();
  try {
    add(LIST, "ListBoxSection");
    add(LIST, "ListBoxSection");
    const sections = fill(LIST).filter(
      (id) => typeOf(id) === "ListBoxSection",
    ) as NodeId[];
    expect(sections).toHaveLength(2);
    for (const section of sections) add(section, "ListBoxItem");
    const own = (section: NodeId) =>
      fill(section).filter((id) => typeOf(id) === "ListBoxItem") as NodeId[];
    bind(own(sections[0]!).at(-1)!, PEOPLE);
    bind(own(sections[1]!).at(-1)!, TEAMS);
    const parts = html()
      .split(/<section/)
      .slice(1);
    // (The list's own items first — the sections after them.)
    const [first, second] = parts.slice(-2) as [string, string];
    expect(first).toContain("Kim");
    expect(first).toContain("Park");
    expect(first).not.toContain("Design");
    expect(second).toContain("Design");
    expect(second).toContain("Sales");
    expect(second).not.toContain("Kim");
  } finally {
    workspace.dispose();
  }
});

it("ADR-310 G5 ②: a section bound to grouped rows repeats per group, its item per group's child rows", async () => {
  const { workspace, graph, typeOf, fill, html, add, bind, items } =
    await open();
  try {
    add(LIST, "ListBoxSection");
    const [section] = fill(LIST).filter(
      (id) => typeOf(id) === "ListBoxSection",
    ) as [NodeId];
    add(section, "ListBoxItem");
    bind(section, GROUPS);
    expect((graph.getEntry(section) as NodeEntry).repeat).toBe(true);
    const inner = fill(section).filter(
      (id) => typeOf(id) === "ListBoxItem",
    ) as NodeId[];
    expect(
      inner.filter((id) => (graph.getEntry(id) as NodeEntry).repeat),
    ).toHaveLength(1);
    const parts = html()
      .split(/<section/)
      .slice(1);
    const [fruit, veg] = parts.slice(-2) as [string, string];
    expect(fruit).toContain("Apple");
    expect(fruit).toContain("Pear");
    expect(fruit).not.toContain("Leek");
    expect(veg).toContain("Leek");
    expect(veg).not.toContain("Apple");
    // (Two groups' first items stay two records — every option key once.)
    const keys = [...html().matchAll(/data-key="([^"]*)"/g)].map((m) => m[1]);
    expect(keys).toEqual(expect.arrayContaining(["g1a", "g1b", "g2a", "g2b"]));
    // Canvas: the four child rows are four records (a group's second item keeps its own key).
    expect(items().filter(([source]) => source === inner[0])).toHaveLength(4);
    expect(new Set(keys).size).toBe(keys.length);
  } finally {
    workspace.dispose();
  }
});

const GROUP_ITEM: Record<string, [item: string, dom: RegExp, key: RegExp]> = {
  RadioGroup: [
    "Radio",
    /<label[^>]*class="react-aria-Radio[^"]*"[^>]*>/g,
    /value="([^"]*)"/,
  ],
  CheckboxGroup: [
    "Checkbox",
    /<label[^>]*class="react-aria-Checkbox[^"]*"[^>]*>/g,
    /value="([^"]*)"/,
  ],
  ToggleButtonGroup: [
    "ToggleButton",
    /<button[^>]*class="react-aria-ToggleButton[^"]*"[^>]*>/g,
    /id="[^"]*"/,
  ],
  SegmentedControl: [
    "SegmentedControlItem",
    /<button[^>]*class="react-aria-SegmentedControlItem[^"]*"[^>]*>/g,
    /id="[^"]*"/,
  ],
};

it.each(Object.keys(GROUP_ITEM))(
  "ADR-310 G5: a bound %s repeats its option per row — Canvas = DOM (labels in row order)",
  async (type) => {
    const [itemType] = GROUP_ITEM[type]!;
    const library = await buildCodeCatalogLibrary();
    const workspace = new CatalogWorkspace(
      new CatalogGraph(
        newCatalogProjectDocument({
          projectId: "project:project:group-rows" as EntryId<"project">,
          name: "Group rows",
        }),
        library,
      ),
      new CatalogStorage(indexedDB, `adr310-group-${Math.random()}`),
      {
        engine: await nodeLayoutEngine(),
        viewport: { width: 1200, height: 800 },
        autosaveSchedule: () => {},
        root: { rows: (binding) => DATA[binding.collectionId] },
      },
    );
    const graph = workspace.runtime.graph;
    const GROUP = "project:node:group" as NodeId;
    try {
      workspace.execute(
        insertNodes({
          parent: { kind: "node", id: BODY },
          entries: [
            {
              kind: "node",
              id: GROUP,
              definitionId: catalogPaletteDefinitionId(library, type),
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
      workspace.execute(
        catalogBindingCommand(
          [{ kind: "node", id: GROUP }],
          PEOPLE,
          workspace.newId,
        ),
      );
      const root = workspace.root;
      const [groupRecord] = root.recordsOfSource(GROUP);
      // Canvas: one option record per row, in row order, each showing its row's label.
      const options: { row?: number; text: string }[] = [];
      const textOf = (id: string): string => {
        const record = root.canvasInputs.get(id)!;
        const own = [record.props.children, record.props.label].find(
          (value) => typeof value === "string",
        ) as string | undefined;
        return own ?? record.children.map(textOf).join("");
      };
      const visit = (id: string) => {
        const record = root.canvasInputs.get(id)!;
        if (root.typeOf(record) === itemType) {
          options.push({ row: record.rowIndex, text: textOf(id) });
          return;
        }
        record.children.forEach(visit);
      };
      visit(groupRecord!);
      expect(options.map((option) => option.row)).toEqual([0, 1, 2]);
      expect(options.map((option) => option.text)).toEqual([
        "Kim",
        "Lee",
        "Park",
      ]);
      // DOM: the same three options, in the same order.
      const markup = renderToStaticMarkup(renderCatalogDom(root, groupRecord!));
      expect(markup.match(GROUP_ITEM[type]![1])).toHaveLength(3);
      const at = ["Kim", "Lee", "Park"].map((text) => markup.indexOf(text));
      expect(at.every((index) => index > -1)).toBe(true);
      expect([...at].sort((x, y) => x - y)).toEqual(at);
      if (type === "RadioGroup" || type === "CheckboxGroup")
        expect(
          [...markup.matchAll(/<input[^>]*value="([^"]*)"/g)].map((m) => m[1]),
        ).toEqual(["p1", "p2", "p3"]);
      void graph;
    } finally {
      workspace.dispose();
    }
  },
);

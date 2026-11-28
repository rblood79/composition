import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  insertCollectionItem,
  insertNodes,
} from "../../../../../../packages/shared/src/catalog/commands";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  DataBindingRef,
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  cascaderTableOf,
  cascaderValueMatch,
} from "../../../../../../packages/shared/src/catalog/runtime/cascader";
import { catalogBoundRows } from "../dataBinding";
import { catalogBindingCommand } from "../dataBindingCommand";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-322 G4 (breakdown §4.2 · §4.3) — a Cascader bound to data: its levels stand from the three
 * shapes (nested `children` · flat `parentId` · a table per level — 사용자 결정 5), the value is
 * the row's key, and the repeated-key answers: A and B each with an `01` leaf — neither can be
 * picked; two `01` under the same A — two items (RAC ids apart), neither pickable. The rows go
 * through the real row reader (`catalogBoundRows`). Expected tables are written out by hand.
 */
const BODY = "project:node:home-body" as NodeId;
const PLACED = "project:node:placed" as NodeId;
const ref = (id: string) =>
  `data:field:${id}` as DataBindingRef["fieldMap"][string];
const col = (id: string) =>
  `data:collection:${id}` as DataBindingRef["collectionId"];

const COLLECTIONS = [
  {
    // Nested: A > (01, 02), B > 01 — `01` twice in the hierarchy.
    id: "nested",
    schema: [
      { id: "f-id", key: "id" },
      { id: "f-name", key: "name" },
      { id: "f-sub", key: "sub", type: "array" },
    ],
    mockData: [
      {
        id: "A",
        name: "Alpha",
        sub: [
          { id: "01", name: "One" },
          { id: "02", name: "Two" },
        ],
      },
      { id: "B", name: "Beta", sub: [{ id: "01", name: "Uno" }] },
    ],
    useMockData: true,
  },
  {
    // Flat: the same hierarchy as parent keys — and `01` twice under A (siblings).
    id: "flat",
    schema: [
      { id: "f-id", key: "id" },
      { id: "f-name", key: "name" },
      { id: "f-parent", key: "parent" },
    ],
    mockData: [
      { id: "A", name: "Alpha", parent: null },
      { id: "x1", name: "Seoul", parent: "A" },
      { id: "x2", name: "Busan", parent: "A" },
      { id: "B", name: "Beta", parent: null },
      { id: "y1", name: "Gangnam", parent: "B" },
    ],
    useMockData: true,
  },
  {
    // A table per level: categories, then subcategories pointing at them (ids restart per table).
    id: "cat",
    schema: [
      { id: "c-id", key: "id" },
      { id: "c-name", key: "name" },
    ],
    mockData: [
      { id: "1", name: "Food" },
      { id: "2", name: "Drink" },
    ],
    useMockData: true,
  },
  {
    id: "sub",
    schema: [
      { id: "s-id", key: "code" },
      { id: "s-name", key: "name" },
      { id: "s-cat", key: "categoryId" },
    ],
    mockData: [
      { code: "11", name: "Bread", categoryId: "1" },
      { code: "12", name: "Rice", categoryId: "1" },
      { code: "21", name: "Tea", categoryId: "2" },
    ],
    useMockData: true,
  },
  {
    // Flat rows with a repeated key: the hierarchy cannot stand under it (its child is a root).
    id: "flat-repeated",
    schema: [
      { id: "f-id", key: "id" },
      { id: "f-name", key: "name" },
      { id: "f-parent", key: "parent" },
    ],
    mockData: [
      { id: "A", name: "Alpha", parent: null },
      { id: "A", name: "Again", parent: null },
      { id: "x1", name: "Seoul", parent: "A" },
    ],
    useMockData: true,
  },
  {
    // Siblings with one key: two `01` under A.
    id: "siblings",
    schema: [
      { id: "f-id", key: "id" },
      { id: "f-name", key: "name" },
      { id: "f-sub", key: "sub", type: "array" },
    ],
    mockData: [
      {
        id: "A",
        name: "Alpha",
        sub: [
          { id: "01", name: "One" },
          { id: "01", name: "Again" },
          { id: "03", name: "Three" },
        ],
      },
    ],
    useMockData: true,
  },
];

async function place(binding: DataBindingRef) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr322-g4" as EntryId<"project">,
        name: "ADR-322 G4",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr322-g4-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
      root: {
        rows: (bound, kind) =>
          catalogBoundRows(bound, COLLECTIONS, kind, Number.MAX_SAFE_INTEGER),
      },
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: PLACED,
          definitionId: catalogPaletteDefinitionId(library, "Cascader"),
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
      ],
      rootIds: [PLACED],
      newId: workspace.newId,
    }),
  );
  workspace.execute(
    catalogBindingCommand(
      [{ kind: "node", id: PLACED }],
      binding,
      workspace.newId,
    ),
  );
  const root = workspace.root;
  const get = (id: string) => root.domInputs.get(id);
  const typeOf = (node: Parameters<typeof root.typeOf>[0]) => root.typeOf(node);
  const table = () =>
    cascaderTableOf(get(root.recordsOfSource(PLACED)[0]!)!, get, typeOf);
  const notice = () => {
    const field = get(root.recordsOfSource(PLACED)[0]!)!;
    const part = [...root.domInputs.values()].find(
      (record) =>
        root.typeOf(record) === "Description" && record.parentId === field.id,
    );
    return {
      text: part?.derivedProps?.children,
      hidden: part === undefined || part.hidden === true,
      description: field.derivedProps?.description,
    };
  };
  return { workspace, table, notice };
}

const shape = (table: ReturnType<typeof cascaderTableOf>) =>
  table.entries.map((entry) => [
    entry.pathId.replaceAll("\u001f", "/"),
    entry.key,
    entry.names.join(" / "),
    entry.duplicate,
  ]);

it("remote parent links use collection keys even when the field submits another column", () => {
  const binding = {
    collectionId: col("flat"),
    fieldMap: { value: ref("f-name"), parentId: ref("f-parent") },
  };
  const source = {
    ...COLLECTIONS[1]!,
    keyField: "f-id",
    mockData: [
      { id: "07~2", name: "Alpha" },
      { id: "07", name: "Beta" },
      { id: "07", name: "Gamma" },
      { id: "08", name: "Child", parent: "07~2" },
    ],
  };
  const rows = catalogBoundRows(
    binding,
    [source],
    "items",
    100,
    0,
    undefined,
    true,
  )!;
  expect(new Set(rows.map((row) => row.key)).size).toBe(3);
  expect(rows[0]).toMatchObject({
    levelKey: "07~2",
    itemKey: "Alpha",
    children: [{ levelKey: "08", itemKey: "Child" }],
  });
});

describe("ADR-322 G4 — a bound Cascader's levels and its repeated keys", () => {
  it("preserves every sibling when a nested row key contains the duplicate suffix", () => {
    const rows = catalogBoundRows(
      {
        collectionId: col("nested"),
        fieldMap: { value: ref("f-id"), children: ref("f-sub") },
      },
      [
        {
          ...COLLECTIONS[0]!,
          mockData: [
            { id: "A", sub: [{ id: "07~2" }, { id: "07" }, { id: "07" }] },
          ],
        },
      ],
      "items",
      100,
    );
    const children = rows?.[0]?.children ?? [];
    expect(new Set(children.map((row) => row.key)).size).toBe(3);
    expect(children.map((row) => row.itemKey ?? row.key)).toEqual([
      "07~2",
      "07",
      "07",
    ]);
  });

  it("nested rows: the levels stand from `children`, the value is the row key, A/01 and B/01 cannot be picked", async () => {
    const { table, notice } = await place({
      collectionId: col("nested"),
      fieldMap: { value: ref("f-id"), children: ref("f-sub") },
    });
    expect(shape(table())).toEqual([
      ["A", "A", "Alpha", false],
      ["A/01", "01", "Alpha / One", true],
      ["A/02", "02", "Alpha / Two", false],
      ["B", "B", "Beta", false],
      ["B/01", "01", "Beta / Uno", true],
    ]);
    expect(cascaderValueMatch(table(), "02")).toMatchObject({
      kind: "item",
      entry: { names: ["Alpha", "Two"] },
    });
    expect(cascaderValueMatch(table(), "01").kind).toBe("duplicate");
    expect(cascaderValueMatch(table(), "zz").kind).toBe("missing");
    // The field says so in its Description's place (both consumers read the record).
    expect(notice()).toEqual({
      text: "2 items can't be picked — the key repeats",
      hidden: false,
      description: "2 items can't be picked — the key repeats",
    });
  });

  it("flat rows: the levels stand from `parentId`", async () => {
    const { table, notice } = await place({
      collectionId: col("flat"),
      fieldMap: { value: ref("f-id"), parentId: ref("f-parent") },
    });
    expect(shape(table())).toEqual([
      ["A", "A", "Alpha", false],
      ["A/x1", "x1", "Alpha / Seoul", false],
      ["A/x2", "x2", "Alpha / Busan", false],
      ["B", "B", "Beta", false],
      ["B/y1", "y1", "Beta / Gangnam", false],
    ]);
    // No repeated key: no notice (the origin's empty description — the part is not there).
    expect(notice()).toEqual({
      text: undefined,
      hidden: true,
      description: undefined,
    });
  });

  it("flat rows with a repeated key: both items cannot be picked, the field says so", async () => {
    const { table, notice } = await place({
      collectionId: col("flat-repeated"),
      fieldMap: { value: ref("f-id"), parentId: ref("f-parent") },
    });
    expect(shape(table())).toEqual([
      ["A", "A", "Alpha", true],
      ["A#1", "A", "Again", true],
      ["x1", "x1", "Seoul", false],
    ]);
    expect(notice().text).toBe("2 items can't be picked — the key repeats");
  });

  it("a table per level (사용자 결정 5): the second level's rows stand under the item their 「parent level」 field names", async () => {
    const { workspace, table } = await place({
      collectionId: col("cat"),
      fieldMap: { value: ref("c-id") },
    });
    // The row template (the Cascader's own item) takes a nested item: the second level, bound to
    // its own table.
    const graph = workspace.runtime.graph;
    // (ADR-326 §4.2 — the row template sits in the list box: the instance's `Popover >
    //  CascaderList` fill.)
    const placed = graph.getEntry(PLACED) as NodeEntry;
    const listFill = placed.descendantOverrides.find(
      (override) =>
        override.kind === "fillSlot" &&
        override.address.templatePath.at(-1) ===
          "lib:template:component-cascader__list",
    ) as { childIds: readonly NodeId[] } | undefined;
    const level1Id = listFill?.childIds.find((id) => {
      const child = graph.getEntry(id);
      return (
        child?.kind === "node" &&
        graph.getDefinition(child.definitionId)?.name ===
          "CascaderItem"
      );
    })!;
    expect(level1Id).toBeDefined();
    const level2Id = "project:node:level2" as NodeId;
    workspace.execute(
      insertCollectionItem({
        host: { kind: "node", id: level1Id },
        entries: [
          {
            kind: "node",
            id: level2Id,
            definitionId: (graph.getEntry(level1Id) as NodeEntry).definitionId,
            children: [],
            props: { id: { kind: "set", value: "level2" } },
            visual: {},
            sizing: {},
            descendantOverrides: [],
          },
        ],
        rootId: level2Id,
        key: "level2",
        newId: workspace.newId,
      }),
    );
    workspace.execute(
      catalogBindingCommand(
        [{ kind: "node", id: level2Id }],
        {
          collectionId: col("sub"),
          fieldMap: { value: ref("s-id"), levelParent: ref("s-cat") },
        },
        workspace.newId,
      ),
    );
    expect(shape(table())).toEqual([
      ["1", "1", "Food", false],
      ["1/11", "11", "Food / Bread", false],
      ["1/12", "12", "Food / Rice", false],
      ["2", "2", "Drink", false],
      ["2/21", "21", "Drink / Tea", false],
    ]);
  });

  it("siblings with one key: two items (RAC ids apart), neither pickable", async () => {
    const { table } = await place({
      collectionId: col("siblings"),
      fieldMap: { value: ref("f-id"), children: ref("f-sub") },
    });
    expect(shape(table())).toEqual([
      ["A", "A", "Alpha", false],
      ["A/01", "01", "Alpha / One", true],
      ["A/01#1", "01", "Alpha / Again", true],
      ["A/03", "03", "Alpha / Three", false],
    ]);
  });
});

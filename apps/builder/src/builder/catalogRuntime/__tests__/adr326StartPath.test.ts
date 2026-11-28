import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  insertCollectionItem,
  insertNodes,
  setFields,
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
  type CascaderTable,
} from "../../../../../../packages/shared/src/catalog/runtime/cascader";
import { catalogBoundRows } from "../dataBinding";
import { catalogBindingCommand } from "../dataBindingCommand";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-326 Phase 1 · G1 (breakdown §4.7 — 시작 경로 보존, review h1): the Builder reads a bound
 * Cascader's rows through the production window (100 — `catalogBoundRows`' default, the row slices
 * the resolver asks passed on as the Builder's reader does), the Preview reads every row. For a
 * start key the Builder's table answers as the whole hierarchy does — the kind, the ancestors — in
 * the three data shapes. Expected answers are written out by hand from the inputs.
 */
const col = (id: string) =>
  `data:collection:${id}` as DataBindingRef["collectionId"];
const ref = (id: string) =>
  `data:field:${id}` as DataBindingRef["fieldMap"][string];
const PLACED = "project:node:placed" as NodeId;
const LEVEL2 = "project:node:level2" as NodeId;

type Node = { key: string; name: string; children: Node[] };
/** 부모 120 × 자식 1 (`R1` ~ `R120` · `R<n>-1`). */
const PARENTS_120: Node[] = Array.from({ length: 120 }, (_, i) => ({
  key: `R${i + 1}`,
  name: `Root ${i + 1}`,
  children: [{ key: `R${i + 1}-1`, name: `Child ${i + 1}`, children: [] }],
}));

const flatRows = (nodes: readonly Node[]) => {
  const out: Record<string, unknown>[] = [];
  const walk = (level: readonly Node[], parent: string | null) => {
    for (const node of level) {
      out.push({ id: node.key, name: node.name, parent });
      walk(node.children, node.key);
    }
  };
  walk(nodes, null);
  return out;
};
const nestedRows = (nodes: readonly Node[]): Record<string, unknown>[] =>
  nodes.map((node) => ({
    id: node.key,
    name: node.name,
    ...(node.children.length ? { sub: nestedRows(node.children) } : {}),
  }));
/** 단계 표: 깊이마다 표 하나 — 행의 `parent` = 윗 단계 행의 key. */
const levelTables = (nodes: readonly Node[]) => {
  const tables: Record<string, unknown>[][] = [[], []];
  const walk = (
    level: readonly Node[],
    parent: string | null,
    depth: number,
  ) => {
    for (const node of level) {
      tables[depth]!.push({ id: node.key, name: node.name, parent });
      walk(node.children, node.key, depth + 1);
    }
  };
  walk(nodes, null, 0);
  return tables;
};

type Shape = "flat" | "nested" | "levels";
const SHAPES: readonly Shape[] = ["flat", "nested", "levels"];

const schema = (...keys: string[]) =>
  keys.map((key) => ({
    id: `f-${key}`,
    key,
    ...(key === "sub" ? { type: "array" } : {}),
  }));

function sourcesOf(shape: Shape, nodes: readonly Node[]) {
  if (shape === "flat")
    return [
      {
        id: "t",
        schema: schema("id", "name", "parent"),
        mockData: flatRows(nodes),
        useMockData: true,
      },
    ];
  if (shape === "nested")
    return [
      {
        id: "t",
        schema: schema("id", "name", "sub"),
        mockData: nestedRows(nodes),
        useMockData: true,
      },
    ];
  const [first, second] = levelTables(nodes);
  return [
    {
      id: "t",
      schema: schema("id", "name"),
      mockData: first,
      useMockData: true,
    },
    {
      id: "t2",
      schema: schema("id", "name", "parent"),
      mockData: second,
      useMockData: true,
    },
  ];
}

/**
 * A bound Cascader whose start value is `start`, its table as the Builder (`window` 100 — the
 * production default) or the Preview (every row) reads it.
 */
async function tableOf(
  shape: Shape,
  nodes: readonly Node[],
  start: string,
  reader: "builder" | "preview",
) {
  const sources = sourcesOf(shape, nodes);
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr326-start" as EntryId<"project">,
        name: "ADR-326 start path",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr326-start-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
      root: {
        rows: (bound, kind, _owner, _path, slices) =>
          reader === "builder"
            ? catalogBoundRows(
                bound,
                sources as never,
                kind,
                undefined,
                undefined,
                slices,
              )
            : catalogBoundRows(
                bound,
                sources as never,
                kind,
                Number.MAX_SAFE_INTEGER,
              ),
      },
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: [
        {
          kind: "node",
          id: PLACED,
          definitionId: catalogPaletteDefinitionId(library, "Cascader"),
          children: [],
          props: { defaultValue: { kind: "set", value: start } },
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
      {
        collectionId: col("t"),
        fieldMap:
          shape === "flat"
            ? { value: ref("f-id"), parentId: ref("f-parent") }
            : shape === "nested"
              ? { value: ref("f-id"), children: ref("f-sub") }
              : { value: ref("f-id") },
      },
      workspace.newId,
    ),
  );
  if (shape === "levels") {
    const graph = workspace.runtime.graph;
    const fill = (graph.getEntry(PLACED) as NodeEntry).descendantOverrides.find(
      (override) =>
        override.kind === "fillSlot" &&
        override.address.templatePath.at(-1) ===
          "lib:template:component-cascader__list",
    ) as { childIds: readonly NodeId[] };
    const level1 = fill.childIds[0]!;
    workspace.execute(
      insertCollectionItem({
        host: { kind: "node", id: level1 },
        entries: [
          {
            kind: "node",
            id: LEVEL2,
            definitionId: (graph.getEntry(level1) as NodeEntry).definitionId,
            children: [],
            props: { id: { kind: "set", value: "level2" } },
            visual: {},
            sizing: {},
            descendantOverrides: [],
          },
        ],
        rootId: LEVEL2,
        key: "level2",
        newId: workspace.newId,
      }),
    );
    workspace.execute(
      catalogBindingCommand(
        [{ kind: "node", id: LEVEL2 }],
        {
          collectionId: col("t2"),
          fieldMap: { value: ref("f-id"), levelParent: ref("f-parent") },
        },
        workspace.newId,
      ),
    );
  }
  const root = workspace.root;
  const get = (id: string) => root.domInputs.get(id);
  const table = () =>
    cascaderTableOf(get(root.recordsOfSource(PLACED)[0]!)!, get, (node) =>
      root.typeOf(node),
    );
  return { workspace, table };
}

/** What a start key names: its kind, and for an item its ancestors' keys and its names. */
const verdict = (table: CascaderTable, key: string) => {
  const match = cascaderValueMatch(table, key);
  if (match.kind !== "item") return { kind: match.kind };
  const chain: string[] = [];
  for (
    let at = match.entry.parentPathId;
    at !== null;
    at = table.byPathId.get(at)!.parentPathId
  )
    chain.unshift(table.byPathId.get(at)!.key);
  return { kind: "item", chain, names: match.entry.names };
};

describe("ADR-326 G1 — the Builder's table answers the start key as the whole hierarchy (§4.7)", () => {
  it("(1) 부모 120 × 자식 1 · 시작 `R120-1`: 세 모양 모두 item · 부모 R120 (Builder = Preview)", async () => {
    for (const shape of SHAPES) {
      const expected = {
        kind: "item",
        chain: ["R120"],
        names: ["Root 120", "Child 120"],
      };
      const preview = await tableOf(shape, PARENTS_120, "R120-1", "preview");
      expect(verdict(preview.table(), "R120-1"), shape).toEqual(expected);
      const builder = await tableOf(shape, PARENTS_120, "R120-1", "builder");
      expect(verdict(builder.table(), "R120-1"), shape).toEqual(expected);
      // (The window still cuts the rest — the sample is not the whole collection.)
      expect(builder.table().byParent.get(null)!.length, shape).toBeLessThan(
        120,
      );
    }
  });

  it("(2) 창 밖에 같은 key 가 하나 더 (R130 > R5-1): 두 쪽 모두 duplicate", async () => {
    const nodes: Node[] = [
      ...PARENTS_120,
      {
        key: "R130",
        name: "Root 130",
        children: [{ key: "R5-1", name: "Again", children: [] }],
      },
    ];
    for (const shape of SHAPES) {
      for (const reader of ["preview", "builder"] as const)
        expect(
          verdict((await tableOf(shape, nodes, "R5-1", reader)).table(), "R5-1")
            .kind,
          `${shape} ${reader}`,
        ).toBe("duplicate");
    }
  });

  it("(3) 단계 표 — 뿌리 가지 X (자식이 둘째 표 102 행) · P 아래 잎 X (101 행): item · 부모 P, X 는 가지 그대로", async () => {
    // 둘째 표: F 아래 100 행 → P 아래 X (101) → X 아래 c (102).
    const nodes: Node[] = [
      {
        key: "F",
        name: "Filler",
        children: Array.from({ length: 100 }, (_, i) => ({
          key: `f${i}`,
          name: `f${i}`,
          children: [],
        })),
      },
      {
        key: "P",
        name: "Parent P",
        children: [{ key: "X", name: "Leaf X", children: [] }],
      },
      {
        key: "X",
        name: "Branch X",
        children: [{ key: "c", name: "Child c", children: [] }],
      },
    ];
    for (const reader of ["preview", "builder"] as const) {
      const table = (await tableOf("levels", nodes, "X", reader)).table();
      expect(verdict(table, "X"), reader).toEqual({
        kind: "item",
        chain: ["P"],
        names: ["Parent P", "Leaf X"],
      });
      // (The root branch X keeps its child — its chevron, and it is no value.)
      const root = table.byParent
        .get(null)!
        .find((entry) => entry.key === "X")!;
      expect(root.hasChildren, reader).toBe(true);
    }
  });

  it("a start value written after binding: the Builder's table follows it (and Undo)", async () => {
    const { workspace, table } = await tableOf(
      "nested",
      PARENTS_120,
      "",
      "builder",
    );
    expect(cascaderValueMatch(table(), "R120-1").kind).toBe("missing");
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: PLACED }],
        props: { defaultValue: { kind: "set", value: "R120-1" } },
      } as never),
    );
    expect(verdict(table(), "R120-1")).toMatchObject({ chain: ["R120"] });
    workspace.undo();
    expect(cascaderValueMatch(table(), "R120-1").kind).toBe("missing");
  });
});

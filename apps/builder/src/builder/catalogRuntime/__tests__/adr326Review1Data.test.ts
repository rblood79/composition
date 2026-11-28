import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  createComponent,
  insertCollectionItem,
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { setProjectVariable } from "../../../../../../packages/shared/src/catalog/commands/data";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  DataBindingRef,
  EntryId,
  NodeEntry,
  NodeId,
  ProjectVariableEntry,
  ProjectVariableId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  cascaderTableOf,
  cascaderValueMatch,
  type CascaderTable,
} from "../../../../../../packages/shared/src/catalog/runtime/cascader";
import { catalogBoundRows } from "../dataBinding";
import { catalogBindingCommand } from "../dataBindingCommand";
import { catalogProjectVariableDefs } from "../catalogDataRead";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-326 Phase 1 판독 (codex, 2026-11-28) 수리 — 데이터 쪽 지적: h2 컴포넌트 안 Cascader 의 단계
 * key · h3 컴포넌트 안 시작 경로 보존 · h4 변수로 쓴 시작 값 · h9 단계 표 전체 읽기 횟수. Builder 는
 * production 창 (100) 으로 읽는다. 기대값은 입력에서 손으로 적었다.
 */
const col = (id: string) =>
  `data:collection:${id}` as DataBindingRef["collectionId"];
const ref = (id: string) =>
  `data:field:${id}` as DataBindingRef["fieldMap"][string];
const BODY = "project:node:home-body" as NodeId;
const PLACED = "project:node:placed" as NodeId;
const FRAME = "project:node:frame" as NodeId;
const LEVEL2 = "project:node:level2" as NodeId;

/** 부모 `count` × 자식 `each` (`R<n>` · `R<n>-<m>`) — 평면 · 중첩 · 단계 표. */
function sources(shape: "flat" | "nested" | "levels", count: number, each = 1) {
  const parents = Array.from({ length: count }, (_, i) => ({
    id: `R${i + 1}`,
    name: `Root ${i + 1}`,
  }));
  const children = parents.flatMap((parent, i) =>
    Array.from({ length: each }, (_, j) => ({
      id: `R${i + 1}-${j + 1}`,
      name: `Child ${i + 1}-${j + 1}`,
      parent: parent.id,
    })),
  );
  const schema = (...keys: string[]) =>
    keys.map((key) => ({
      id: `f-${key}`,
      key,
      ...(key === "sub" ? { type: "array" } : {}),
    }));
  if (shape === "flat")
    return [
      {
        id: "t",
        schema: schema("id", "name", "parent"),
        mockData: [
          ...parents.map((row) => ({ ...row, parent: null })),
          ...children,
        ],
        useMockData: true,
      },
    ];
  if (shape === "nested")
    return [
      {
        id: "t",
        schema: schema("id", "name", "sub"),
        mockData: parents.map((row) => ({
          ...row,
          sub: children
            .filter((child) => child.parent === row.id)
            .map(({ id, name }) => ({ id, name })),
        })),
        useMockData: true,
      },
    ];
  return [
    {
      id: "t",
      schema: schema("id", "name"),
      mockData: parents,
      useMockData: true,
    },
    {
      id: "t2",
      schema: schema("id", "name", "parent"),
      mockData: children,
      useMockData: true,
    },
  ];
}

interface Open {
  shape: "flat" | "nested" | "levels";
  count: number;
  each?: number;
  start?: string;
  /** Wrap the Cascader in a frame and make that a component (its instance is read). */
  component?: boolean;
  /** The Preview's levels loaded one by one (`remoteLevels`). */
  remote?: boolean;
  value?: string;
  /** A project variable `chosen` = this. */
  chosen?: string;
}

async function open(input: Open) {
  const data = sources(input.shape, input.count, input.each);
  const library = await buildCodeCatalogLibrary();
  const reads = { whole: 0 };
  const workspace: CatalogWorkspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr326-review1-data" as EntryId<"project">,
        name: "ADR-326 review 1 data",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr326-review1-data-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
      root: {
        rows: (bound, kind, _owner, _path, slices) => {
          if (slices?.whole) reads.whole += 1;
          return input.remote
            ? catalogBoundRows(
                bound,
                data as never,
                kind,
                Number.MAX_SAFE_INTEGER,
                0,
                slices,
                true,
              )
            : catalogBoundRows(
                bound,
                data as never,
                kind,
                undefined,
                undefined,
                slices,
              );
        },
        state: {
          projectVariables: () =>
            catalogProjectVariableDefs(workspace.runtime.graph),
        },
      },
    },
  );
  if (input.chosen !== undefined)
    workspace.execute(
      setProjectVariable({
        entry: {
          kind: "projectVariable",
          id: "data:variable:chosen" as ProjectVariableId,
          name: "chosen",
          valueType: "string",
          defaultValue: input.chosen,
          persist: false,
        } satisfies ProjectVariableEntry,
      }),
    );
  const node = (id: NodeId, type: string, children: NodeId[] = []) =>
    ({
      kind: "node",
      id,
      definitionId: catalogPaletteDefinitionId(library, type),
      children,
      props: {},
      visual: {},
      sizing: {},
      descendantOverrides: [],
    }) satisfies NodeEntry;
  const cascader: NodeEntry = {
    ...node(PLACED, "Cascader"),
    props: input.start
      ? { defaultValue: { kind: "set", value: input.start } }
      : {},
  };
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: input.component
        ? [node(FRAME, "frame", [PLACED]), cascader]
        : [cascader],
      rootIds: [input.component ? FRAME : PLACED],
      newId: workspace.newId,
    }),
  );
  const value = input.value ?? "f-id";
  workspace.execute(
    catalogBindingCommand(
      [{ kind: "node", id: PLACED }],
      {
        collectionId: col("t"),
        fieldMap:
          input.shape === "flat"
            ? { value: ref(value), parentId: ref("f-parent") }
            : input.shape === "nested"
              ? { value: ref("f-id"), children: ref("f-sub") }
              : { value: ref("f-id") },
      },
      workspace.newId,
    ),
  );
  if (input.shape === "levels") {
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
  let instance: NodeId | undefined;
  if (input.component) {
    workspace.execute(
      createComponent({ id: FRAME, name: "Picker", newId: workspace.newId }),
    );
    const body = workspace.runtime.graph.getEntry(BODY) as NodeEntry;
    instance = body.children.find((id) => id !== FRAME);
  }
  const root = () => workspace.root;
  const get = (id: string) => root().domInputs.get(id);
  /** The Cascader field record drawn on the page (the instance's, when a component). */
  const field = () =>
    [...root().domInputs.values()].find(
      (record) =>
        root().typeOf(record) === "Cascader" &&
        (!instance || record.instancePath.includes(instance)),
    )!;
  const table = () =>
    cascaderTableOf(field(), get, (record) => root().typeOf(record));
  return { workspace, table, reads, instance };
}

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
  return { kind: "item", chain };
};

describe("ADR-326 Phase 1 판독 수리 — 데이터", () => {
  it("h2: 컴포넌트 안 Cascader — 행의 단계 key (ID) 가 항목 record 에 닿는다", async () => {
    const { table } = await open({
      shape: "flat",
      count: 2,
      remote: true,
      value: "f-name",
      component: true,
    });
    expect(table().entries.map((entry) => [entry.key, entry.levelKey])).toEqual(
      [
        ["Root 1", "R1"],
        ["Child 1-1", "R1-1"],
        ["Root 2", "R2"],
        ["Child 2-1", "R2-1"],
      ],
    );
  });

  it("h3: 컴포넌트 안 Cascader · 시작 `R120-1` — 세 모양 모두 item · 부모 R120 (소유 노드와 같다)", async () => {
    for (const shape of ["flat", "nested", "levels"] as const) {
      const { table } = await open({
        shape,
        count: 120,
        start: "R120-1",
        component: true,
      });
      expect(verdict(table(), "R120-1"), shape).toEqual({
        kind: "item",
        chain: ["R120"],
      });
    }
  });

  it("h4: 시작 값이 변수 (`{{ chosen }}` = R120-1) — 세 모양 모두 item · 부모 R120", async () => {
    for (const shape of ["flat", "nested", "levels"] as const) {
      const { table } = await open({
        shape,
        count: 120,
        start: "{{ chosen }}",
        chosen: "R120-1",
      });
      expect(verdict(table(), "R120-1"), shape).toEqual({
        kind: "item",
        chain: ["R120"],
      });
    }
  });

  it("h9: 단계 표 (부모 120 × 자식 5) — 시작 값 쓰기 한 번에 자식 표 전체 읽기는 두 번 이하", async () => {
    const { workspace, reads, table } = await open({
      shape: "levels",
      count: 120,
      each: 5,
    });
    reads.whole = 0;
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: PLACED }],
        props: { defaultValue: { kind: "set", value: "R120-4" } },
      } as never),
    );
    expect(reads.whole).toBeGreaterThan(0);
    expect(reads.whole).toBeLessThanOrEqual(2);
    expect(verdict(table(), "R120-4")).toEqual({
      kind: "item",
      chain: ["R120"],
    });
  });
});

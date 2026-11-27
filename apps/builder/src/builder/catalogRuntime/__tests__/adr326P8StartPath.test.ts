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
import type { CatalogBoundRow } from "../../../../../../packages/shared/src/catalog/resolution/resolver";
import {
  cascaderTable,
  cascaderTableOf,
  cascaderValueMatch,
  type CascaderSourceItem,
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
 * ADR-326 Phase 0 P8 (breakdown §4.7 · review h1) — 시작 경로 보존 시제품.
 *
 * (a) 지금의 코드 (실제 행 읽기 · resolver): Builder 의 창 100 이 시작 값을 자른다 — 부모 120 × 자식 1
 *     의 `R120-1` 이 Builder 표에서 `missing`, 전부 읽는 Preview 표에서 `item` (F15 재현).
 * (b) §4.7 의 규칙 모델: 창 앞에서 남길 key 를 판정하고 (그 key 를 가진 행 전부 + 조상) 행마다 원래의
 *     자식 유무를 싣는다. 뿌리를 자르는 평면 · 중첩은 실제 `catalogBoundRows` 가 만든 트리 위에서 뿌리만
 *     고르고, 단계 표는 resolver 의 「단계 창 → 부모 거르기 → 높이 표본」 (`resolver.ts:1752-1763`) 을
 *     옮긴 모델이다. 판정은 실제 `cascaderTable` · `cascaderValueMatch`. 기대값 = 계층 전체로 만든 표.
 *
 * 이 파일은 설계 판정용이다 — 실제 배선은 Phase 1 (G1) 과 대칭 하니스 (G5) 가 다시 잰다.
 */

const col = (id: string) =>
  `data:collection:${id}` as DataBindingRef["collectionId"];
const ref = (id: string) =>
  `data:field:${id}` as DataBindingRef["fieldMap"][string];

const flatBinding = (id: string): DataBindingRef => ({
  collectionId: col(id),
  fieldMap: { value: ref("f-id"), parentId: ref("f-parent") },
});
const nestedBinding = (id: string): DataBindingRef => ({
  collectionId: col(id),
  fieldMap: { value: ref("f-id"), children: ref("f-sub") },
});

const FLAT_SCHEMA = [
  { id: "f-id", key: "id" },
  { id: "f-name", key: "name" },
  { id: "f-parent", key: "parent" },
];
const NESTED_SCHEMA = [
  { id: "f-id", key: "id" },
  { id: "f-name", key: "name" },
  { id: "f-sub", key: "sub", type: "array" },
];
const LEVEL_SCHEMA = [
  { id: "l-id", key: "id" },
  { id: "l-name", key: "name" },
  { id: "l-parent", key: "parent" },
];

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
  const tables: Record<string, unknown>[][] = [];
  const walk = (
    level: readonly Node[],
    parent: string | null,
    depth: number,
  ) => {
    for (const node of level) {
      (tables[depth] ??= []).push({ id: node.key, name: node.name, parent });
      walk(node.children, node.key, depth + 1);
    }
  };
  walk(nodes, null, 0);
  return tables;
};

const source = (
  id: string,
  schema: readonly { id: string; key: string; type?: string }[],
  rows: readonly Record<string, unknown>[],
) => ({ id, schema, mockData: rows, useMockData: true }) as never;

/** A bound row as the field's source item (`cascaderStaticItems` reads the same fields). */
const itemOf = (row: CatalogBoundRow): CascaderSourceItem => ({
  key: row.itemKey ?? row.key,
  levelKey: row.key,
  name: String(row.values.name ?? ""),
  children: (row.children ?? []).map(itemOf),
});

// ───────────────────────────── (a) 지금의 코드 ─────────────────────────────

describe("ADR-326 P8 (a) — 지금의 코드: Builder 의 창이 시작 값을 자른다 (F15)", () => {
  it("평면 · 중첩: 창 100 의 `R120-1` = missing, 전부 = item (부모 R120)", () => {
    const shapes = [
      {
        binding: flatBinding("flat"),
        sources: [source("flat", FLAT_SCHEMA, flatRows(PARENTS_120))],
      },
      {
        binding: nestedBinding("nested"),
        sources: [source("nested", NESTED_SCHEMA, nestedRows(PARENTS_120))],
      },
    ];
    for (const { binding, sources } of shapes) {
      const builder = cascaderTable(
        catalogBoundRows(binding, sources, "items")!.map((row) => itemOf(row)),
      );
      const preview = cascaderTable(
        catalogBoundRows(
          binding,
          sources,
          "items",
          Number.MAX_SAFE_INTEGER,
        )!.map((row) => itemOf(row)),
      );
      expect(cascaderValueMatch(builder, "R120-1").kind).toBe("missing");
      const match = cascaderValueMatch(preview, "R120-1");
      expect(match.kind).toBe("item");
      expect(
        match.kind === "item" &&
          preview.byPathId.get(match.entry.parentPathId!)?.key,
      ).toBe("R120");
    }
  });

  it("단계 표 (실제 resolver): 창 100 의 `R120-1` = missing, 전부 = item", async () => {
    const tables = levelTables(PARENTS_120);
    const sources = [
      source("lv0", LEVEL_SCHEMA, tables[0]!),
      source("lv1", LEVEL_SCHEMA, tables[1]!),
    ];
    const tableWith = async (limit: number | undefined) => {
      const library = await buildCodeCatalogLibrary();
      const placed = "project:node:placed" as NodeId;
      const workspace = new CatalogWorkspace(
        new CatalogGraph(
          newCatalogProjectDocument({
            projectId: "project:project:adr326-p8" as EntryId<"project">,
            name: "ADR-326 P8",
          }),
          library,
        ),
        new CatalogStorage(indexedDB, `adr326-p8-${Math.random()}`),
        {
          engine: await nodeLayoutEngine(),
          viewport: { width: 1920, height: 1080 },
          autosaveSchedule: () => {},
          root: {
            rows: (bound, kind) =>
              catalogBoundRows(bound, sources, kind, limit),
          },
        },
      );
      workspace.execute(
        insertNodes({
          parent: { kind: "node", id: "project:node:home-body" as NodeId },
          entries: [
            {
              kind: "node",
              id: placed,
              definitionId: catalogPaletteDefinitionId(library, "Cascader"),
              children: [],
              props: {},
              visual: {},
              sizing: {},
              descendantOverrides: [],
            },
          ],
          rootIds: [placed],
          newId: workspace.newId,
        }),
      );
      workspace.execute(
        catalogBindingCommand(
          [{ kind: "node", id: placed }],
          { collectionId: col("lv0"), fieldMap: { value: ref("l-id") } },
          workspace.newId,
        ),
      );
      const graph = workspace.runtime.graph;
      const level1Id = (graph.getEntry(placed) as NodeEntry).children.find(
        (id) => {
          const child = graph.getEntry(id);
          return (
            child?.kind === "node" &&
            graph.getDefinition(child.definitionId)?.name === "CascaderItem"
          );
        },
      )!;
      const level2Id = "project:node:level2" as NodeId;
      workspace.execute(
        insertCollectionItem({
          host: { kind: "node", id: level1Id },
          entries: [
            {
              kind: "node",
              id: level2Id,
              definitionId: (graph.getEntry(level1Id) as NodeEntry)
                .definitionId,
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
            collectionId: col("lv1"),
            fieldMap: { value: ref("l-id"), levelParent: ref("l-parent") },
          },
          workspace.newId,
        ),
      );
      const root = workspace.root;
      const get = (id: string) => root.domInputs.get(id);
      return cascaderTableOf(
        get(root.recordsOfSource(placed)[0]!)!,
        get,
        (node) => root.typeOf(node),
      );
    };
    expect(cascaderValueMatch(await tableWith(undefined), "R120-1").kind).toBe(
      "missing",
    );
    expect(
      cascaderValueMatch(await tableWith(Number.MAX_SAFE_INTEGER), "R120-1")
        .kind,
    ).toBe("item");
  });
});

// ───────────────────────────── (b) §4.7 의 규칙 모델 ─────────────────────────────

type Shape = "flat" | "nested" | "levels";
interface Rule {
  /** 시작 key 를 가진 행 · 조상을 남긴다 (끄면 지금의 창). */
  readonly keep: boolean;
  /** 행이 원래의 자식 유무를 싣는다. */
  readonly childFlag: boolean;
}
const NOW: Rule = { keep: false, childFlag: false };
const DESIGN: Rule = { keep: true, childFlag: true };

const subtreeKeys = (row: CatalogBoundRow, into = new Set<string>()) => {
  into.add(row.itemKey ?? row.key);
  for (const child of row.children ?? []) subtreeKeys(child, into);
  return into;
};

/** The table the field builds from the whole hierarchy (the Preview's — every row). */
function wholeTable(shape: Shape, nodes: readonly Node[], anyLevel: boolean) {
  return sampleTable(
    shape,
    nodes,
    anyLevel,
    Number.MAX_SAFE_INTEGER,
    Number.MAX_SAFE_INTEGER,
    [],
    NOW,
  );
}

/**
 * The Builder's sample table: `window` = the row window (100 in production), `sample` = the
 * height sample of a level's rows (resolver `sampledRows`), under the rule.
 */
function sampleTable(
  shape: Shape,
  nodes: readonly Node[],
  anyLevel: boolean,
  window: number,
  sample: number,
  startKeys: readonly string[],
  rule: Rule,
): CascaderTable {
  const keys = new Set(startKeys);
  if (shape !== "levels") {
    const binding = shape === "flat" ? flatBinding("t") : nestedBinding("t");
    const sources = [
      shape === "flat"
        ? source("t", FLAT_SCHEMA, flatRows(nodes))
        : source("t", NESTED_SCHEMA, nestedRows(nodes)),
    ];
    // (The real row reader builds the tree; the rule only picks its roots — 하위 행은 자르지 않는다.)
    const roots = catalogBoundRows(
      binding,
      sources,
      "items",
      Number.MAX_SAFE_INTEGER,
    )!;
    const picked = roots.filter(
      (row, index) =>
        index < window ||
        (rule.keep && [...subtreeKeys(row)].some((key) => keys.has(key))),
    );
    return cascaderTable(
      picked.map((row) => itemOf(row)),
      { anyLevel },
    );
  }
  // 단계 표 — resolver.ts:1752-1763: 단계 창 → 부모 거르기 → 높이 표본.
  const tables = levelTables(nodes);
  type Row = { id: string; name: string; parent: string | null };
  const rowsOf = (depth: number) => (tables[depth] ?? []) as Row[];
  // 남길 행 (§4.7 표): 시작 key 를 가진 행 전부 + 그 조상 행 (부모 필드를 따라 윗 단계 표에서, 그 key 를
  // 가진 윗 행 전부 — 단계 표는 부모를 key 로 찾는다).
  const kept = tables.map(() => new Set<Row>());
  if (rule.keep) {
    for (let depth = tables.length - 1; depth >= 0; depth -= 1) {
      const below =
        depth + 1 < tables.length ? kept[depth + 1]! : new Set<Row>();
      const parents = new Set([...below].map((row) => row.parent));
      for (const row of rowsOf(depth))
        if (keys.has(row.id) || parents.has(row.id)) kept[depth]!.add(row);
    }
  }
  // 원래의 자식 유무: 아랫 단계 표 전체의 부모 필드 값 색인.
  const parentIndex = tables.map(
    (_, depth) => new Set(rowsOf(depth + 1).map((row) => row.parent)),
  );
  const level = (
    depth: number,
    parentKey: string | null,
  ): CascaderSourceItem[] => {
    const table = rowsOf(depth);
    const windowed = table.filter(
      (row, index) => index < window || kept[depth]!.has(row),
    );
    const own =
      depth === 0
        ? windowed
        : windowed.filter((row) => row.parent === parentKey);
    const shown =
      depth === 0
        ? own
        : own.filter((row, index) => index < sample || kept[depth]!.has(row));
    return shown.map((row) => {
      const children = level(depth + 1, row.id);
      return {
        key: row.id,
        levelKey: row.id,
        name: row.name,
        children,
        ...(!children.length &&
        rule.childFlag &&
        parentIndex[depth]!.has(row.id)
          ? { hasChildItems: true }
          : {}),
      };
    });
  };
  return cascaderTable(level(0, null), { anyLevel });
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

const SHAPES: readonly Shape[] = ["flat", "nested", "levels"];

describe("ADR-326 P8 (b) — 시작 경로 보존 규칙 (§4.7)", () => {
  it("(1) 부모 120 × 자식 1 · 시작 `R120-1`: 세 모양 모두 item · 부모 R120 — 보존을 끄면 missing", () => {
    for (const shape of SHAPES) {
      const sample = (rule: Rule) =>
        verdict(
          sampleTable(shape, PARENTS_120, false, 100, 12, ["R120-1"], rule),
          "R120-1",
        );
      expect(sample(DESIGN), shape).toEqual({
        kind: "item",
        chain: ["R120"],
        names: ["Root 120", "Child 120"],
      });
      expect(sample(DESIGN)).toEqual(
        verdict(wholeTable(shape, PARENTS_120, false), "R120-1"),
      );
      // 원복 RED: 보존을 끄면 지금의 창 — missing.
      expect(sample(NOW).kind, shape).toBe("missing");
    }
  });

  it("(2) 창 밖에 같은 key 가 하나 더: 두 쪽 모두 duplicate", () => {
    const nodes: Node[] = [
      ...PARENTS_120,
      {
        key: "R130",
        name: "Root 130",
        children: [{ key: "R5-1", name: "Again", children: [] }],
      },
    ];
    for (const shape of SHAPES) {
      expect(
        wholeTable(shape, nodes, false).byKey.get("R5-1")?.length,
        shape,
      ).toBe(2);
      expect(verdict(wholeTable(shape, nodes, false), "R5-1").kind, shape).toBe(
        "duplicate",
      );
      expect(
        verdict(
          sampleTable(shape, nodes, false, 100, 12, ["R5-1"], DESIGN),
          "R5-1",
        ).kind,
        shape,
      ).toBe("duplicate");
      // 지금의 창은 창 안의 하나만 보고 item 으로 고른다 (Preview 와 갈림).
      expect(
        verdict(
          sampleTable(shape, nodes, false, 100, 12, ["R5-1"], NOW),
          "R5-1",
        ).kind,
        shape,
      ).toBe("item");
    }
  });

  it("(3) Round 2 입력 — 뿌리 가지 X (유일한 자식이 아랫 표 102 행) · P 아래 잎 X (101 행): item · 부모 P — 자식 유무 표식을 끄면 duplicate", () => {
    // 단계 표: 둘째 표의 1 ~ 100 행은 F 아래, 101 행 = P 아래 잎 X, 102 행 = X 아래 c.
    const nodes: Node[] = [
      {
        key: "X",
        name: "Branch X",
        children: [{ key: "c", name: "Child c", children: [] }],
      },
      {
        key: "P",
        name: "Parent P",
        children: [{ key: "X", name: "Leaf X", children: [] }],
      },
      {
        key: "F",
        name: "Filler",
        children: Array.from({ length: 100 }, (_, i) => ({
          key: `f${i}`,
          name: `f${i}`,
          children: [],
        })),
      },
    ];
    // 둘째 표의 순서를 입력대로: F 의 100 행 → P 의 X (101) → X 의 c (102).
    const reorder = (list: Node[]) => [list[2]!, list[1]!, list[0]!];
    const tables = levelTables(reorder(nodes));
    expect(tables[1]!.slice(100).map((row) => [row.id, row.parent])).toEqual([
      ["X", "P"],
      ["c", "X"],
    ]);
    const ordered = reorder(nodes);
    const whole = verdict(wholeTable("levels", ordered, false), "X");
    expect(whole).toEqual({
      kind: "item",
      chain: ["P"],
      names: ["Parent P", "Leaf X"],
    });
    expect(
      verdict(
        sampleTable("levels", ordered, false, 100, 200, ["X"], DESIGN),
        "X",
      ),
    ).toEqual(whole);
    // 원복 RED: 자식 유무 표식을 끄면 뿌리 X 가 잎이 되어 겹침.
    expect(
      verdict(
        sampleTable("levels", ordered, false, 100, 200, ["X"], {
          keep: true,
          childFlag: false,
        }),
        "X",
      ).kind,
    ).toBe("duplicate");
    // 그림에도: 자식이 잘린 가지 행도 chevron (hasChildren) 을 갖는다.
    const table = sampleTable(
      "levels",
      ordered,
      false,
      100,
      200,
      ["X"],
      DESIGN,
    );
    expect(
      table.byKey.get("X")!.find((entry) => entry.depth === 0)!.hasChildren,
    ).toBe(true);
  });

  it("(4) 단계별 로드 — `11=서울` (읽지 않은 자식): 읽은 단계 없음이면 두 쪽 모두 `11` branch · `11-1` missing", () => {
    // Preview 세션의 판정 (catalogPreviewSession.ts:3093-3104) 을 순수 함수로 옮긴 것.
    const branchKeysOf = (
      rows: readonly Record<string, unknown>[],
      flagField: string | undefined,
      loaded: ReadonlySet<string>,
    ) => {
      const out = new Set<string>();
      for (const row of rows) {
        const key = row.id === undefined ? undefined : String(row.id);
        if (key === undefined || loaded.has(key)) continue;
        if (flagField === undefined || row[flagField] === true) out.add(key);
      }
      return out;
    };
    const rows = [
      { id: "11", name: "서울", hasChildren: true },
      { id: "26", name: "부산", hasChildren: false },
    ];
    const tableOf = (branchKeys: ReadonlySet<string> | undefined) =>
      cascaderTable(
        rows.map((row) => ({
          key: row.id,
          name: row.name,
          children: [],
          ...(branchKeys?.has(row.id) ? { hasChildItems: true } : {}),
        })),
      );
    const none = new Set<string>();
    const preview = tableOf(branchKeysOf(rows, "hasChildren", none));
    const builder = tableOf(branchKeysOf(rows, "hasChildren", none));
    for (const table of [preview, builder]) {
      expect(cascaderValueMatch(table, "11").kind).toBe("branch");
      expect(cascaderValueMatch(table, "11-1").kind).toBe("missing");
      expect(cascaderValueMatch(table, "26").kind).toBe("item");
    }
    // 지금의 Builder (branchKeys 없음): `11` 이 잎 → item (Preview 와 갈림, F19).
    expect(cascaderValueMatch(tableOf(undefined), "11").kind).toBe("item");
  });

  it("(5) 불변식 무작위 대조 — 고정 seed · 세 모양 × 창 크기 × 시작 key (겹치는 key 를 섞는다)", () => {
    let seed = 0x326;
    const random = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const pick = <T>(list: readonly T[]) =>
      list[Math.floor(random() * list.length)]!;
    let uid = 0;
    const POOL = ["X", "Y", "Z", "W"];
    const tree = (depth: number, prefix: string): Node[] => {
      const count =
        depth === 0
          ? 3 + Math.floor(random() * 25)
          : Math.floor(random() * (5 - depth));
      return Array.from({ length: count }, (_, i) => {
        const roll = random();
        const key =
          roll < 0.12
            ? pick(POOL)
            : roll < 0.18 && i > 0
              ? `${prefix}${i - 1}`
              : `${prefix}${i}`;
        return {
          key,
          name: `n${(uid += 1)}`,
          children: depth < 3 ? tree(depth + 1, `${key}.`) : [],
        };
      });
    };
    const counts = { cases: 0, nowDiffers: 0, flagOffDiffers: 0 };
    const mismatches: string[] = [];
    for (let run = 0; run < 60; run += 1) {
      const nodes = tree(0, `r${run}-`);
      const anyLevel = random() < 0.3;
      const allKeys = [...wholeTable("nested", nodes, anyLevel).byKey.keys()];
      for (const shape of SHAPES) {
        const whole = wholeTable(shape, nodes, anyLevel);
        for (const window of [1, 3, 7]) {
          for (const sample of [1, 2, 50]) {
            for (let k = 0; k < 4; k += 1) {
              const start = random() < 0.1 ? "nope" : pick(allKeys);
              const expected = verdict(whole, start);
              const got = verdict(
                sampleTable(
                  shape,
                  nodes,
                  anyLevel,
                  window,
                  sample,
                  [start],
                  DESIGN,
                ),
                start,
              );
              counts.cases += 1;
              if (JSON.stringify(got) !== JSON.stringify(expected))
                mismatches.push(
                  `${shape} run=${run} window=${window} sample=${sample} key=${start} any=${anyLevel}: ${JSON.stringify(got)} ≠ ${JSON.stringify(expected)}`,
                );
              if (
                JSON.stringify(
                  verdict(
                    sampleTable(
                      shape,
                      nodes,
                      anyLevel,
                      window,
                      sample,
                      [start],
                      NOW,
                    ),
                    start,
                  ),
                ) !== JSON.stringify(expected)
              )
                counts.nowDiffers += 1;
              if (
                shape === "levels" &&
                JSON.stringify(
                  verdict(
                    sampleTable(
                      shape,
                      nodes,
                      anyLevel,
                      window,
                      sample,
                      [start],
                      {
                        keep: true,
                        childFlag: false,
                      },
                    ),
                    start,
                  ),
                ) !== JSON.stringify(expected)
              )
                counts.flagOffDiffers += 1;
            }
          }
        }
      }
    }
    console.info("[adr326 P8 random]", JSON.stringify(counts));
    expect(mismatches.slice(0, 5)).toEqual([]);
    // 대조가 가르는 입력인지: 지금의 창 · 표식 끔은 같은 입력에서 갈린다.
    expect(counts.nowDiffers).toBeGreaterThan(0);
    expect(counts.flagOffDiffers).toBeGreaterThan(0);
  });

  it("(6) 비용 — 5,000 행 평면 연결에서 보존 판정 1 회 (원본 행 훑기)", () => {
    const nodes: Node[] = Array.from({ length: 1000 }, (_, i) => ({
      key: `R${i}`,
      name: `Root ${i}`,
      children: Array.from({ length: 4 }, (_, j) => ({
        key: `R${i}-${j}`,
        name: `c${j}`,
        children: [],
      })),
    }));
    const binding = flatBinding("t");
    const sources = [source("t", FLAT_SCHEMA, flatRows(nodes))];
    const time = (fn: () => void) => {
      const runs: number[] = [];
      for (let i = 0; i < 5; i += 1) {
        const at = performance.now();
        fn();
        runs.push(performance.now() - at);
      }
      return runs.sort((a, b) => a - b)[2]!;
    };
    // 지금의 Builder 읽기 (평면은 지금도 전체를 투영한 뒤 뿌리를 자른다).
    const now = time(() => void catalogBoundRows(binding, sources, "items"));
    // + 보존 판정: 뿌리마다 하위 key 훑기 (memo 없음 — 상한).
    const keep = time(() => {
      const roots = catalogBoundRows(
        binding,
        sources,
        "items",
        Number.MAX_SAFE_INTEGER,
      )!;
      const keys = new Set(["R999-3"]);
      roots.filter(
        (row, index) =>
          index < 100 || [...subtreeKeys(row)].some((key) => keys.has(key)),
      );
    });
    console.info(
      "[adr326 P8 cost]",
      JSON.stringify({
        rows: 5000,
        nowMs: +now.toFixed(2),
        keepMs: +keep.toFixed(2),
      }),
    );
    expect(keep).toBeGreaterThan(0);
  });
});

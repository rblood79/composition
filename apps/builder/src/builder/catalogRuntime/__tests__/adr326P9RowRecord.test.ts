import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  EntryId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  catalogCascaderItems,
  cascaderStaticItems,
  cascaderTableMemo,
  cascaderTableOf,
  type CascaderTable,
} from "../../../../../../packages/shared/src/catalog/runtime/cascader";
import type { CatalogConsumerNode } from "../../../../../../packages/shared/src/catalog/runtime/compositionRoot";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-326 Phase 0 P9 (breakdown §4.3 「항목 행 ↔ 항목 record」 · review h3) — 시제품.
 *
 * 질문 셋:
 *  1. 항목 표의 모든 항목 (`pathId`) 이 자기 CascaderItem record 하나로 되짚어지는가 — 방식 (columns · tree ·
 *     drill) 과 무관하게, 검색 결과도 같은 표 항목이다 (`cascaderSearch` 는 `table.entries` 를 거른다).
 *  2. 한 항목의 배경 편집이 그 record 의 「쓴 style」 (DOM 의 `writtenStyleOf` 가 읽는 `wroteStyleKey` · `visual`)
 *     에만 닿고, Undo 로 돌아오는가 — 이웃 항목 record 는 그대로.
 *  3. 모양 편집은 항목 표의 입력 (`cascaderStaticItems`) 을 바꾸지 않는가 — 표를 데이터 서명으로 memo 하면
 *     모양 편집이 표를 다시 만들지 않는다 (HC4). 이름 편집은 서명을 바꾼다 (memo 가 낡지 않는다).
 *
 * 기준값은 원본 template 의 항목 (이름 · key) 과 손으로 쓴 색이다 — 시스템이 만든 값이 아니다.
 */
const BODY = "project:node:home-body" as NodeId;
const PLACED = "project:node:placed" as NodeId;
const PAINT = "#123456";

async function place() {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr326-p9" as EntryId<"project">,
        name: "ADR-326 P9",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr326-p9-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
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
  const root = workspace.root;
  // (The DOM's records — what `delegatedDom.runtime.ts` `cascader` · `writtenStyleOf` read.)
  const get = (id: string) => root.domInputs.get(id);
  const typeOf = (node: CatalogConsumerNode) => root.typeOf(node);
  const cascader = () =>
    [...root.domInputs.values()].find((r) => r.sourceId === PLACED)!;
  const items = () => {
    const out: CatalogConsumerNode[] = [];
    const visit = (id: string) => {
      const node = get(id);
      if (!node || typeOf(node) !== "CascaderItem") return;
      out.push(node);
      node.children.forEach(visit);
    };
    // (ADR-326 Phase 1 — the items sit in the Popover's list box.)
    catalogCascaderItems(cascader(), get, typeOf).forEach((item) =>
      visit(item.id),
    );
    return out;
  };
  const edit = (record: CatalogConsumerNode, change: object) =>
    workspace.execute(
      setFields({
        targets: [workspace.itemOfRecord(record.id)!.target],
        ...change,
      } as never),
    );
  return { workspace, root, get, typeOf, cascader, items, edit };
}

/**
 * The prototype's `recordId` (§4.3): `cascaderStaticItems` walks the item records in table order, so
 * the table's entries and the records pair up by walking both the same way.
 */
function recordIds(
  table: CascaderTable,
  cascader: CatalogConsumerNode,
  get: (id: string) => CatalogConsumerNode | undefined,
  typeOf: (node: CatalogConsumerNode) => string,
): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (node: CatalogConsumerNode, parentPathId: string | null) => {
    const siblings = table.entries.filter(
      (entry) => entry.parentPathId === parentPathId,
    );
    const records = (
      typeOf(node) === "Cascader"
        ? catalogCascaderItems(node, get, typeOf)
        : node.children.map(get)
    ).filter(
      (child): child is CatalogConsumerNode =>
        !!child && typeOf(child) === "CascaderItem",
    );
    records.forEach((record, i) => {
      const entry = siblings[i];
      if (!entry) return;
      out.set(entry.pathId, record.id);
      walk(record, entry.pathId);
    });
  };
  walk(cascader, null);
  return out;
}

describe("ADR-326 P9 — 항목 행 ↔ 항목 record", () => {
  it("every table entry walks back to its own item record — in every mode", async () => {
    const t = await place();
    for (const mode of ["columns", "tree", "drill"]) {
      t.edit(t.cascader(), { props: { mode: { kind: "set", value: mode } } });
      const table = cascaderTableOf(t.cascader(), t.get, t.typeOf);
      const ids = recordIds(table, t.cascader(), t.get, t.typeOf);
      expect(table.entries.length).toBeGreaterThan(3);
      expect(ids.size).toBe(table.entries.length);
      for (const entry of table.entries) {
        const record = t.get(ids.get(entry.pathId)!)!;
        expect(record.props.label).toBe(entry.name);
        expect(String(record.props.id ?? record.id)).toBe(entry.key);
      }
      // (One record per entry — no two entries share a record.)
      expect(new Set(ids.values()).size).toBe(ids.size);
    }
    t.workspace.dispose();
  });

  it("one item's background reaches only its record's written style; Undo restores it", async () => {
    const t = await place();
    const books = t.items().find((item) => item.props.id === "books")!;
    expect(books).toBeDefined();
    const before = new Map(
      t.items().map((item) => [item.id, JSON.stringify(item.visual ?? {})]),
    );
    t.edit(books, {
      visual: { backgroundColor: { kind: "set", value: PAINT } },
    });
    for (const item of t.items()) {
      const wrote = t.root.wroteStyleKey(item, "backgroundColor");
      if (item.id === books.id) {
        expect(wrote).toBe(true);
        expect(item.visual?.backgroundColor).toBe(PAINT);
      } else {
        expect(wrote).toBe(false);
        expect(JSON.stringify(item.visual ?? {})).toBe(before.get(item.id));
      }
    }
    t.workspace.undo();
    for (const item of t.items()) {
      expect(t.root.wroteStyleKey(item, "backgroundColor")).toBe(false);
      expect(JSON.stringify(item.visual ?? {})).toBe(before.get(item.id));
    }
    t.workspace.dispose();
  });

  it("a style edit leaves the table's input unchanged (memo by data); a name edit changes it", async () => {
    const t = await place();
    const signature = () =>
      JSON.stringify(cascaderStaticItems(t.cascader(), t.get, t.typeOf));
    const start = signature();
    const books = t.items().find((item) => item.props.id === "books")!;
    t.edit(books, {
      visual: { backgroundColor: { kind: "set", value: PAINT } },
    });
    t.edit(books, { visual: { color: { kind: "set", value: "#ffffff" } } });
    expect(signature()).toBe(start);
    t.edit(books, { props: { label: { kind: "set", value: "Magazines" } } });
    expect(signature()).not.toBe(start);
    expect(signature()).toContain("Magazines");
    t.workspace.dispose();
  });

  it("ADR-326 Phase 2 — the DOM's table memo: a look edit keeps the table (and every entry's record); a name edit builds a new one", async () => {
    const t = await place();
    const table = () =>
      cascaderTableMemo(t.cascader(), t.get, t.typeOf, undefined);
    const start = table();
    const books = t.items().find((item) => item.props.id === "books")!;
    expect(start.entries.find((entry) => entry.key === "books")?.recordId).toBe(
      books.id,
    );
    t.edit(books, {
      visual: { backgroundColor: { kind: "set", value: PAINT } },
    });
    expect(table()).toBe(start);
    t.edit(books, { props: { label: { kind: "set", value: "Magazines" } } });
    const renamed = table();
    expect(renamed).not.toBe(start);
    expect(renamed.entries.find((entry) => entry.key === "books")?.name).toBe(
      "Magazines",
    );
    t.workspace.dispose();
  });

  it("the table memo keeps at most 64 Cascaders — the oldest built goes first", () => {
    const node = (id: string) =>
      ({ id, props: {}, children: [] }) as unknown as CatalogConsumerNode;
    const none = () => undefined;
    const first = cascaderTableMemo(node("memo-0"), none, () => "");
    expect(cascaderTableMemo(node("memo-0"), none, () => "")).toBe(first);
    for (let i = 1; i <= 64; i += 1)
      cascaderTableMemo(node(`memo-${i}`), none, () => "");
    // (`memo-0` was dropped — a new table for the same data.)
    expect(cascaderTableMemo(node("memo-0"), none, () => "")).not.toBe(first);
  });
});

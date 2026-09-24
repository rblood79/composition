import { describe, expect, it, vi } from "vitest";

import type {
  CanonicalNode,
  CompositionDocument,
  ResolvedNode,
} from "@composition/shared";

import { createInitialProjectDocument } from "../../../dashboard/createInitialProjectDocument";
import { buildCanonicalSceneModel } from "../../workspace/canvas/scene/canonicalSceneModel";
import { resolveCanonicalDocument } from "../../../resolvers/canonical";
import { isSlotHostElement } from "../slotHostPolicy";

/**
 * ADR-241 Phase 0 — 진단 RED (breakdown §4 Phase 0 (a)~(f), (g) 는 선행 수리 `71d61c68d` 에서 GREEN).
 * `it` = G0 실측 기준선 (이미 참). `it.fails` = 현재 결함 — 닫는 Phase 가 `it` 으로 바꾼다:
 *   (a) (e) → Phase 1 · (c) → Phase 2 (TableHeader) · Phase 3 (TableBody).
 *   (b) quick connect 의 ref instance 열 = `quickConnect.test.ts` "ref 인스턴스 · TableHeader 없는 노드는 컬럼 계획 없음" 이 기준선 (Phase 2 가 뒤집는다).
 *   (d) (f) 는 기준선만 — 셀 수 어긋난 TableView 는 이관 제외 (Phase 3 G3 가 불변 확인) · 셀 편집 경로는 이관 뒤 같은 셀에 닿아야 한다 (Phase 3).
 */

const TABLE_ORIGIN_ID = "component-table";
const TABLEVIEW_ORIGIN_ID = "component-tableview";

function seedDocument(): CompositionDocument {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  return createInitialProjectDocument(
    { id: "page-1", title: "P", slug: "/" },
    { id: "body-1", type: "body" },
  ) as CompositionDocument;
}

function find(
  nodes: readonly CanonicalNode[],
  id: string,
): CanonicalNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const hit = find(node.children ?? [], id);
    if (hit) return hit;
  }
  return undefined;
}

function findResolved(
  nodes: readonly ResolvedNode[],
  id: string,
): ResolvedNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const hit = findResolved((node.children ?? []) as ResolvedNode[], id);
    if (hit) return hit;
  }
  return undefined;
}

function withBodyChildren(
  doc: CompositionDocument,
  added: CanonicalNode[],
): CompositionDocument {
  const visit = (nodes: CanonicalNode[]): CanonicalNode[] =>
    nodes.map((node) =>
      node.id === "body-1"
        ? { ...node, children: [...(node.children ?? []), ...added] }
        : node.children
          ? { ...node, children: visit(node.children) }
          : node,
    );
  return { ...doc, children: visit(doc.children) };
}

const STATIC_BINDING = {
  type: "collection",
  source: "static",
  config: {
    data: [
      { id: 1, name: "Alice", email: "a@x.io", role: "Admin" },
      { id: 2, name: "Bob", email: "b@x.io", role: "User" },
    ],
  },
};

function columnOnlyTable(
  columns: Array<Record<string, unknown>>,
): CanonicalNode {
  return {
    id: "t1",
    type: "Table",
    props: { dataBinding: STATIC_BINDING },
    children: [
      {
        id: "t1-th",
        type: "TableHeader",
        props: {},
        children: columns.map((props, index) => ({
          id: `t1-col-${index + 1}`,
          type: "Column",
          props,
        })),
      },
      { id: "t1-tb", type: "TableBody", props: {} },
    ],
  } as unknown as CanonicalNode;
}

type SceneLike = {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  projection?: { kind?: string; isHeader?: boolean; columnId?: string };
};

/** Canvas projection 데이터 행 (header 제외) 과 각 행의 셀. */
function canvasDataRows(doc: CompositionDocument, tableId: string) {
  const model = buildCanonicalSceneModel(doc);
  const children = (id: string) =>
    (model.sceneChildrenByParent.get(id) ?? []) as SceneLike[];
  const rowsGroup = children(tableId).find((n) => n.type === "Rows");
  if (!rowsGroup) return [];
  return children(rowsGroup.id)
    .filter((row) => row.type === "TableRow" && !row.projection?.isHeader)
    .map((row) => children(row.id));
}

// ── (a) 두 leg 열 원천 불일치 ─────────────────────────────────────────────────
describe("ADR-241 진단 (a) — Column 요소만 있는 Table 의 Canvas 데이터 행 셀 (F3)", () => {
  const doc = () =>
    withBodyChildren(seedDocument(), [
      columnOnlyTable(
        ["name", "email", "role"].map((key) => ({ key, children: key })),
      ),
    ]);

  it("기준선: Preview 열 원천 (해석된 TableHeader 의 Column 요소) = 3 · Canvas 데이터 행 = 2", () => {
    const resolved = resolveCanonicalDocument(doc());
    const header = findResolved(resolved, "t1-th");
    expect(
      (header?.children ?? []).filter((c) => String(c.type) === "Column"),
    ).toHaveLength(3);
    expect(canvasDataRows(doc(), "t1")).toHaveLength(2);
  });

  it("Canvas 데이터 행마다 셀 3 (= Preview 열) — Phase 1 GREEN", () => {
    for (const cells of canvasDataRows(doc(), "t1")) {
      expect(cells.map((c) => c.projection?.columnId)).toEqual([
        "name",
        "email",
        "role",
      ]);
    }
  });
});

// ── (e) 열 폭 제한 ────────────────────────────────────────────────────────────
describe("ADR-241 진단 (e) — width 80 · minWidth 120 열의 Canvas 셀 폭 (리뷰 r1 m1)", () => {
  it(
    "Canvas 셀 폭 = TanStack getSize 120 (Preview) — Phase 1 GREEN",
    () => {
      const doc = withBodyChildren(seedDocument(), [
        columnOnlyTable([
          { key: "email", children: "Email", width: 80, minWidth: 120 },
        ]),
      ]);
      const [cells] = canvasDataRows(doc, "t1");
      expect(
        (cells?.[0]?.props?.style as Record<string, unknown> | undefined)
          ?.width,
      ).toBe(120);
    },
  );

  it("기준선: legacy `props.columns` 경로는 width 그대로 (clamp 없음 · 기본 100)", () => {
    const doc = withBodyChildren(seedDocument(), [
      {
        id: "t2",
        type: "Table",
        props: {
          dataBinding: STATIC_BINDING,
          columns: [
            { id: "email", label: "Email", width: 80 },
            { id: "name", label: "Name" },
          ],
        },
      } as unknown as CanonicalNode,
    ]);
    const [cells] = canvasDataRows(doc, "t2");
    expect(
      cells?.map((c) => (c.props?.style as Record<string, unknown>).width),
    ).toEqual([80, 100]);
  });
});

// ── (c) TableView instance 열 · 행 추가 경로 ─────────────────────────────────
describe("ADR-241 진단 (c) — Table · TableView origin 의 TableHeader · TableBody 에 slot 이 없다 (F2)", () => {
  it("기준선: Table origin = TableHeader · TableBody (Column 0) · TableView origin = Column 3 · Row 1 × Cell 3", () => {
    const doc = seedDocument();
    const table = find(doc.children, TABLE_ORIGIN_ID)!;
    expect(table.children?.map((c) => c.type)).toEqual([
      "TableHeader",
      "TableBody",
    ]);
    expect(table.children?.[0]?.children ?? []).toHaveLength(0);
    const tableView = find(doc.children, TABLEVIEW_ORIGIN_ID)!;
    const [header, body] = tableView.children ?? [];
    expect(header?.children?.map((c) => c.type)).toEqual([
      "Column",
      "Column",
      "Column",
    ]);
    expect(body?.children?.map((r) => r.children?.length)).toEqual([3]);
  });

  it.fails(
    "Table · TableView origin 의 TableHeader 는 slot host (Column origin 추천) — Phase 2 GREEN",
    () => {
      const doc = seedDocument();
      for (const originId of [TABLE_ORIGIN_ID, TABLEVIEW_ORIGIN_ID]) {
        const header = find(doc.children, originId)!.children![0]!;
        expect(Array.isArray(header.slot), originId).toBe(true);
        expect(isSlotHostElement(header as never), originId).toBe(true);
      }
    },
  );

  it.fails(
    "TableView origin 의 TableBody 는 slot host (Row origin 추천) — Phase 3 GREEN",
    () => {
      const body = find(seedDocument().children, TABLEVIEW_ORIGIN_ID)!
        .children![1]!;
      expect(Array.isArray(body.slot)).toBe(true);
      expect(isSlotHostElement(body as never)).toBe(true);
    },
  );
});

// ── (d) 셀 수가 열 수와 어긋난 TableView ─────────────────────────────────────
describe("ADR-241 진단 (d) — 셀 수 ≠ 열 수 TableView 의 두 leg 표시 (기준선 — Phase 3 이관 · 동기화 제외)", () => {
  const mismatched = (): CanonicalNode =>
    ({
      id: "tv1",
      type: "TableView",
      props: {},
      children: [
        {
          id: "tv1-th",
          type: "TableHeader",
          props: {},
          children: ["A", "B", "C", "D"].map((text, i) => ({
            id: `tv1-col-${i + 1}`,
            type: "Column",
            props: { children: text },
          })),
        },
        {
          id: "tv1-tb",
          type: "TableBody",
          props: {},
          children: [
            {
              id: "tv1-r1",
              type: "Row",
              props: {},
              children: [1, 2, 3].map((n) => ({
                id: `tv1-r1-c${n}`,
                type: "Cell",
                props: { children: `r1c${n}` },
              })),
            },
          ],
        },
      ],
    }) as unknown as CanonicalNode;

  it("기준선: Canvas · Preview 모두 행의 셀을 있는 그대로 (Column 4 · Cell 3)", () => {
    const doc = withBodyChildren(seedDocument(), [mismatched()]);
    const model = buildCanonicalSceneModel(doc);
    expect(
      (model.sceneChildrenByParent.get("tv1-r1") ?? []).map((n) => n.id),
    ).toEqual(["tv1-r1-c1", "tv1-r1-c2", "tv1-r1-c3"]);
    expect(
      (model.sceneChildrenByParent.get("tv1-th") ?? []).map((n) => n.type),
    ).toEqual(["Column", "Column", "Column", "Column"]);
    const resolved = resolveCanonicalDocument(doc);
    expect(findResolved(resolved, "tv1-r1")?.children).toHaveLength(3);
  });
});

// ── (f) 셀 편집 경로 ──────────────────────────────────────────────────────────
describe("ADR-241 진단 (f) — 바깥 TableView instance 가 origin 의 세 번째 셀을 고친 문서 (리뷰 r1 h1)", () => {
  // descendants 경로 = segment (`getCanonicalRefPathSegment` — customId · componentName · name · id).
  const CELL3_PATH = `${TABLEVIEW_ORIGIN_ID}__2/${TABLEVIEW_ORIGIN_ID}__2_1/${TABLEVIEW_ORIGIN_ID}__2_1_3`;
  const instance = (): CanonicalNode =>
    ({
      id: "tvi",
      type: "ref",
      ref: TABLEVIEW_ORIGIN_ID,
      props: {},
      descendants: { [CELL3_PATH]: { children: "Edited" } },
    }) as unknown as CanonicalNode;

  it("기준선: plain Row 의 세 번째 셀 patch 가 두 leg 에 적용된다 (Phase 3 이관 뒤에도 같은 셀에 닿아야 한다)", () => {
    const doc = withBodyChildren(seedDocument(), [instance()]);
    const model = buildCanonicalSceneModel(doc);
    const canvasCell = model.sceneNodesMap.get(`tvi/${CELL3_PATH}`) as
      SceneLike | undefined;
    expect(canvasCell?.props?.children).toBe("Edited");
    const resolved = resolveCanonicalDocument(doc);
    const previewRow = findResolved(resolved, "tvi")?.children?.[1]
      ?.children?.[0] as ResolvedNode | undefined;
    expect(
      (previewRow?.children?.[2] as ResolvedNode | undefined)?.props?.children,
    ).toBe("Edited");
  });
});

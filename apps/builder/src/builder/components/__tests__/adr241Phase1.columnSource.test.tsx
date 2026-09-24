import { describe, expect, it, vi } from "vitest";

import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import { createInitialProjectDocument } from "../../../dashboard/createInitialProjectDocument";
import { buildCanonicalSceneModel } from "../../workspace/canvas/scene/canonicalSceneModel";
import { applyImplicitStyles } from "../../workspace/canvas/layout/engines/implicitStyles";
import type { CanvasLayoutNode } from "../../workspace/canvas/layout/layoutNode";

/**
 * ADR-241 Phase 1 (G1) — 두 leg 열 원천 통일. Canvas 데이터 Table 은 해석된 TableHeader 의 Column 요소에서 열을 얻는다
 * (Preview TableRenderer 와 같은 reader `readTableColumnElements` — 폭 oracle 은 shared `tableColumnElements.test.ts` 의
 * TanStack getSize 대조). 헤더는 Column 요소가 그리므로 projection 헤더 행을 겹쳐 세우지 않고, Column 요소 폭 = 셀 폭.
 */

function seedDocument(): CompositionDocument {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  return createInitialProjectDocument(
    { id: "page-1", title: "P", slug: "/" },
    { id: "body-1", type: "body" },
  ) as CompositionDocument;
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

const BINDING = {
  type: "collection",
  source: "static",
  config: {
    data: [
      { id: 1, name: "Alice", email: "a@x.io", role: "Admin" },
      { id: 2, name: "Bob", email: "b@x.io", role: "User" },
    ],
  },
};

type SceneLike = {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  projection?: { kind?: string; isHeader?: boolean; columnId?: string };
};

function tableScene(doc: CompositionDocument, tableId: string) {
  const model = buildCanonicalSceneModel(doc);
  const children = (id: string) =>
    (model.sceneChildrenByParent.get(id) ?? []) as SceneLike[];
  const rowsGroup = children(tableId).find((n) => n.type === "Rows");
  const rows = rowsGroup ? children(rowsGroup.id) : [];
  return {
    rowsGroup,
    rows,
    cells: rows.map((row) => children(row.id)),
    childTypes: children(tableId).map((n) => n.type),
  };
}

const cellWidth = (cell: SceneLike | undefined) =>
  (cell?.props?.style as Record<string, unknown> | undefined)?.width;

describe("ADR-241 G1 — Canvas 데이터 Table 열 = Column 요소", () => {
  const plain = (columns: Array<Record<string, unknown>>): CanonicalNode =>
    ({
      id: "t1",
      type: "Table",
      props: { dataBinding: BINDING },
      children: [
        {
          id: "t1-th",
          type: "TableHeader",
          props: {},
          children: columns.map((props, i) => ({
            id: `t1-col-${i + 1}`,
            type: "Column",
            props,
          })),
        },
        { id: "t1-tb", type: "TableBody", props: {} },
      ],
    }) as unknown as CanonicalNode;

  it("데이터 행마다 셀 = Column 요소 순서 · key · 유효 폭 · 글자 = 데이터 값", () => {
    const doc = withBodyChildren(seedDocument(), [
      plain([
        { key: "name", children: "Name" },
        { key: "email", children: "Email", width: 80, minWidth: 120 },
        { children: "Role", width: 90, maxWidth: 60 },
      ]),
    ]);
    const { rows, cells, rowsGroup } = tableScene(doc, "t1");
    // 헤더 = Column 요소 (projection 헤더 행 없음)
    expect(rows.map((r) => r.projection?.isHeader)).toEqual([false, false]);
    expect(cells[0]!.map((c) => c.projection?.columnId)).toEqual([
      "name",
      "email",
      "role",
    ]);
    expect(cells[0]!.map(cellWidth)).toEqual([150, 120, 60]);
    expect(cells[1]!.map((c) => c.props?.children)).toEqual([
      "Bob",
      "b@x.io",
      "User",
    ]);
    expect(
      (rowsGroup?.props?.style as Record<string, unknown> | undefined)?.width,
    ).toBe(330);
  });

  it("legacy `props.columns` 만 있는 Table 은 종전 그대로 (projection 헤더 행 · width 원값 · 기본 100)", () => {
    const doc = withBodyChildren(seedDocument(), [
      {
        id: "t2",
        type: "Table",
        props: {
          dataBinding: BINDING,
          columns: [
            { id: "email", label: "Email", width: 80 },
            { id: "name", label: "Name" },
          ],
        },
      } as unknown as CanonicalNode,
    ]);
    const { rows, cells } = tableScene(doc, "t2");
    expect(rows.map((r) => r.projection?.isHeader)).toEqual([
      true,
      false,
      false,
    ]);
    expect(cells[0]!.map((c) => c.props?.children)).toEqual(["Email", "Name"]);
    expect(cells[1]!.map(cellWidth)).toEqual([80, 100]);
  });

  it("Column 요소와 `props.columns` 가 같이 있으면 Column 요소 (Preview 가 읽는 쪽)", () => {
    const table = plain([{ key: "role", children: "Role" }]);
    (table.props as Record<string, unknown>).columns = [
      { id: "email", label: "Email", width: 80 },
    ];
    const { cells } = tableScene(
      withBodyChildren(seedDocument(), [table]),
      "t1",
    );
    expect(cells[0]!.map((c) => c.projection?.columnId)).toEqual(["role"]);
  });

  it("ref instance 의 TableHeader mode C 열 (instance 자기 열) 을 읽는다", () => {
    const doc = withBodyChildren(seedDocument(), [
      {
        id: "ti",
        type: "ref",
        ref: "component-table",
        props: { dataBinding: BINDING },
        descendants: {
          "component-table__1": {
            children: [
              { id: "ti-c1", type: "Column", props: { key: "email" } },
              { id: "ti-c2", type: "Column", props: { key: "name" } },
            ],
          },
        },
      } as unknown as CanonicalNode,
    ]);
    const { cells } = tableScene(doc, "ti");
    expect(cells.map((row) => row.map((c) => c.props?.children))).toEqual([
      ["a@x.io", "Alice"],
      ["b@x.io", "Bob"],
    ]);
  });

  it("바인딩 없는 Table 은 projection 없음 (빈 테이블 — 종전)", () => {
    const table = plain([{ key: "a" }]);
    table.props = {};
    const { rowsGroup } = tableScene(
      withBodyChildren(seedDocument(), [table]),
      "t1",
    );
    expect(rowsGroup).toBeUndefined();
  });
});

describe("ADR-241 G1 — Column 요소 layout 폭 = 셀 폭", () => {
  const node = (
    id: string,
    type: string,
    parentId: string | null,
    props: Record<string, unknown> = {},
  ): CanvasLayoutNode =>
    ({
      id,
      type,
      page_id: "page-1",
      parent_id: parentId,
      props,
    }) as unknown as CanvasLayoutNode;

  function runHeader(parentType: string, columnProps: Record<string, unknown>) {
    const owner = node("owner", parentType, "body");
    const header = node("th", "TableHeader", "owner");
    const column = node("col", "Column", "th", columnProps);
    const map = new Map<string, CanvasLayoutNode>([
      ["owner", owner],
      ["th", header],
      ["col", column],
    ]);
    const result = applyImplicitStyles(header, [column], () => [], map);
    return (result.filteredChildren[0]!.props?.style ?? {}) as Record<
      string,
      unknown
    >;
  }

  it("data Table 의 Column 은 유효 폭 고정 (flex 균등 분할 대신)", () => {
    expect(runHeader("Table", { width: 80, minWidth: 120 })).toMatchObject({
      width: 120,
      flexBasis: "auto",
      flexGrow: 0,
      flexShrink: 0,
    });
    expect(runHeader("Table", {}).width).toBe(150);
  });

  it("TableView 의 Column 은 종전 그대로 (폭 주입 없음)", () => {
    expect(runHeader("TableView", { width: 80 })).not.toHaveProperty("width");
  });
});

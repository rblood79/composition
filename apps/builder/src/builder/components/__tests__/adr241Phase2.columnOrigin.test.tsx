import { describe, expect, it, vi } from "vitest";

import type {
  CanonicalNode,
  CompositionDocument,
  ResolvedNode,
} from "@composition/shared";

import { createInitialProjectDocument } from "../../../dashboard/createInitialProjectDocument";
import { buildCanonicalSceneModel } from "../../workspace/canvas/scene/canonicalSceneModel";
import { resolveCanonicalDocument } from "../../../resolvers/canonical";
import {
  isSlotContractItem,
  isSlotHostElement,
  resolveSlotInsertAction,
} from "../slotHostPolicy";
import { ensureReusableCompositeOrigins } from "../reusableCompositeOrigins";
import {
  TABLE_COLUMN_ORIGIN_ID,
  ensureTableOrigins,
  ensureTableOriginsInSnapshot,
} from "../tableOrigins";
import {
  planPreviewDetectedColumns,
  planTableColumnInsert,
  resolveTableHeaderHostId,
} from "../tableColumnInsert";

/**
 * ADR-241 Phase 2 (G2) — Column origin · TableHeader slot · instance 자기 열 (mode C) · key 유일.
 * store 경유 쓰기 (Slot "+" · quick connect · ADD_COLUMN_ELEMENTS · undo) 는 `adr241Phase2.columnWrites.test.tsx`.
 */

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

function mapNodes(
  doc: CompositionDocument,
  fn: (node: CanonicalNode) => CanonicalNode,
): CompositionDocument {
  const visit = (nodes: CanonicalNode[]): CanonicalNode[] =>
    nodes.map((node) => {
      const next = fn(node);
      return next.children ? { ...next, children: visit(next.children) } : next;
    });
  return { ...doc, children: visit(doc.children) };
}

function withBodyChildren(
  doc: CompositionDocument,
  added: CanonicalNode[],
): CompositionDocument {
  return mapNodes(doc, (node) =>
    node.id === "body-1"
      ? { ...node, children: [...(node.children ?? []), ...added] }
      : node,
  );
}

const BINDING = {
  type: "collection",
  source: "static",
  config: { data: [{ id: 1, column1: "A1", column2: "B1", email: "e" }] },
};

type SceneLike = {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  projection?: { columnId?: string };
};

function canvasFirstRowColumnIds(doc: CompositionDocument, tableId: string) {
  const model = buildCanonicalSceneModel(doc);
  const children = (id: string) =>
    (model.sceneChildrenByParent.get(id) ?? []) as SceneLike[];
  const rowsGroup = children(tableId).find((n) => n.type === "Rows");
  const [row] = rowsGroup ? children(rowsGroup.id) : [];
  return row ? children(row.id).map((cell) => cell.projection?.columnId) : [];
}

/** 계획을 문서에 적용 (store 없이 — plain 은 header 자식 추가, instance 는 descendants 교체). */
function applyPlan(
  doc: CompositionDocument,
  plan: NonNullable<ReturnType<typeof planTableColumnInsert>>,
): CompositionDocument {
  return mapNodes(doc, (node) => {
    if (plan.kind === "plain" && node.id === plan.headerId) {
      return {
        ...node,
        children: [
          ...(node.children ?? []).filter(
            (child) => !plan.removeIds.includes(child.id),
          ),
          ...plan.columns,
        ],
      };
    }
    if (plan.kind === "instance" && node.id === plan.instanceId) {
      return { ...node, descendants: plan.descendants } as CanonicalNode;
    }
    return node;
  });
}

describe("ADR-241 G2 — Column origin · TableHeader slot", () => {
  it("새 문서: Column origin (Components · 팔레트 밖) · Table · TableView TableHeader slot = [Column origin]", () => {
    const doc = seedDocument();
    const origin = find(doc.children, TABLE_COLUMN_ORIGIN_ID);
    expect(origin).toMatchObject({
      type: "Column",
      reusable: true,
      props: { children: "Column" },
    });
    for (const ownerId of ["component-table", "component-tableview"]) {
      const header = find(doc.children, ownerId)!.children![0]!;
      expect(header.slot, ownerId).toEqual([TABLE_COLUMN_ORIGIN_ID]);
      expect(isSlotHostElement(header as never)).toBe(true);
      expect(
        resolveSlotInsertAction(header as never, origin as never).kind,
      ).toBe("table-column");
    }
  });

  it("멱등 (재hydration 같은 객체) · 사용자가 바꾼 slot 은 보존", () => {
    const doc = seedDocument();
    expect(JSON.stringify(ensureReusableCompositeOrigins(doc))).toBe(
      JSON.stringify(doc),
    );
    expect(ensureTableOrigins(doc)).toBe(doc);
    const custom = mapNodes(doc, (node) =>
      node.id === "component-table__1" ? { ...node, slot: [] } : node,
    );
    const again = ensureReusableCompositeOrigins(custom);
    expect(find(again.children, "component-table__1")?.slot).toEqual([]);
  });

  it("slot 계약 경고는 ref instance 열만 — plain Column (quick connect · 이관 전) 은 대조 밖", () => {
    const header = {
      id: "h",
      type: "TableHeader",
      slot: [TABLE_COLUMN_ORIGIN_ID],
    };
    expect(isSlotContractItem(header as never, { type: "Column" })).toBe(false);
    expect(
      isSlotContractItem(header as never, {
        type: "Column",
        _resolvedFrom: TABLE_COLUMN_ORIGIN_ID,
      }),
    ).toBe(true);
  });

  it("history 스냅샷: Column origin 이전 Components body 스냅샷에 origin · slot 보충 (Undo 재생 뒤 instance 열 유지)", () => {
    const doc = seedDocument();
    const body = find(doc.children, "page-components-body")!;
    const old = {
      ...body,
      children: (body.children ?? [])
        .filter((child) => child.id !== TABLE_COLUMN_ORIGIN_ID)
        .map((child) =>
          child.id === "component-table"
            ? {
                ...child,
                children: child.children!.map((c) => {
                  const { slot: _slot, ...rest } = c;
                  return rest as CanonicalNode;
                }),
              }
            : child,
        ),
    };
    const migrated = ensureTableOriginsInSnapshot(old);
    expect(
      migrated.children?.some((child) => child.id === TABLE_COLUMN_ORIGIN_ID),
    ).toBe(true);
    expect(
      migrated.children?.find((c) => c.id === "component-table")?.children?.[0]
        ?.slot,
    ).toEqual([TABLE_COLUMN_ORIGIN_ID]);
    expect(ensureTableOriginsInSnapshot(migrated)).toBe(migrated);
  });
});

describe('ADR-241 G2 — 열 삽입 계획 (Slot "+")', () => {
  const plainTable = (): CanonicalNode =>
    ({
      id: "t1",
      type: "Table",
      props: { dataBinding: BINDING },
      children: [
        { id: "t1-th", type: "TableHeader", props: {} },
        { id: "t1-tb", type: "TableBody", props: {} },
      ],
    }) as unknown as CanonicalNode;

  it("plain Table: Column instance 자식 · key 유일 (column1 → column2) · 두 leg 열", () => {
    let doc = withBodyChildren(seedDocument(), [plainTable()]);
    expect(resolveTableHeaderHostId(doc, "t1")).toBe("t1-th");
    for (let i = 0; i < 2; i += 1) {
      const plan = planTableColumnInsert({ document: doc, hostId: "t1-th" });
      expect(plan?.kind).toBe("plain");
      doc = applyPlan(doc, plan!);
    }
    const header = find(doc.children, "t1-th")!;
    expect(
      header.children?.map((c) => [
        c.type,
        (c as { ref?: string }).ref,
        c.props?.key,
      ]),
    ).toEqual([
      ["ref", TABLE_COLUMN_ORIGIN_ID, "column1"],
      ["ref", TABLE_COLUMN_ORIGIN_ID, "column2"],
    ]);
    expect(canvasFirstRowColumnIds(doc, "t1")).toEqual(["column1", "column2"]);
    const resolvedHeader = findResolved(resolveCanonicalDocument(doc), "t1-th");
    expect(
      resolvedHeader?.children?.map((c) => [
        c.type,
        c.props?.key,
        c.props?.children,
      ]),
    ).toEqual([
      ["Column", "column1", "Column 1"],
      ["Column", "column2", "Column 2"],
    ]);
  });

  it("key 는 형제의 유효 key (plain 열 · 글자 유래 key) 와 겹치지 않는다", () => {
    const table = plainTable();
    table.children![0]!.children = [
      { id: "p1", type: "Column", props: { key: "column2" } },
      { id: "p2", type: "Column", props: { children: "Column3" } },
    ] as unknown as CanonicalNode[];
    const doc = withBodyChildren(seedDocument(), [table]);
    const plan = planTableColumnInsert({ document: doc, hostId: "t1-th" });
    expect(plan?.kind === "plain" && plan.columns[0]?.props?.key).toBe(
      "column4",
    );
  });

  it("팔레트 Table instance: mode C 자기 열 → Canvas 데이터 셀 · Preview 열", () => {
    let doc = withBodyChildren(seedDocument(), [
      {
        id: "ti",
        type: "ref",
        ref: "component-table",
        props: { dataBinding: BINDING },
      } as unknown as CanonicalNode,
    ]);
    const hostId = resolveTableHeaderHostId(doc, "ti")!;
    expect(hostId).toBe("ti/component-table__1");
    doc = applyPlan(doc, planTableColumnInsert({ document: doc, hostId })!);
    doc = applyPlan(doc, planTableColumnInsert({ document: doc, hostId })!);
    const inst = find(doc.children, "ti") as {
      descendants?: Record<string, { children: CanonicalNode[] }>;
    };
    expect(
      inst.descendants?.["component-table__1"]?.children.map(
        (c) => c.props?.key,
      ),
    ).toEqual(["column1", "column2"]);
    // origin 불변
    expect(
      find(doc.children, "component-table__1")?.children ?? [],
    ).toHaveLength(0);
    expect(canvasFirstRowColumnIds(doc, "ti")).toEqual(["column1", "column2"]);
    const resolved = findResolved(resolveCanonicalDocument(doc), "ti");
    const header = resolved?.children?.find(
      (c) => String(c.type) === "TableHeader",
    );
    expect(header?.children?.map((c) => c.props?.key)).toEqual([
      "column1",
      "column2",
    ]);
  });

  it("TableView instance: 첫 mode C 는 origin 열을 복제해 이어 쓰고 그 열의 바깥 글자 patch 를 옮긴다", () => {
    let doc = withBodyChildren(seedDocument(), [
      {
        id: "tvi",
        type: "ref",
        ref: "component-tableview",
        props: {},
        descendants: {
          "component-tableview__1/component-tableview__1_2": {
            children: "Kind",
          },
        },
      } as unknown as CanonicalNode,
    ]);
    const hostId = resolveTableHeaderHostId(doc, "tvi")!;
    doc = applyPlan(doc, planTableColumnInsert({ document: doc, hostId })!);
    const inst = find(doc.children, "tvi") as {
      descendants?: Record<string, { children?: CanonicalNode[] }>;
    };
    expect(
      inst.descendants?.["component-tableview__1"]?.children?.map(
        (c) => c.props?.children,
      ),
    ).toEqual(["Name", "Kind", "Status", "Column 4"]);
    expect(
      inst.descendants?.["component-tableview__1/component-tableview__1_2"],
    ).toBeUndefined();
    const resolved = findResolved(resolveCanonicalDocument(doc), "tvi");
    const header = resolved?.children?.find(
      (c) => String(c.type) === "TableHeader",
    );
    expect(header?.children?.map((c) => c.props?.children)).toEqual([
      "Name",
      "Kind",
      "Status",
      "Column 4",
    ]);
  });

  it("Preview 열 감지 (ADD_COLUMN_ELEMENTS) 가 instance TableHeader 로 오면 mode C 자기 열 · 이미 열이 있으면 null", () => {
    let doc = withBodyChildren(seedDocument(), [
      {
        id: "ti",
        type: "ref",
        ref: "component-table",
        props: { dataBinding: BINDING },
      } as unknown as CanonicalNode,
    ]);
    const payload = [
      {
        id: "col_1",
        type: "Column",
        props: { key: "email", label: "Email", children: "Email", width: 150 },
      },
    ];
    const plan = planPreviewDetectedColumns(
      doc,
      "ti/component-table__1",
      payload,
    );
    expect(plan?.kind).toBe("instance");
    expect(plan?.columns[0]?.props).toEqual({
      width: 150,
      label: "Email",
      key: "email",
      children: "Email",
    });
    doc = applyPlan(doc, plan!);
    expect(canvasFirstRowColumnIds(doc, "ti")).toEqual(["email"]);
    expect(
      planPreviewDetectedColumns(doc, "ti/component-table__1", payload),
    ).toBeNull();
  });

  it("replace (quick connect 재연결): 기존 열 제거 + schema 열 — plain · instance", () => {
    const table = plainTable();
    table.children![0]!.children = [
      { id: "old", type: "Column", props: { key: "legacy" } },
    ] as unknown as CanonicalNode[];
    const doc = withBodyChildren(seedDocument(), [table]);
    const plan = planTableColumnInsert({
      document: doc,
      hostId: "t1-th",
      replace: true,
      columns: [{ key: "email", label: "Email", props: { width: 150 } }],
    });
    expect(plan).toMatchObject({ kind: "plain", removeIds: ["old"] });
    expect(plan?.kind === "plain" && plan.columns[0]?.props).toEqual({
      width: 150,
      key: "email",
      children: "Email",
    });
  });
});

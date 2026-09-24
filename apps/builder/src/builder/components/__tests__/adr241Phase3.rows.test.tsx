import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  CanonicalNode,
  CompositionDocument,
  ResolvedNode,
} from "@composition/shared";
import { moveCanonicalChild } from "@composition/shared";

import { createInitialProjectDocument } from "../../../dashboard/createInitialProjectDocument";
import { buildCanonicalSceneModel } from "../../workspace/canvas/scene/canonicalSceneModel";
import { resolveCanonicalDocument } from "../../../resolvers/canonical";
import {
  registerCanonicalMutationStoreActions,
  resetCanonicalMutationStoreActions,
} from "@/adapters/canonical/canonicalMutations";
import { useCanonicalDocumentStore } from "../../stores/canonical/canonicalDocumentStore";
import { useStore } from "../../stores/elements";
import { historyManager } from "../../stores/history";
import { applyCanonicalHistoryEventsToDocument } from "../../stores/history/canonicalHistoryEvents";
import { isSlotHostElement, resolveSlotInsertAction } from "../slotHostPolicy";
import {
  TABLE_ROW_ORIGIN_ID,
  ensureTableOrigins,
  ensureTableOriginsInSnapshot,
} from "../tableOrigins";
import {
  planTableColumnInsert,
  planTableRowInsert,
  resolveTableHeaderHostId,
} from "../tableColumnInsert";

/**
 * ADR-241 Phase 3 (G3) — Row origin · TableBody slot · 셀 동기화 (추가 · 삭제 · 순서) · TableView 이관 (plain 열/행 → ref, id 유지,
 * 셀 수 어긋난 TableView 제외) · 이관 뒤 기존 셀 편집 (행 안 · 바깥 instance) 동일.
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

/** 사용자 plain TableView (이관 전 모양) — 열 `cols` · 행 `rows` (행마다 셀 글자). */
function plainTableView(
  id: string,
  cols: string[],
  rows: string[][],
): CanonicalNode {
  return {
    id,
    type: "TableView",
    props: {},
    children: [
      {
        id: `${id}-th`,
        type: "TableHeader",
        props: {},
        children: cols.map((text, i) => ({
          id: `${id}-col-${i + 1}`,
          type: "Column",
          props: { children: text },
        })),
      },
      {
        id: `${id}-tb`,
        type: "TableBody",
        props: {},
        children: rows.map((cells, r) => ({
          id: `${id}-r${r + 1}`,
          type: "Row",
          props: {},
          children: cells.map((text, c) => ({
            id: `${id}-r${r + 1}-c${c + 1}`,
            type: "Cell",
            props: { children: text },
          })),
        })),
      },
    ],
  } as unknown as CanonicalNode;
}

/** Canvas: TableView 의 행 → 셀 글자. */
function canvasRows(doc: CompositionDocument, tableViewId: string) {
  const model = buildCanonicalSceneModel(doc);
  const children = (id: string) => model.sceneChildrenByParent.get(id) ?? [];
  const body = children(tableViewId).find((n) => n.type === "TableBody");
  return children(body!.id).map((row) =>
    children(row.id).map(
      (cell) => (cell as { props?: Record<string, unknown> }).props?.children,
    ),
  );
}

function canvasColumns(doc: CompositionDocument, tableViewId: string) {
  const model = buildCanonicalSceneModel(doc);
  const children = (id: string) => model.sceneChildrenByParent.get(id) ?? [];
  const header = children(tableViewId).find((n) => n.type === "TableHeader");
  return children(header!.id).map(
    (c) => (c as { props?: Record<string, unknown> }).props?.children,
  );
}

/** Preview: TableView 의 행 → 셀 글자 (해석 트리). */
function previewRows(doc: CompositionDocument, tableViewId: string) {
  const tv = findResolved(resolveCanonicalDocument(doc), tableViewId)!;
  const body = tv.children?.find(
    (c) => String(c.type) === "TableBody",
  ) as ResolvedNode;
  return (body.children ?? []).map((row) =>
    ((row as ResolvedNode).children ?? []).map((c) => c.props?.children),
  );
}

function applyColumnPlan(
  doc: CompositionDocument,
  plan: NonNullable<ReturnType<typeof planTableColumnInsert>>,
): CompositionDocument {
  if (plan.kind === "instance") {
    return mapNodes(doc, (node) =>
      node.id === plan.instanceId
        ? ({ ...node, descendants: plan.descendants } as CanonicalNode)
        : node,
    );
  }
  return mapNodes(doc, (node) => {
    if (node.id === plan.headerId) {
      return { ...node, children: [...(node.children ?? []), ...plan.columns] };
    }
    const cells = plan.cells.filter((c) => c.rowId === node.id);
    return cells.length > 0
      ? {
          ...node,
          children: [...(node.children ?? []), ...cells.map((c) => c.cell)],
        }
      : node;
  });
}

function applyRowPlan(
  doc: CompositionDocument,
  plan: NonNullable<ReturnType<typeof planTableRowInsert>>,
): CompositionDocument {
  return mapNodes(doc, (node) => {
    if (plan.kind === "instance") {
      return node.id === plan.instanceId
        ? ({ ...node, descendants: plan.descendants } as CanonicalNode)
        : node;
    }
    return node.id === plan.bodyId
      ? { ...node, children: [...(node.children ?? []), plan.row] }
      : node;
  });
}

describe("ADR-241 G3 — Row origin · TableBody slot · origin 이관", () => {
  it("새 문서: Row origin · TableView origin TableBody slot · 행 = Row ref (id 유지) + 자기 셀 3 → 두 leg 셀 3", () => {
    const doc = seedDocument();
    expect(find(doc.children, TABLE_ROW_ORIGIN_ID)).toMatchObject({
      type: "Row",
      reusable: true,
    });
    const body = find(doc.children, "component-tableview__2")!;
    expect(body.slot).toEqual([TABLE_ROW_ORIGIN_ID]);
    expect(isSlotHostElement(body as never)).toBe(true);
    expect(
      resolveSlotInsertAction(
        body as never,
        find(doc.children, TABLE_ROW_ORIGIN_ID) as never,
      ).kind,
    ).toBe("table-row");
    expect(canvasRows(doc, "component-tableview")).toEqual([
      ["Item 1", "File", "Active"],
    ]);
    expect(previewRows(doc, "component-tableview")).toEqual([
      ["Item 1", "File", "Active"],
    ]);
  });

  it("사용자 plain TableView 이관: 열 · 행 → ref (id 유지 · 셀 노드째) · 두 leg 글자 · 순서 불변 · 멱등", () => {
    const before = withBodyChildren(seedDocument(), [
      plainTableView(
        "tv",
        ["A", "B"],
        [
          ["a1", "b1"],
          ["a2", "b2"],
        ],
      ),
    ]);
    const after = ensureTableOrigins(before);
    const tv = find(after.children, "tv")!;
    expect(
      tv.children![0]!.children!.map((c) => [
        c.id,
        c.type,
        (c as { ref?: string }).ref,
      ]),
    ).toEqual([
      ["tv-col-1", "ref", "component-table-column"],
      ["tv-col-2", "ref", "component-table-column"],
    ]);
    expect(
      tv.children![1]!.children!.map((r) => [
        r.id,
        (r as { ref?: string }).ref,
        r.children?.map((c) => c.id),
      ]),
    ).toEqual([
      ["tv-r1", TABLE_ROW_ORIGIN_ID, ["tv-r1-c1", "tv-r1-c2"]],
      ["tv-r2", TABLE_ROW_ORIGIN_ID, ["tv-r2-c1", "tv-r2-c2"]],
    ]);
    expect(tv.children![0]!.slot).toEqual(["component-table-column"]);
    expect(tv.children![1]!.slot).toEqual([TABLE_ROW_ORIGIN_ID]);
    expect(canvasRows(after, "tv")).toEqual(canvasRows(before, "tv"));
    expect(canvasColumns(after, "tv")).toEqual(canvasColumns(before, "tv"));
    expect(previewRows(after, "tv")).toEqual(previewRows(before, "tv"));
    expect(ensureTableOrigins(after)).toBe(after);
  });

  it("셀 수가 어긋난 TableView 는 이관 · slot 없음 (plain 그대로 — 같은 노드)", () => {
    const table = plainTableView(
      "tvm",
      ["A", "B", "C", "D"],
      [["1", "2", "3"]],
    );
    const before = withBodyChildren(seedDocument(), [table]);
    const after = ensureTableOrigins(before);
    expect(find(after.children, "tvm")).toBe(find(before.children, "tvm"));
    expect(
      planTableRowInsert({ document: after, hostId: "tvm-tb" }),
    ).toBeNull();
    const colPlan = planTableColumnInsert({
      document: after,
      hostId: "tvm-th",
    });
    expect(colPlan?.kind === "plain" && colPlan.cells).toEqual([]);
  });

  it("history 스냅샷: Row origin 이전 Components body 스냅샷에 Row origin 보충 · plain TableView 스냅샷은 이관", () => {
    const doc = seedDocument();
    const body = find(doc.children, "page-components-body")!;
    const old = {
      ...body,
      children: body.children!.filter((c) => c.id !== TABLE_ROW_ORIGIN_ID),
    };
    expect(
      ensureTableOriginsInSnapshot(old).children?.some(
        (c) => c.id === TABLE_ROW_ORIGIN_ID,
      ),
    ).toBe(true);
    const snapshot = ensureTableOriginsInSnapshot(
      plainTableView("s", ["A"], [["a"]]),
    );
    expect((snapshot.children![1]!.children![0] as { ref?: string }).ref).toBe(
      TABLE_ROW_ORIGIN_ID,
    );
  });
});

describe("ADR-241 G3 — 행 · 열 추가 (셀 동기화)", () => {
  const migrated = () =>
    ensureTableOrigins(
      withBodyChildren(seedDocument(), [
        plainTableView(
          "tv",
          ["A", "B"],
          [
            ["a1", "b1"],
            ["a2", "b2"],
          ],
        ),
      ]),
    );

  it('Row Slot "+" (plain): Row instance + 열 수만큼 셀 → 두 leg 3 행 × 2 셀', () => {
    const doc = migrated();
    const plan = planTableRowInsert({ document: doc, hostId: "tv-tb" })!;
    expect(plan.kind).toBe("plain");
    const next = applyRowPlan(doc, plan);
    expect(canvasRows(next, "tv")).toEqual([
      ["a1", "b1"],
      ["a2", "b2"],
      ["", ""],
    ]);
    expect(previewRows(next, "tv")).toEqual(canvasRows(next, "tv"));
  });

  it('열 "+" (plain TableView): 모든 행에 셀 1 (한 계획) · 두 leg', () => {
    const doc = migrated();
    const plan = planTableColumnInsert({ document: doc, hostId: "tv-th" })!;
    expect(plan.kind === "plain" && plan.cells.map((c) => c.rowId)).toEqual([
      "tv-r1",
      "tv-r2",
    ]);
    const next = applyColumnPlan(doc, plan);
    expect(canvasColumns(next, "tv")).toEqual(["A", "B", "Column 3"]);
    expect(canvasRows(next, "tv")).toEqual([
      ["a1", "b1", ""],
      ["a2", "b2", ""],
    ]);
    expect(previewRows(next, "tv")).toEqual(canvasRows(next, "tv"));
  });

  it('TableView instance: 열 "+" → TableHeader · TableBody mode C (origin 행 복제 + 셀) · 바깥 셀 patch 는 복제본으로 옮겨 유지', () => {
    const CELL3 =
      "component-tableview__2/component-tableview__2_1/component-tableview__2_1_3";
    let doc = withBodyChildren(seedDocument(), [
      {
        id: "tvi",
        type: "ref",
        ref: "component-tableview",
        props: {},
        descendants: { [CELL3]: { children: "Edited" } },
      } as unknown as CanonicalNode,
    ]);
    expect(canvasRows(doc, "tvi")).toEqual([["Item 1", "File", "Edited"]]);
    const hostId = resolveTableHeaderHostId(doc, "tvi")!;
    doc = applyColumnPlan(
      doc,
      planTableColumnInsert({ document: doc, hostId })!,
    );
    expect(canvasColumns(doc, "tvi")).toEqual([
      "Name",
      "Type",
      "Status",
      "Column 4",
    ]);
    expect(canvasRows(doc, "tvi")).toEqual([["Item 1", "File", "Edited", ""]]);
    expect(previewRows(doc, "tvi")).toEqual(canvasRows(doc, "tvi"));
    const inst = find(doc.children, "tvi") as {
      descendants?: Record<string, unknown>;
    };
    expect(inst.descendants?.[CELL3]).toBeUndefined();
    // origin 불변
    expect(
      find(doc.children, "component-tableview__2_1")?.children,
    ).toHaveLength(3);
  });

  it("TableView instance: Row Slot Fill → TableBody mode C (origin 행 복제 + 새 행 · 셀 = 인스턴스 열 수)", () => {
    let doc = withBodyChildren(seedDocument(), [
      {
        id: "tvi",
        type: "ref",
        ref: "component-tableview",
        props: {},
      } as unknown as CanonicalNode,
    ]);
    const plan = planTableRowInsert({
      document: doc,
      hostId: "tvi/component-tableview__2",
    })!;
    expect(plan.kind).toBe("instance");
    doc = applyRowPlan(doc, plan);
    expect(canvasRows(doc, "tvi")).toEqual([
      ["Item 1", "File", "Active"],
      ["", "", ""],
    ]);
    expect(previewRows(doc, "tvi")).toEqual(canvasRows(doc, "tvi"));
  });
});

describe("ADR-241 G3 — 열 순서 변경 → 셀 순서 (moveCanonicalChild · undo 대칭)", () => {
  it("같은 TableHeader 안 열 이동 = 모든 행 셀 같은 이동 · 되돌리는 이동이 원복", () => {
    const doc = ensureTableOrigins(
      withBodyChildren(seedDocument(), [
        plainTableView(
          "tv",
          ["A", "B", "C"],
          [
            ["a1", "b1", "c1"],
            ["a2", "b2", "c2"],
          ],
        ),
      ]),
    );
    const moved = moveCanonicalChild(doc, "tv-col-3", "tv-th", 0);
    expect(canvasColumns(moved.document, "tv")).toEqual(["C", "A", "B"]);
    expect(canvasRows(moved.document, "tv")).toEqual([
      ["c1", "a1", "b1"],
      ["c2", "a2", "b2"],
    ]);
    const back = moveCanonicalChild(moved.document, "tv-col-3", "tv-th", 2);
    expect(canvasRows(back.document, "tv")).toEqual(canvasRows(doc, "tv"));
  });

  it("셀 수가 어긋난 TableView · Table (정적 행 없음) 은 셀 순서 그대로", () => {
    const doc = withBodyChildren(seedDocument(), [
      plainTableView("tvm", ["A", "B", "C"], [["a1", "b1"]]),
    ]);
    const moved = moveCanonicalChild(doc, "tvm-col-3", "tvm-th", 0);
    expect(canvasRows(moved.document, "tvm")).toEqual([["a1", "b1"]]);
  });
});

describe("ADR-241 G3 — 열 삭제 → 모든 행 같은 index 셀 (store removeElements · undo 1회)", () => {
  const PROJECT = "adr241-p3";
  beforeEach(() => {
    resetCanonicalMutationStoreActions();
    useCanonicalDocumentStore.setState({
      documents: new Map(),
      currentProjectId: null,
      documentVersion: 0,
    });
  });

  it("Column ref 삭제 → 행 (Row ref 자기 자식) 의 같은 index 셀 삭제 · 한 history 항목 undo 로 원복", async () => {
    const addEntry = vi.spyOn(historyManager, "addEntry");
    addEntry.mockClear();
    const doc = ensureTableOrigins(
      withBodyChildren(seedDocument(), [
        plainTableView(
          "tv",
          ["A", "B", "C"],
          [
            ["a1", "b1", "c1"],
            ["a2", "b2", "c2"],
          ],
        ),
      ]),
    );
    registerCanonicalMutationStoreActions({
      getCurrentProjectId: () => PROJECT,
      getCurrentLegacySnapshot: () => ({
        elements: useStore.getState().elements,
        pages: [],
        layouts: [],
      }),
    });
    useCanonicalDocumentStore.getState().setCurrentProject(PROJECT);
    useCanonicalDocumentStore.getState().setDocument(PROJECT, doc);
    useStore.setState({ currentPageId: "page-1" } as never);
    useStore.getState()._rebuildIndexes();
    await useStore.getState().removeElements(["tv-col-2"]);
    const current = useCanonicalDocumentStore.getState().getDocument(PROJECT)!;
    expect(canvasColumns(current, "tv")).toEqual(["A", "C"]);
    expect(canvasRows(current, "tv")).toEqual([
      ["a1", "c1"],
      ["a2", "c2"],
    ]);
    // 한 history 항목 (열 삭제 + 다른 행 셀 — 모두 remove event)
    expect(addEntry).toHaveBeenCalledTimes(1);
    const entry = addEntry.mock.calls.at(-1)?.[0] as unknown as {
      data: { canonicalEvents: never[] };
    };
    const undone = applyCanonicalHistoryEventsToDocument(
      current,
      entry.data.canonicalEvents,
      "undo",
    );
    expect(canvasRows(undone, "tv")).toEqual([
      ["a1", "b1", "c1"],
      ["a2", "b2", "c2"],
    ]);
    addEntry.mockRestore();
  });
});

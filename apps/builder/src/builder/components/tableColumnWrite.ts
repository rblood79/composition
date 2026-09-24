/**
 * ADR-241 — 열 · 행 추가 계획 (`planTableColumnInsert` · `planTableRowInsert`) 을 store 에 쓴다: 한 history 항목.
 *
 * Slot "+" (Properties Slot · Slot Fill) · Preview `ADD_COLUMN_ELEMENTS` 가 같이 쓴다. quick connect 는 data 항목에 canonical
 * event 를 싣는 별도 경로 (`quickConnect.executeQuickConnect`).
 * - plain: 새 Column instance 를 TableHeader 자식으로 (replace 면 기존 열 제거 먼저) + TableView 정적 행마다 셀 (Phase 3) ·
 *   새 Row instance (셀 = 자기 자식) 를 TableBody 자식으로.
 * - instance: 바깥 instance `descendants` 교체 (origin 영향 없음 — instance 자기 열 · 행).
 * origin 편집 (Components 페이지) 영향 확인은 호출자가 트랜잭션 밖에서 먼저 한다 (237 그룹 "+" 와 같은 규칙).
 */
import type { CanonicalNode } from "@composition/shared";

import { COMPONENT_DESCENDANTS_MIRROR_FIELD } from "../../adapters/canonical/componentSemanticsMirror";
import { withFrameElementMirrorId } from "../../adapters/canonical/frameMirror";
import type { Element } from "../../types/core/store.types";
import { historyManager } from "../stores/history";
import type {
  TableColumnInsertPlan,
  TableRowInsertPlan,
} from "./tableColumnInsert";

export interface TableColumnWriteActions {
  addElement: (element: Element) => Promise<unknown> | unknown;
  updateElement: (
    id: string,
    patch: Partial<Element>,
  ) => Promise<unknown> | unknown;
  removeElements: (ids: string[]) => Promise<unknown> | unknown;
}

type WriteContext = { pageId: string | null; mirrorId: string | null };

function toElement(
  node: CanonicalNode,
  parentId: string,
  context: WriteContext,
): Element {
  return withFrameElementMirrorId(
    { ...node, parent_id: parentId, page_id: context.pageId },
    context.mirrorId,
  ) as unknown as Element;
}

/** 자식을 가진 노드 (셀을 가진 Row instance) 는 부모부터 자식 순으로 평탄화해 넣는다 (addElement = 노드 하나). */
function flattenWithParents(
  node: CanonicalNode,
  parentId: string,
): Array<{ node: CanonicalNode; parentId: string }> {
  const { children, ...self } = node;
  return [
    { node: self as CanonicalNode, parentId },
    ...(children ?? []).flatMap((child) => flattenWithParents(child, node.id)),
  ];
}

export async function applyTableColumnInsertPlan(
  plan: TableColumnInsertPlan,
  actions: TableColumnWriteActions,
  context: WriteContext,
): Promise<void> {
  if (plan.kind === "instance") {
    await actions.updateElement(plan.instanceId, {
      [COMPONENT_DESCENDANTS_MIRROR_FIELD]: plan.descendants,
    } as Partial<Element>);
    return;
  }
  const pending = historyManager.runInTransaction(
    { type: "batch", elementId: plan.headerId },
    (): unknown[] => [
      ...(plan.removeIds.length > 0
        ? [actions.removeElements(plan.removeIds)]
        : []),
      ...plan.columns.map((column) =>
        actions.addElement(toElement(column, plan.headerId, context)),
      ),
      ...plan.cells.map(({ rowId, cell }) =>
        actions.addElement(toElement(cell, rowId, context)),
      ),
    ],
  );
  await Promise.all(pending);
}

export async function applyTableRowInsertPlan(
  plan: TableRowInsertPlan,
  actions: TableColumnWriteActions,
  context: WriteContext,
): Promise<void> {
  if (plan.kind === "instance") {
    await actions.updateElement(plan.instanceId, {
      [COMPONENT_DESCENDANTS_MIRROR_FIELD]: plan.descendants,
    } as Partial<Element>);
    return;
  }
  const pending = historyManager.runInTransaction(
    { type: "batch", elementId: plan.bodyId },
    (): unknown[] =>
      flattenWithParents(plan.row, plan.bodyId).map(({ node, parentId }) =>
        actions.addElement(toElement(node, parentId, context)),
      ),
  );
  await Promise.all(pending);
}

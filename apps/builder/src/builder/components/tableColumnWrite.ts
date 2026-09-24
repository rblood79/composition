/**
 * ADR-241 Phase 2 — 열 추가 계획 (`planTableColumnInsert`) 을 store 에 쓴다: 한 history 항목.
 *
 * Slot "+" (Properties Slot · Slot Fill) · Preview `ADD_COLUMN_ELEMENTS` 가 같이 쓴다. quick connect 는 data 항목에 canonical
 * event 를 싣는 별도 경로 (`quickConnect.executeQuickConnect`).
 * - plain: 새 Column instance 를 TableHeader 자식으로 (replace 면 기존 열 제거 먼저).
 * - instance: 바깥 instance `descendants` 교체 (origin 영향 없음 — instance 자기 열).
 * origin 편집 (Components 페이지 TableHeader) 영향 확인은 호출자가 트랜잭션 밖에서 먼저 한다 (237 그룹 "+" 와 같은 규칙).
 */
import { COMPONENT_DESCENDANTS_MIRROR_FIELD } from "../../adapters/canonical/componentSemanticsMirror";
import { withFrameElementMirrorId } from "../../adapters/canonical/frameMirror";
import type { Element } from "../../types/core/store.types";
import { historyManager } from "../stores/history";
import type { TableColumnInsertPlan } from "./tableColumnInsert";

type AddElementInput = Parameters<typeof withFrameElementMirrorId>[0];

export interface TableColumnWriteActions {
  addElement: (element: Element) => Promise<unknown> | unknown;
  updateElement: (
    id: string,
    patch: Partial<Element>,
  ) => Promise<unknown> | unknown;
  removeElements: (ids: string[]) => Promise<unknown> | unknown;
}

export async function applyTableColumnInsertPlan(
  plan: TableColumnInsertPlan,
  actions: TableColumnWriteActions,
  context: { pageId: string | null; mirrorId: string | null },
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
        actions.addElement(
          withFrameElementMirrorId(
            {
              ...column,
              parent_id: plan.headerId,
              page_id: context.pageId,
            } as unknown as AddElementInput,
            context.mirrorId,
          ) as unknown as Element,
        ),
      ),
    ],
  );
  await Promise.all(pending);
}

/**
 * ADR-190 Phase 2 — structure mutation 의 commit descriptor 변환.
 *
 * style 축과 결정적으로 다른 점: **dirty root 가 대상 노드가 아니라 부모**다.
 * 자식 추가/제거/순서 변경은 부모의 subtree command span 길이를 바꾸므로,
 * 부모를 다시 기록해야 형제 배치가 맞는다 (`commitPatchPlan.ts` 의
 * `PARENT_SCOPED_STRUCTURE_OPERATIONS` 계약).
 *
 * 그래서 부모를 특정하지 못하면 emit 자체가 성립하지 않는다. `remove` 는
 * post-commit 트리에서 대상 노드가 이미 사라져 있어 payload 의 parentId 가
 * 유일한 단서이므로, 세 연산 모두 parentId 를 명시적으로 싣는다.
 *
 * `reparent`/`ref`/`slot` 은 출발지와 도착지 양쪽이 dirty 라 descriptor 하나로
 * 범위를 특정할 수 없다 — 소비자가 fail-closed 하고, 여기서도 만들지 않는다.
 */

import { isRenderProjectionId } from "../projection/renderProjectionIds";
import type { EditorMutationDescriptor } from "./editorPresentationTypes";

/** 부모 dirty 로 환원 가능한 연산만 — 소비자 allowlist 와 1:1. */
export type StoreStructureOperation = "add" | "order" | "remove";

export function createStoreStructureCommitDescriptor(input: {
  readonly elementId: string;
  readonly operation: StoreStructureOperation;
  readonly parentId: string | null | undefined;
}): EditorMutationDescriptor | null {
  const { elementId, operation, parentId } = input;
  if (isRenderProjectionId(elementId)) return null;
  // 부모가 projected 면 dirty root 가 canonical 문서에 없다.
  if (!parentId || isRenderProjectionId(parentId)) return null;

  return {
    operation: { payload: { parentId }, type: operation },
    target: { kind: "canonical-node", nodeId: elementId },
    type: "structure.patch",
  };
}

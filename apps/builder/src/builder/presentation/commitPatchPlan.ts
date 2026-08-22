/**
 * ADR-189 Phase 1 (G1) — canonical commit 의 dirty-root 도출.
 *
 * commit lane 은 ADR-188 presentation lane 과 **같은 promotion 판정**을 쓴다
 * (`createPresentationLayoutPlan` + registry `usedSizeEffect` × container 규칙표).
 * 여기서 새 diff 계층을 만들면 두 lane 의 dirty 범위가 갈려 시각 발산이 생긴다
 * (ADR-189 R4). 본 모듈이 더하는 것은 셋뿐이다:
 *
 * 1. **structure 축** — 자식 추가/제거/순서는 부모의 subtree span 길이를 바꾸므로
 *    dirty root 가 **부모**다. presentation lane 은 이 축을 fail-closed 했지만
 *    (ADR-188 Phase 4) commit lane 은 이것이 주 편집 유형이라 다뤄야 한다.
 * 2. **rootKey 분할** — page/frame 경계를 넘는 부분 적용을 막는다.
 * 3. **fail-closed 방향이 반대** — presentation lane 은 commit-only(안 그림)로
 *    수렴하지만 commit lane 은 **full rebuild**(전부 다시 그림)로 수렴한다.
 *    어느 쪽도 stale 화면을 만들지 않는다 (ADR-189 HC5).
 *
 * **트리 계약**: `tree` 는 **post-commit** 트리다. `remove` 의 대상 노드는 이미
 * 사라졌으므로 dirty root 는 `operation.payload.parentId` 또는 commit 이전 부모
 * 참조로만 얻을 수 있다.
 */

import {
  createPresentationLayoutPlan,
  getDescriptorUsedSizeEffect,
  type PresentationLayoutTreeIndex,
} from "./editorPresentationLayoutLane";
import type {
  EditorMutationDescriptor,
  EditorPresentationTargetRef,
  EditorStructureOperationType,
} from "./editorPresentationTypes";

/** span 길이·형제 배치가 부모에서 결정되는, 부모 dirty 로 환원 가능한 연산. */
const PARENT_SCOPED_STRUCTURE_OPERATIONS: ReadonlySet<EditorStructureOperationType> =
  new Set(["add", "remove", "order"]);

export type CommitPatchFallbackReason =
  | "missing-tree-node"
  | "no-dirty-root"
  | "unknown-root-key"
  | "unsupported-structure-operation";

export interface CommitPatchPlan {
  /** dirty root 서브트리의 전체 노드 — Phase 2 splice 와 Phase 3 damage 의 입력. */
  readonly affectedIds: ReadonlySet<string>;
  /** 조상 관계로 겹치지 않는 최소 dirty root 집합. */
  readonly dirtyRootIds: readonly string[];
  readonly revision: number;
  readonly rootKey: string;
}

export type CommitPatchPlanResult =
  | { readonly ok: true; readonly plans: readonly CommitPatchPlan[] }
  | { readonly ok: false; readonly reason: CommitPatchFallbackReason };

function toTargetId(target: EditorPresentationTargetRef): string {
  return target.kind === "canonical-node" ? target.nodeId : target.refId;
}

/**
 * structure 연산의 dirty root(=부모)를 구한다.
 *
 * post-commit 트리에서 사라진 노드(`remove`)는 payload 의 parentId 가 유일한
 * 단서다. 둘 다 없으면 부모를 특정할 수 없으므로 full rebuild 로 보낸다.
 */
function resolveStructureParentId(
  target: EditorPresentationTargetRef,
  payload: Readonly<Record<string, unknown>> | undefined,
  tree: PresentationLayoutTreeIndex,
): string | null {
  const explicitParentId = payload?.parentId;
  if (typeof explicitParentId === "string" && explicitParentId.length > 0) {
    return explicitParentId;
  }
  return tree.parentById.get(toTargetId(target)) ?? null;
}

/** 조상이 이미 dirty root 면 그 자손은 중복이다 — Phase 2 에서 span 이 겹친다. */
function collapseDescendantRoots(
  roots: readonly string[],
  parentById: ReadonlyMap<string, string | null>,
): readonly string[] {
  const rootSet = new Set(roots);
  return roots.filter((rootId) => {
    let ancestorId = parentById.get(rootId) ?? null;
    const visited = new Set([rootId]);
    while (ancestorId) {
      if (rootSet.has(ancestorId)) return false;
      if (visited.has(ancestorId)) break;
      visited.add(ancestorId);
      ancestorId = parentById.get(ancestorId) ?? null;
    }
    return true;
  });
}

function collectSubtree(
  rootId: string,
  childrenByParent: ReadonlyMap<string, readonly string[]>,
  target: Set<string>,
): void {
  const pending = [rootId];
  while (pending.length > 0) {
    const nodeId = pending.pop()!;
    if (target.has(nodeId)) continue;
    target.add(nodeId);
    for (const childId of childrenByParent.get(nodeId) ?? []) {
      pending.push(childId);
    }
  }
}

/**
 * commit 1회의 dirty-root plan 을 rootKey 별로 만든다.
 *
 * 어느 target 하나라도 도출에 실패하면 **commit 전체**를 fail-closed 한다 —
 * 일부만 patch 하고 나머지를 full rebuild 하면 두 경로가 한 프레임에 섞여
 * revision 원자성(ADR-189 HC4)이 깨진다.
 */
export function createCommitPatchPlan(input: {
  readonly mutations: readonly EditorMutationDescriptor[];
  readonly revision: number;
  readonly tree: PresentationLayoutTreeIndex;
}): CommitPatchPlanResult {
  if (input.mutations.length === 0) {
    return { ok: false, reason: "no-dirty-root" };
  }

  const structureRoots: string[] = [];
  const layoutMutations: EditorMutationDescriptor[] = [];

  for (const mutation of input.mutations) {
    if (mutation.type === "structure.patch") {
      if (!PARENT_SCOPED_STRUCTURE_OPERATIONS.has(mutation.operation.type)) {
        // reparent/ref/slot 은 출발지와 도착지 양쪽이 dirty 라 descriptor 하나로
        // 범위를 특정할 수 없다.
        return { ok: false, reason: "unsupported-structure-operation" };
      }
      const parentId = resolveStructureParentId(
        mutation.target,
        mutation.operation.payload,
        input.tree,
      );
      if (!parentId) return { ok: false, reason: "missing-tree-node" };
      structureRoots.push(parentId);
      continue;
    }
    layoutMutations.push(mutation);
  }

  // used-size 승격이 필요한 mutation 은 promotion 입력(nodeById)이 있어야 한다.
  // 없으면 lane 이 "승격 안 함"으로 조용히 축소하므로(fail-closed to no-promotion)
  // commit lane 에서는 그 전에 full rebuild 로 보낸다.
  for (const mutation of layoutMutations) {
    if (getDescriptorUsedSizeEffect(mutation) === "none") continue;
    if (!input.tree.nodeById?.get(toTargetId(mutation.target))) {
      return { ok: false, reason: "missing-tree-node" };
    }
  }

  const layoutRoots =
    layoutMutations.length > 0
      ? createPresentationLayoutPlan({
          targets: layoutMutations.map((mutation) => mutation.target),
          mutations: layoutMutations,
          tree: input.tree,
        }).roots
      : [];

  const dirtyRootIds = collapseDescendantRoots(
    [...new Set([...layoutRoots, ...structureRoots])],
    input.tree.parentById,
  );
  if (dirtyRootIds.length === 0) {
    return { ok: false, reason: "no-dirty-root" };
  }

  const rootsByRootKey = new Map<string, string[]>();
  for (const rootId of dirtyRootIds) {
    const rootKey = input.tree.rootKeyByNodeId?.get(rootId);
    if (typeof rootKey !== "string" || rootKey.length === 0) {
      return { ok: false, reason: "unknown-root-key" };
    }
    const bucket = rootsByRootKey.get(rootKey);
    if (bucket) bucket.push(rootId);
    else rootsByRootKey.set(rootKey, [rootId]);
  }

  const plans: CommitPatchPlan[] = [];
  for (const [rootKey, roots] of rootsByRootKey) {
    const affectedIds = new Set<string>();
    for (const rootId of roots) {
      collectSubtree(rootId, input.tree.childrenByParent, affectedIds);
    }
    plans.push(
      Object.freeze({
        affectedIds,
        dirtyRootIds: Object.freeze([...roots]),
        revision: input.revision,
        rootKey,
      }),
    );
  }

  return { ok: true, plans: Object.freeze(plans) };
}

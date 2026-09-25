/**
 * 생성 · 이동 · 붙여넣기 대상 결정 (ADR-236 Phase 3) — "이 타입들을 이 부모 아래에 둘 수 있는가,
 * 못 두면 어디에 두는가" 를 한 곳에서 답한다.
 *
 * 전에는 팔레트 · 붙여넣기 · AI 생성 · Layers 드롭 · 캔버스 드래그가 각자 정했다 (Phase 0 인벤토리
 * §3.4 E6 · E7): AI 생성은 ref instance 부모를 원본 타입으로 해석하지 않아 팔레트와 다른 판정을
 * 냈고, Layers 드롭에는 중첩 preflight 가 없었으며, instance 의 synthetic 자식을 부모로 고르는 것은
 * store 맵에 없어서 우연히 걸러질 뿐이었다.
 *
 * policy — 표면별 현행 동작을 옮긴다 (새 동작이 아니다):
 * - `nearest-ancestor`: 가까운 유효 조상으로 옮긴다 (팔레트 · 붙여넣기 · 캔버스 드래그).
 * - `reject`: 옮기지 않고 거부한다 (AI 생성 — 에이전트가 다른 부모를 고른다 · Layers 드롭 — 사용자가
 *   고른 자리를 떠나지 않는다 · group — 선택이 제자리를 떠나면 안 된다).
 */

import type {
  CompositionDocument,
  NestingViolation,
} from "@composition/shared";
import {
  createCanonicalNestingIndex,
  findCanonicalNodeType,
} from "@composition/shared";
import { notifyOperationRejected } from "./canOperate";
import { notifyNestingRejected } from "../workspace/canvas/interaction/nestingNotice";
import { isSyntheticDescendantId } from "../stores/canonical/syntheticDescendantLookup";
import { resolveSlotRegionTarget } from "../components/slotRegionInsert";
import type { CanvasInteractionNode } from "../workspace/canvas/interaction/interactionNode";
import {
  resolveNestingAwareTarget,
  type NestingRelocation,
} from "../workspace/canvas/interaction/nestingRelocation";

export type MoveTargetPolicy = "reject" | "nearest-ancestor";

/** 대상 판정이 읽는 노드 — 캔버스 상호작용 노드 · store 요소 둘 다 이 모양을 가진다. */
export type MoveTargetNode = CanvasInteractionNode;

export interface MoveTargetInput {
  targetParentId: string;
  insertionIndex: number;
  movingTypes: readonly string[];
  nodes: ReadonlyMap<string, MoveTargetNode>;
  policy: MoveTargetPolicy;
  /**
   * ref instance 의 원본 타입을 찾을 문서. 원본은 Components 페이지에 있어 page 단위 맵에 없다.
   * 생략하면 맵 안의 원본만 해석한다.
   */
  doc?: CompositionDocument | null;
}

export type MoveTargetRejectReason =
  "notFound" | "synthetic" | "projection" | "nesting";

export type MoveTargetResult =
  | {
      ok: true;
      parentId: string;
      insertionIndex: number;
      /** 가까운 조상으로 옮겼으면 그 기록 (알림용). */
      relocation: NestingRelocation | null;
    }
  | {
      ok: false;
      reason: MoveTargetRejectReason;
      violation?: NestingViolation;
    };

/**
 * ref instance 를 원본 타입으로 읽는 해석기 — 팔레트 배치가 전부 instance 라 `"ref"` 를 그대로 두면
 * 중첩 판정이 opaque 로 통과해 Button 안 Button 같은 규칙이 무력해진다 (canonical guard 의
 * `canonicalNestingContext.effectiveType` 과 같은 규칙).
 */
export function createEffectiveTypeResolver(
  nodes: ReadonlyMap<string, MoveTargetNode>,
  doc?: CompositionDocument | null,
): (node: MoveTargetNode) => string {
  let nestingIndex: ReturnType<typeof createCanonicalNestingIndex> | null =
    null;
  return (node) => {
    const ref = node.ref;
    if (node.type !== "ref" || typeof ref !== "string") return node.type;
    const origin = nodes.get(ref);
    if (origin && origin.type !== "ref") return origin.type;
    if (!doc) return node.type;
    nestingIndex ??= createCanonicalNestingIndex(doc);
    return findCanonicalNodeType(nestingIndex, ref) ?? node.type;
  };
}

export function resolveMoveTarget(input: MoveTargetInput): MoveTargetResult {
  const { targetParentId } = input;
  // instance 의 synthetic 자식은 store 노드가 아니다 — 부모로 고르면 자식이 origin 에 섞이거나
  // 아무 데도 붙지 않는다 (E6, 명시 가드). 예외는 ADR-240 이름 영역 (`<instance>/Content` 등) —
  // 캔버스 드래그의 정식 drop 대상이고 `resolveCanonicalMoveTarget` 이 instance 의 mode C 로 옮긴다.
  // render projection id (page-frame 투영 등) 도 거부하지 않는다 — 같은 함수가 canonical 로 옮긴다.
  if (
    isSyntheticDescendantId(targetParentId) &&
    !(input.doc && resolveSlotRegionTarget(input.doc, targetParentId))
  ) {
    return { ok: false, reason: "synthetic" };
  }
  // 맵에 없는 대상은 판정하지 않고 넘긴다 — 조상 사슬이 비면 중첩 규칙을 읽을 수 없고, 종전
  //   표면들 (팔레트 · 붙여넣기 · AI · group) 도 모두 그대로 통과시켰다 (stale 선택 창 등, ADR-137).
  //   canonical guard 가 백스톱이다.
  if (!input.nodes.has(targetParentId)) {
    return {
      ok: true,
      parentId: targetParentId,
      insertionIndex: input.insertionIndex,
      relocation: null,
    };
  }

  const nesting = resolveNestingAwareTarget({
    renderTargetId: targetParentId,
    insertionIndex: input.insertionIndex,
    movingTypes: input.movingTypes,
    elementsMap: input.nodes,
    typeOf: createEffectiveTypeResolver(input.nodes, input.doc),
  });
  const relocation = nesting.relocation;
  if (relocation) {
    if (relocation.relocatedToId === null || input.policy === "reject") {
      return {
        ok: false,
        reason: "nesting",
        violation: relocation.violation,
      };
    }
  }
  return {
    ok: true,
    parentId: nesting.renderTargetId,
    insertionIndex: nesting.insertionIndex,
    relocation,
  };
}

/** 거부 이유를 사용자에게 알린다 — 중첩 위반은 중첩 알림, instance 안 요소는 편집 위치 안내. */
export function notifyMoveTargetRejected(
  result: Extract<MoveTargetResult, { ok: false }>,
): void {
  if (result.reason === "nesting" && result.violation) {
    notifyNestingRejected(result.violation);
  } else if (result.reason === "synthetic") {
    notifyOperationRejected([{ reason: "synthetic" }]);
  }
}

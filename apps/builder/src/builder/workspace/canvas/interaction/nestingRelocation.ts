/**
 * drop · paste 의 중첩 preflight — 거부 대신 **가까운 유효 부모로 옮기고** 사용자에게
 * 알린다 (webstudio `findClosestDroppableInstanceSelector` 와 같은 UX). canonical 변이
 * 경계의 guard (`canonicalMutations.ts`) 는 fail-closed 백스톱이고, 사용자가 보는 건
 * 이 층이다.
 *
 * 조상 사슬은 캔버스 상호작용 노드 맵 (`parent_id` / `parentId`) 을 위로 걸어 만든다.
 * 페이지 frame projection 경계를 넘어가면 `ref` 를 만나 opaque 로 통과된다 — 그 안의
 * 실제 판정은 canonical guard 가 `descendants` 슬롯을 원본 타입으로 다시 본다.
 */
import {
  findClosestNestableAncestorIndex,
  resolveNestingViolation,
  type NestingViolation,
} from "@composition/shared";

import type { CanvasInteractionNode } from "./interactionNode";

export interface NestingRelocation {
  /** 원래 대상에서 걸린 위반 (첫 번째 이동 타입 기준). */
  violation: NestingViolation;
  /** 옮겨 간 컨테이너 id. `null` = 조상 어디에도 둘 수 없어 이동 자체를 취소. */
  relocatedToId: string | null;
  originalTargetId: string;
}

export interface NestingAwareTarget {
  renderTargetId: string;
  insertionIndex: number;
  relocation: NestingRelocation | null;
}

function parentIdOf(node: CanvasInteractionNode | undefined): string | null {
  if (!node) return null;
  return node.parent_id ?? node.parentId ?? null;
}

/** `startId` 부터 루트까지 `{id, type}` 사슬 (startId 포함, 가까운 순). */
export function collectInteractionAncestorChain(
  startId: string,
  elementsMap: ReadonlyMap<string, CanvasInteractionNode>,
): Array<{ id: string; type: string }> {
  const chain: Array<{ id: string; type: string }> = [];
  const seen = new Set<string>();
  let cursor: string | null = startId;
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const node = elementsMap.get(cursor);
    if (!node) break;
    chain.push({ id: node.id, type: node.type });
    cursor = parentIdOf(node);
  }
  return chain;
}

/**
 * 이동·삽입 대상 컨테이너를 중첩 규칙에 맞춰 조정한다.
 *
 * - 직계가 유효 → 그대로.
 * - 위반이지만 조상 중 유효한 곳이 있음 → 그 조상으로 옮기고 끝에 붙인다
 *   (`insertionIndex` 는 커널이 clamp 하므로 큰 값 = append).
 * - 어디에도 못 둠 → `relocatedToId: null`, `renderTargetId` 는 원래 값 (호출자가 취소).
 *
 * 여러 타입을 한 번에 옮기면 (다중 드래그) 전부를 만족하는 가장 가까운 조상을 고른다.
 */
export function resolveNestingAwareTarget(input: {
  renderTargetId: string;
  insertionIndex: number;
  movingTypes: readonly string[];
  elementsMap: ReadonlyMap<string, CanvasInteractionNode>;
}): NestingAwareTarget {
  const chain = collectInteractionAncestorChain(
    input.renderTargetId,
    input.elementsMap,
  );
  const chainTypes = chain.map((n) => n.type);
  const base: NestingAwareTarget = {
    renderTargetId: input.renderTargetId,
    insertionIndex: input.insertionIndex,
    relocation: null,
  };
  if (chain.length === 0 || input.movingTypes.length === 0) return base;

  let bestIndex = 0;
  let firstViolation: NestingViolation | null = null;
  for (const childType of input.movingTypes) {
    const violation = resolveNestingViolation({
      parentType: chainTypes[0] ?? null,
      childType,
      ancestorTypes: chainTypes,
    });
    if (!violation) continue;
    firstViolation ??= violation;
    const idx = findClosestNestableAncestorIndex(childType, chainTypes);
    if (idx === -1) {
      return {
        ...base,
        relocation: {
          violation,
          relocatedToId: null,
          originalTargetId: input.renderTargetId,
        },
      };
    }
    bestIndex = Math.max(bestIndex, idx);
  }

  if (!firstViolation || bestIndex === 0) return base;

  return {
    renderTargetId: chain[bestIndex].id,
    insertionIndex: Number.MAX_SAFE_INTEGER,
    relocation: {
      violation: firstViolation,
      relocatedToId: chain[bestIndex].id,
      originalTargetId: input.renderTargetId,
    },
  };
}

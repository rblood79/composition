/**
 * ADR-240 Phase 2 — instance 안 이름 영역에 새 노드를 넣는 계획 (팔레트 클릭 · Canvas drop 공용, F18 · F20).
 *
 * 대상 = synthetic id (`<instance>/<경로>`) 의 경로에서 가장 가까운 **자유 내용 slot host** (`isFreeContentSlotHost` —
 * 이름 영역 · frame 가족 slot, 목록 틀 제외). 영역 자신이나 그 안 (상속 Description · 채운 노드) 을 가리키면 그 영역이다.
 * 영역 밖 (inherited 노드 · Dialog 제목 · Close 같은 고정 부품) 이면 null — 234 구조 보존.
 *
 * 쓰기 = Slot 채우기 절과 같은 mode C (`descendants[영역 segment 경로].children` 끝에 추가 · 옛 id 키는 이관).
 */
import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import {
  getSyntheticDescendantPathKey,
  getSyntheticDescendantRootId,
} from "../stores/canonical/syntheticDescendantLookup";
import {
  collectSlotFillHosts,
  readSlotFill,
  writeSlotFill,
} from "./slotFillPath";
import { buildSlotFillNodeForType } from "./slotFillNodes";
import { isFreeContentSlotHost } from "./slotHostPolicy";
import { indexNodes, resolveChainEnd } from "./staticCollectionMigration";

type RefLike = CanonicalNode & {
  ref?: string;
  descendants?: Record<string, unknown>;
};

export interface SlotRegionTarget {
  instanceId: string;
  /** 영역 host 의 segment 경로 (descendants 키) */
  regionPath: string;
  legacyPath: string | null;
  host: CanonicalNode;
}

function childrenMapOf(root: CanonicalNode): Map<string, CanonicalNode[]> {
  const map = new Map<string, CanonicalNode[]>();
  const visit = (node: CanonicalNode) => {
    if (node.children && node.children.length > 0) {
      map.set(node.id, node.children);
      node.children.forEach(visit);
    }
  };
  visit(root);
  return map;
}

/** synthetic id → 가장 가까운 이름 영역 (없으면 null). */
export function resolveSlotRegionTarget(
  document: CompositionDocument,
  syntheticId: string,
  byId: ReadonlyMap<string, CanonicalNode> = indexNodes(document),
): SlotRegionTarget | null {
  const instanceId = getSyntheticDescendantRootId(syntheticId);
  const path = getSyntheticDescendantPathKey(syntheticId);
  if (!instanceId || !path) return null;
  const instance = byId.get(instanceId) as RefLike | undefined;
  if (instance?.type !== "ref") return null;
  const master = resolveChainEnd(instance.ref, byId);
  if (!master) return null;
  const hosts = collectSlotFillHosts<CanonicalNode>(
    master.id,
    childrenMapOf(master),
  ).filter((hit) => isFreeContentSlotHost(hit.host as never));
  let best: (typeof hosts)[number] | null = null;
  for (const hit of hosts) {
    if (path !== hit.path && !path.startsWith(`${hit.path}/`)) continue;
    if (!best || hit.path.length > best.path.length) best = hit;
  }
  return best
    ? {
        instanceId,
        regionPath: best.path,
        legacyPath: best.legacyPath,
        host: best.host,
      }
    : null;
}

export interface SlotRegionInsertPlan {
  instanceId: string;
  /** instance 의 다음 descendants 전체 (영역 mode C 에 노드 추가) */
  nextDescendantMap: Record<string, unknown>;
  node: CanonicalNode;
  /** 새 노드의 synthetic id (선택용) */
  syntheticId: string;
}

/** 팔레트 type 하나를 영역 끝에 넣는 계획. 대상 영역이 없거나 넣을 수 없는 type 이면 null. */
export function planSlotRegionInsert(input: {
  document: CompositionDocument;
  targetId: string;
  type: string;
  initialProps?: Record<string, unknown>;
}): SlotRegionInsertPlan | null {
  const byId = indexNodes(input.document);
  const target = resolveSlotRegionTarget(input.document, input.targetId, byId);
  if (!target) return null;
  const instance = byId.get(target.instanceId) as RefLike;
  const current = readSlotFill(instance.descendants, {
    path: target.regionPath,
    legacyPath: target.legacyPath,
  });
  const node = buildSlotFillNodeForType(
    input.type,
    current,
    input.initialProps,
  );
  if (!node) return null;
  return {
    instanceId: target.instanceId,
    nextDescendantMap: writeSlotFill(
      instance.descendants,
      { path: target.regionPath, legacyPath: target.legacyPath },
      [...current, node],
    ),
    node,
    syntheticId: `${target.instanceId}/${target.regionPath}/${node.id}`,
  };
}

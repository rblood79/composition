/**
 * ADR-234 Phase 3 — Slot "+" = 목록 틀 (TabList · TagList) 에 항목 instance 삽입 (breakdown §4 Phase 3).
 *
 * Tabs 는 Tab `id` 로 TabPanel 을 짝지으므로 (RAC `id` 짝 규칙) Tab instance 와 TabPanel 을 함께 만든다.
 * - plain 목록 틀 (origin · 문서 Tabs): TabList 에 Tab ref 자식 · TabPanels 에 TabPanel 자식.
 * - instance 의 synthetic 목록 틀 (`<instance>/<path>`): canonical 에 그 노드가 없다 — 바깥 instance 의
 *   `descendants` 에 목록 틀 · TabPanels 경로의 mode C (자식 교체) 로 (Pencil P5 와 같은 모양). 처음이면
 *   origin 의 현재 자식을 복제한 뒤 덧붙인다.
 * 항목은 slot 항목이 아니라 **항목 origin** (체인 끝) 을 가리킨다 — 휴지 변형을 직접 ref 하면 실행 중
 * 선택 상태가 그 patch 를 이기지 못한다 (선택 상태 = origin 자신, 층 patch 없음).
 */
import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import { getCanonicalRefPathSegment } from "../../adapters/canonical/canonicalRefResolution";
import {
  getSyntheticDescendantPathKey,
  getSyntheticDescendantRootId,
  isSyntheticDescendantId,
} from "../stores/canonical/syntheticDescendantLookup";
import {
  STATIC_COLLECTION_FAMILIES,
  buildItemInstances,
  indexNodes,
  resolveChainEnd,
  type StaticCollectionFamily,
} from "./staticCollectionMigration";

type RefLike = CanonicalNode & {
  ref?: string;
  descendants?: Record<string, unknown>;
};

export type TabItemInsertPlan =
  | {
      kind: "plain";
      /** 목록 틀 (TabList · TagList) id */
      tabListId: string;
      /** 새 항목 instance */
      tab: CanonicalNode;
      /** Tabs 만 — 짝 TabPanel 을 넣을 TabPanels */
      tabPanelsId: string | null;
      panel: CanonicalNode | null;
    }
  | {
      kind: "instance";
      instanceId: string;
      descendants: Record<string, unknown>;
    };

function findParent(
  document: CompositionDocument,
  childId: string,
): CanonicalNode | undefined {
  const visit = (
    nodes: readonly CanonicalNode[] | undefined,
  ): CanonicalNode | undefined => {
    for (const node of nodes ?? []) {
      if (node.children?.some((child) => child.id === childId)) return node;
      const hit = visit(node.children);
      if (hit) return hit;
    }
    return undefined;
  };
  return visit(document.children);
}

/** origin subtree 에서 segment 경로 (`a/b`) 로 노드를 찾는다. */
function findBySegmentPath(
  root: CanonicalNode,
  path: string,
): { node: CanonicalNode; parent: CanonicalNode } | null {
  let parent = root;
  const segments = path.split("/");
  for (let index = 0; index < segments.length; index += 1) {
    const node = (parent.children ?? []).find(
      (child) => getCanonicalRefPathSegment(child) === segments[index],
    );
    if (!node) return null;
    if (index === segments.length - 1) return { node, parent };
    parent = node;
  }
  return null;
}

function cloneWithFreshIds(
  nodes: readonly CanonicalNode[],
  prefix: string,
  taken: Set<string>,
): CanonicalNode[] {
  return nodes.map((node) => {
    let id = `${prefix}__${node.id}`;
    for (let n = 2; taken.has(id); n += 1) id = `${prefix}__${node.id}-${n}`;
    taken.add(id);
    return {
      ...node,
      id,
      ...(node.children
        ? { children: cloneWithFreshIds(node.children, prefix, taken) }
        : {}),
    };
  });
}

/**
 * `hostId` (목록 틀 — plain 또는 synthetic) 에 `candidateId` (slot 항목) 의 항목을 넣는 계획. 넣을 수 없으면
 * null (origin 누락 · 구조 불일치).
 */
export function planTabItemInsert(input: {
  document: CompositionDocument;
  hostId: string;
  candidateId: string;
  newKey: string;
}): TabItemInsertPlan | null {
  const { document, hostId, candidateId, newKey } = input;
  const byId = indexNodes(document);
  const taken = new Set(byId.keys());
  const origin = resolveChainEnd(candidateId, byId);
  if (!origin) return null;
  const familyOf = (listType: string): StaticCollectionFamily | undefined =>
    STATIC_COLLECTION_FAMILIES.find(
      (f) => f.listType === listType && origin.type === f.itemType,
    );
  const newRow = (count: number) => ({
    id: newKey,
    title: `${origin.type} ${count + 1}`,
    label: `${origin.type} ${count + 1}`,
  });

  if (!isSyntheticDescendantId(hostId)) {
    const list = byId.get(hostId);
    const family = list ? familyOf(list.type) : undefined;
    if (!list || !family) return null;
    const owner = findParent(document, list.id);
    const tabPanels =
      family.ownerType === "Tabs"
        ? owner?.children?.find((child) => child.type === "TabPanels")
        : undefined;
    const count = (list.children ?? []).length;
    const [tab] = buildItemInstances(
      family,
      [newRow(count)],
      list.id,
      origin,
      taken,
      count,
    );
    return {
      kind: "plain",
      tabListId: list.id,
      tab: tab!,
      tabPanelsId: tabPanels?.id ?? null,
      panel: tabPanels
        ? {
            id: `${tabPanels.id}__panel-${newKey}`,
            type: "TabPanel",
            props: { itemId: newKey },
          }
        : null,
    };
  }

  const instanceId = getSyntheticDescendantRootId(hostId);
  const listPath = getSyntheticDescendantPathKey(hostId);
  const instance = instanceId ? (byId.get(instanceId) as RefLike) : undefined;
  if (!instance || instance.type !== "ref" || !listPath) return null;
  const master = resolveChainEnd(instance.ref, byId);
  if (!master) return null;
  const listHit = findBySegmentPath(master, listPath);
  const family = listHit ? familyOf(listHit.node.type) : undefined;
  if (!listHit || !family) return null;
  const tabPanels =
    family.ownerType === "Tabs"
      ? listHit.parent.children?.find((child) => child.type === "TabPanels")
      : undefined;
  const parentPath = listPath.split("/").slice(0, -1).join("/");
  const tabPanelsPath = tabPanels
    ? [parentPath, getCanonicalRefPathSegment(tabPanels)]
        .filter(Boolean)
        .join("/")
    : null;

  const descendants = { ...(instance.descendants ?? {}) };
  const currentChildren = (path: string, fallback: CanonicalNode) => {
    const patch = descendants[path] as { children?: unknown } | undefined;
    return Array.isArray(patch?.children)
      ? (patch.children as CanonicalNode[])
      : cloneWithFreshIds(fallback.children ?? [], instance.id, taken);
  };
  const itemChildren = currentChildren(listPath, listHit.node);
  const [item] = buildItemInstances(
    family,
    [newRow(itemChildren.length)],
    instance.id,
    origin,
    taken,
    itemChildren.length,
  );
  descendants[listPath] = {
    ...((descendants[listPath] as Record<string, unknown>) ?? {}),
    children: [...itemChildren, item!],
  };
  if (tabPanels && tabPanelsPath) {
    const panelChildren = currentChildren(tabPanelsPath, tabPanels);
    descendants[tabPanelsPath] = {
      ...((descendants[tabPanelsPath] as Record<string, unknown>) ?? {}),
      children: [
        ...panelChildren,
        {
          id: `${instance.id}__panel-${newKey}`,
          type: "TabPanel",
          props: { itemId: newKey },
        },
      ],
    };
  }
  return { kind: "instance", instanceId: instance.id, descendants };
}

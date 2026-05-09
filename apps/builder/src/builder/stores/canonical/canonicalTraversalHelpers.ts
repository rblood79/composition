/**
 * @fileoverview Canonical-native traversal helpers — ADR-127 Phase 1
 *
 * canonical document 의 nested CanonicalNode tree 를 hot path 가 효율적으로
 * 소비할 수 있도록 6 helper 를 제공한다. canonical document 의 mutation 은
 * `useCanonicalDocumentStore.documentVersion` counter 로 추적되므로, helper
 * 내부의 derived map (nodeMap / childrenByParent) 은 version 기반 cache
 * invalidation 으로 amortize 된다.
 *
 * **Why ADR-127**:
 * - ADR-126 Phase 2 진입 직전 framing raise 결과 — hot path 70 file 의
 *   `childrenMap.get(parentId)` / `element.parent_id` 패턴 swap 시
 *   `getChildren(node)` / `getParent(nodeId)` / `getAncestors(nodeId)` 같은
 *   helper API 가 필수.
 * - 기존 `canonicalElementsBridge.ts` 는 single read (`getCanonicalNode`) +
 *   full document hook 만 제공. parent / ancestors / path lookup 미지원.
 *
 * **Cache strategy**:
 * - module-level cache (singleton). `documentVersion` 와 `currentProjectId`
 *   조합 key 가 변경되면 cache flush.
 * - `getNodeMap()` / `getChildrenByParent()` 는 lazy build (호출 시점에 build).
 * - `getChildren(node)` 는 `node.children ?? []` direct access (cache 불필요).
 * - `getParent(nodeId)` / `getAncestors(nodeId)` 는 nodeMap 와 childrenByParent
 *   조합 lookup. parent edge 는 별도 Map<childId, parentId> 로 derive.
 *
 * **Memory note**:
 * - cache 는 weak reference 아님. document mutation 마다 GC 가능 (다음 build
 *   시 old map 폐기). active document 1개 기준 캐시 1 set 만 유지.
 *
 * **CanonicalNode shape**:
 * - `children?: CanonicalNode[]` — nested tree (Element 의 flat parent_id 와 다름)
 * - `id: string` — slash 금지 (descendants path 구분자)
 * - 자세한 schema: `packages/shared/src/types/composition-document.types.ts:206-284`
 */

import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import { useCanonicalDocumentStore } from "./canonicalDocumentStore";

// ─────────────────────────────────────────────
// Module-level cache
// ─────────────────────────────────────────────

interface TraversalCache {
  version: number;
  projectId: string;
  nodeMap: Map<string, CanonicalNode>;
  childrenByParent: Map<string, CanonicalNode[]>;
  parentEdge: Map<string, string>; // childId → parentId
}

let cache: TraversalCache | null = null;

function getActiveDocumentSnapshot(): {
  doc: CompositionDocument;
  version: number;
  projectId: string;
} | null {
  const state = useCanonicalDocumentStore.getState();
  if (!state.currentProjectId) return null;
  const doc = state.documents.get(state.currentProjectId);
  if (!doc) return null;
  return {
    doc,
    version: state.documentVersion,
    projectId: state.currentProjectId,
  };
}

function ensureCache(): TraversalCache | null {
  const snapshot = getActiveDocumentSnapshot();
  if (!snapshot) return null;

  if (
    cache &&
    cache.version === snapshot.version &&
    cache.projectId === snapshot.projectId
  ) {
    return cache;
  }

  const nodeMap = new Map<string, CanonicalNode>();
  const childrenByParent = new Map<string, CanonicalNode[]>();
  const parentEdge = new Map<string, string>();

  function visit(node: CanonicalNode, parentId: string | null): void {
    nodeMap.set(node.id, node);
    if (parentId) {
      parentEdge.set(node.id, parentId);
      const list = childrenByParent.get(parentId);
      if (list) {
        list.push(node);
      } else {
        childrenByParent.set(parentId, [node]);
      }
    }
    if (node.children) {
      for (const child of node.children) {
        visit(child, node.id);
      }
    }
  }

  for (const child of snapshot.doc.children) {
    visit(child, null);
  }

  cache = {
    version: snapshot.version,
    projectId: snapshot.projectId,
    nodeMap,
    childrenByParent,
    parentEdge,
  };
  return cache;
}

// ─────────────────────────────────────────────
// Helper API — 6 export (ADR-127 Phase 1 Gate G1 요구)
// ─────────────────────────────────────────────

/**
 * canonical node 의 직계 자식 list 반환 (정렬 순서 = 배열 순서).
 *
 * direct property access — cache 불필요. ADR-127 Phase 2 hot path 가
 * `childrenMap.get(parentId)` 를 swap 할 때 사용.
 *
 * @example
 *   const children = getChildren(node);
 *   for (const child of children) { ... }
 */
export function getChildren(node: CanonicalNode): CanonicalNode[] {
  return node.children ?? [];
}

/**
 * 활성 canonical document 에서 nodeId 의 parent 노드 반환. root 또는 미존재
 * 시 `null`.
 *
 * cache 기반 O(1) lookup (parentEdge map). active document 변경 시 cache
 * invalidation.
 */
export function getParent(nodeId: string): CanonicalNode | null {
  const c = ensureCache();
  if (!c) return null;
  const parentId = c.parentEdge.get(nodeId);
  if (!parentId) return null;
  return c.nodeMap.get(parentId) ?? null;
}

/**
 * nodeId 의 ancestor chain 반환 (root 가 마지막). nodeId 자체는 미포함.
 * 미존재 시 빈 배열.
 *
 * iteration 기반 — getParent 를 chain 호출.
 */
export function getAncestors(nodeId: string): CanonicalNode[] {
  const c = ensureCache();
  if (!c) return [];
  const ancestors: CanonicalNode[] = [];
  let currentId: string | undefined = c.parentEdge.get(nodeId);
  while (currentId) {
    const node = c.nodeMap.get(currentId);
    if (!node) break;
    ancestors.push(node);
    currentId = c.parentEdge.get(currentId);
  }
  return ancestors;
}

/**
 * pencil-style path syntax 로 canonical node lookup.
 * path 구분자: `/` (예: `"ok-button/label"`).
 *
 * pencil schema 의 `descendants` key 와 동일 규약. 첫 segment 는 root level
 * 노드 id, 후속 segment 는 상위 노드의 children 안의 id.
 *
 * 미존재 시 `null`.
 *
 * @example
 *   const labelNode = findByPath("ok-button/label");
 */
export function findByPath(path: string): CanonicalNode | null {
  const snapshot = getActiveDocumentSnapshot();
  if (!snapshot) return null;
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  let current: CanonicalNode | undefined = snapshot.doc.children.find(
    (child) => child.id === segments[0],
  );
  if (!current) return null;

  for (let i = 1; i < segments.length; i++) {
    if (!current.children) return null;
    current = current.children.find((child) => child.id === segments[i]);
    if (!current) return null;
  }
  return current ?? null;
}

/**
 * 활성 canonical document 의 모든 노드를 평탄 lookup map 으로 반환.
 *
 * cache 화. document mutation 시 invalidation. read-only 사용 권장
 * (caller 가 map mutation 하지 말 것).
 */
export function getNodeMap(): Map<string, CanonicalNode> {
  const c = ensureCache();
  return c?.nodeMap ?? new Map();
}

/**
 * 활성 canonical document 의 parent_id → children list map 반환.
 *
 * cache 화. document mutation 시 invalidation. children 배열 순서 = 노드의
 * `children` 배열 순서 (canonical SSOT).
 *
 * read-only 사용 권장.
 */
export function getChildrenByParent(): Map<string, CanonicalNode[]> {
  const c = ensureCache();
  return c?.childrenByParent ?? new Map();
}

// ─────────────────────────────────────────────
// Test-only API (cache invalidation)
// ─────────────────────────────────────────────

/**
 * 단위 테스트 전용 — cache flush.
 *
 * production 에서는 호출 금지 (cache 는 documentVersion 으로 자동 invalidate).
 */
export function __resetTraversalCache_TEST_ONLY__(): void {
  cache = null;
}

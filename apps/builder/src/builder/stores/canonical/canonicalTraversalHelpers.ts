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

import type {
  CanonicalNode,
  CompositionDocument,
  DescendantOverride,
  RefNode,
} from "@composition/shared";

import { normalizeFrameLayoutId } from "@/adapters/canonical/frameMirror";
import { useCanonicalDocumentStore } from "./canonicalDocumentStore";

// ─────────────────────────────────────────────
// Module-level cache
// ─────────────────────────────────────────────

interface TraversalCache {
  version: number;
  projectId: string;
  document: CompositionDocument;
  nodeMap: Map<string, CanonicalNode>;
  firstProjectableNodeById: Map<string, CanonicalProjectableNodeLookup>;
  projectableNodeLookups: CanonicalProjectableNodeLookup[];
  nodeOccurrenceCountById: Map<string, number>;
  childrenByParent: Map<string, CanonicalNode[]>;
  projectableNodes: CanonicalNode[];
  projectableChildrenByParent: Map<string, CanonicalNode[]>;
  parentEdge: Map<string, string>; // childId → parentId
}

export type CanonicalProjectionScope = {
  pageId: string | null;
  layoutId: string | null;
};

export type CanonicalProjectableNodeLookup = CanonicalProjectionScope & {
  node: CanonicalNode;
  parentId: string | null;
};

let cache: TraversalCache | null = null;
const projectableNodeCountCache = new WeakMap<CompositionDocument, number>();
const EMPTY_PROJECTABLE_NODES: readonly CanonicalNode[] = [];
const EMPTY_PROJECTABLE_NODE_LOOKUPS: readonly CanonicalProjectableNodeLookup[] =
  [];
const EMPTY_PROJECTABLE_CHILDREN_BY_PARENT: ReadonlyMap<
  string,
  readonly CanonicalNode[]
> = new Map();

const ROOT_PROJECTION_SCOPE: CanonicalProjectionScope = {
  pageId: null,
  layoutId: null,
};

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

function isCanonicalNode(value: unknown): value is CanonicalNode {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { id?: unknown; type?: unknown };
  return typeof candidate.id === "string" && typeof candidate.type === "string";
}

/**
 * legacy Element view에 실제로 나타나는 canonical node인지 판정한다.
 * canonicalNodeToElement과 items mutation lookup이 같은 경계를 공유해야
 * structural placeholder가 renderable duplicate id보다 먼저 선택되지 않는다.
 */
export function isCanonicalNodeProjectableToElement(
  node: CanonicalNode,
): boolean {
  if (node.props) return true;

  const metadata = node.metadata as { type?: unknown } | undefined;
  if (metadata?.type === "legacy-slot-hoisted") return true;

  const ref = (node as CanonicalNode & { ref?: unknown }).ref;
  const isPagePlaceholder =
    metadata?.type === "page" || metadata?.type === "legacy-page";
  return typeof ref === "string" && ref.length > 0 && !isPagePlaceholder;
}

function readDescendantChildren(override: unknown): CanonicalNode[] {
  if (!override || typeof override !== "object") return [];
  if (isCanonicalNode(override)) return [override];

  const children = (override as { children?: unknown }).children;
  if (!Array.isArray(children)) return [];
  return children.filter(isCanonicalNode);
}

export function getCanonicalProjectionScope(
  node: CanonicalNode,
  scope: CanonicalProjectionScope,
): CanonicalProjectionScope {
  const metadata = node.metadata as
    { type?: unknown; pageId?: unknown; layoutId?: unknown } | undefined;

  if (metadata?.type === "legacy-slot-hoisted") return scope;

  if (metadata?.type === "page" || metadata?.type === "legacy-page") {
    return {
      pageId: typeof metadata.pageId === "string" ? metadata.pageId : node.id,
      layoutId: null,
    };
  }

  if (
    node.type === "frame" &&
    node.reusable !== true &&
    scope.pageId === null
  ) {
    return { pageId: node.id, layoutId: null };
  }

  if (node.type === "frame" && node.reusable === true) {
    return {
      pageId: null,
      layoutId:
        normalizeFrameLayoutId(
          typeof metadata?.layoutId === "string" ? metadata.layoutId : null,
        ) ?? node.id,
    };
  }

  return scope;
}

export function getCanonicalPageRefDescendantChildren(
  node: CanonicalNode,
): CanonicalNode[][] {
  const metadataType = node.metadata?.type;
  if (
    node.type !== "ref" ||
    (metadataType !== "page" && metadataType !== "legacy-page")
  ) {
    return [];
  }

  return Object.values((node as RefNode).descendants ?? {})
    .map(readDescendantChildren)
    .filter((children) => children.length > 0);
}

/**
 * canonical document에서 legacy Element view에 나타나는 node 수를 센다.
 * Element 객체를 만들지 않으며 clone-on-write document 참조별로 결과를 캐시한다.
 */
export function getCanonicalDocumentProjectableNodeCount(
  document: CompositionDocument,
): number {
  const cached = projectableNodeCountCache.get(document);
  if (cached !== undefined) return cached;

  let count = 0;
  function visit(node: CanonicalNode): void {
    if (isCanonicalNodeProjectableToElement(node)) count += 1;
    for (const child of node.children ?? []) visit(child);
    for (const children of getCanonicalPageRefDescendantChildren(node)) {
      for (const child of children) visit(child);
    }
  }

  for (const child of document.children) visit(child);
  projectableNodeCountCache.set(document, count);
  return count;
}

function ensureCache(): TraversalCache | null {
  const snapshot = getActiveDocumentSnapshot();
  if (!snapshot) return null;

  if (
    cache &&
    cache.version === snapshot.version &&
    cache.projectId === snapshot.projectId &&
    cache.document === snapshot.doc
  ) {
    return cache;
  }

  const nodeMap = new Map<string, CanonicalNode>();
  const firstProjectableNodeById = new Map<
    string,
    CanonicalProjectableNodeLookup
  >();
  const projectableNodeLookups: CanonicalProjectableNodeLookup[] = [];
  const nodeOccurrenceCountById = new Map<string, number>();
  const childrenByParent = new Map<string, CanonicalNode[]>();
  const projectableNodes: CanonicalNode[] = [];
  const projectableChildrenByParent = new Map<string, CanonicalNode[]>();
  const parentEdge = new Map<string, string>();

  function visit(
    node: CanonicalNode,
    parentId: string | null,
    projectableParentId: string | null,
    scope: CanonicalProjectionScope,
  ): void {
    nodeOccurrenceCountById.set(
      node.id,
      (nodeOccurrenceCountById.get(node.id) ?? 0) + 1,
    );
    const nextScope = getCanonicalProjectionScope(node, scope);
    const isProjectable = isCanonicalNodeProjectableToElement(node);
    if (isProjectable) {
      const lookup: CanonicalProjectableNodeLookup = {
        node,
        parentId: projectableParentId,
        ...nextScope,
      };
      projectableNodes.push(node);
      projectableNodeLookups.push(lookup);
      if (!firstProjectableNodeById.has(node.id)) {
        firstProjectableNodeById.set(node.id, lookup);
      }
      if (projectableParentId) {
        const siblings = projectableChildrenByParent.get(projectableParentId);
        if (siblings) {
          siblings.push(node);
        } else {
          projectableChildrenByParent.set(projectableParentId, [node]);
        }
      }
    }
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
        visit(
          child,
          node.id,
          isProjectable ? node.id : projectableParentId,
          nextScope,
        );
      }
    }
    // Page ref 의 descendants replacement subtree 는 runtime page element다.
    // projection boundary 와 같은 순서로 방문하되, page wrapper 자체는
    // renderable parent 가 아니므로 override root 의 parent edge 는 비워 둔다.
    for (const children of getCanonicalPageRefDescendantChildren(node)) {
      for (const child of children) {
        visit(
          child,
          null,
          isProjectable ? node.id : projectableParentId,
          nextScope,
        );
      }
    }
  }

  for (const child of snapshot.doc.children) {
    visit(child, null, null, ROOT_PROJECTION_SCOPE);
  }

  cache = {
    version: snapshot.version,
    projectId: snapshot.projectId,
    document: snapshot.doc,
    nodeMap,
    firstProjectableNodeById,
    projectableNodeLookups,
    nodeOccurrenceCountById,
    childrenByParent,
    projectableNodes,
    projectableChildrenByParent,
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
 * 활성 canonical document에서 legacy Element view에 포함되는 nodeId의 첫 DFS
 * match를 반환한다.
 *
 * legacy `Element[].find()` mutation 경계가 중복 id 문서에서 사용하던 의미를
 * 유지하는 O(1) compatibility lookup이다. 정상 문서의 id는 유일해야 하지만,
 * migration 중 structural duplicate로 read target이 어긋나지 않도록 별도로 둔다.
 */
export function getFirstProjectableNodeById(
  nodeId: string,
): CanonicalNode | null {
  const c = ensureCache();
  return c?.firstProjectableNodeById.get(nodeId)?.node ?? null;
}

/** 첫 projectable node와 legacy projection parent/scope를 O(1)로 반환한다. */
export function getFirstProjectableNodeLookupById(
  nodeId: string,
): CanonicalProjectableNodeLookup | null {
  const c = ensureCache();
  return c?.firstProjectableNodeById.get(nodeId) ?? null;
}

/**
 * legacy derived view의 `byId`와 같은 마지막 projectable node를 반환한다.
 * 정상 문서의 unique id는 기존 nodeMap에서 O(1), migration 중 duplicate id만
 * projectable occurrence를 역검색하는 compatibility slow path를 사용한다.
 */
export function getLastProjectableNodeById(
  nodeId: string,
): CanonicalNode | null {
  const c = ensureCache();
  if (!c) return null;

  if ((c.nodeOccurrenceCountById.get(nodeId) ?? 0) <= 1) {
    const node = c.nodeMap.get(nodeId);
    return node && isCanonicalNodeProjectableToElement(node) ? node : null;
  }

  for (let index = c.projectableNodeLookups.length - 1; index >= 0; index--) {
    const node = c.projectableNodeLookups[index]?.node;
    if (node?.id === nodeId) return node;
  }
  return null;
}

/** migration 중 invalid duplicate id 감지용. 정상 문서는 항상 0 또는 1이다. */
export function getCanonicalNodeOccurrenceCount(nodeId: string): number {
  const c = ensureCache();
  return c?.nodeOccurrenceCountById.get(nodeId) ?? 0;
}

/** legacy Element view와 같은 projectable node 순서를 allocation 없이 반환한다. */
export function getProjectableNodes(): readonly CanonicalNode[] {
  const c = ensureCache();
  return c?.projectableNodes ?? EMPTY_PROJECTABLE_NODES;
}

/**
 * legacy projection과 같은 DFS occurrence 순서의 canonical node/context index.
 * aggregate adapter가 전체 Element[] traversal을 다시 수행하지 않고 한 번에
 * panel read index를 만들 때 사용한다. duplicate id occurrence도 보존한다.
 */
export function getProjectableNodeLookups(): readonly CanonicalProjectableNodeLookup[] {
  const c = ensureCache();
  return c?.projectableNodeLookups ?? EMPTY_PROJECTABLE_NODE_LOOKUPS;
}

/**
 * legacy Element view의 structural parent lifting을 보존한 parent→children cache.
 * props-only mutation의 inherited dirty propagation에서 Element projection을
 * 만들지 않기 위한 read-only view다.
 */
export function getProjectableChildrenByParent(): ReadonlyMap<
  string,
  readonly CanonicalNode[]
> {
  const c = ensureCache();
  return c?.projectableChildrenByParent ?? EMPTY_PROJECTABLE_CHILDREN_BY_PARENT;
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
// Ref override helpers (canonical-native — Element projection 비의존)
// ─────────────────────────────────────────────

/**
 * `RefNode.descendants` entries. Element[] materialize 없이 override 순회.
 * history / creation 경계의 ADR-127 leaf 계약.
 */
export function getCanonicalRefOverrideEntries(
  node: CanonicalNode,
): Array<[string, DescendantOverride]> {
  if (node.type !== "ref") return [];
  const descendants = (node as RefNode).descendants ?? {};
  return Object.entries(descendants);
}

/**
 * descendants 가 비어 있으면 키를 제거한 RefNode 를 반환한다.
 */
export function withCanonicalRefOverrides(
  refNode: RefNode,
  overrides: RefNode["descendants"],
): RefNode {
  if (overrides && Object.keys(overrides).length > 0) {
    return { ...refNode, descendants: overrides };
  }

  const { descendants: _descendants, ...rest } = refNode;
  return rest as RefNode;
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

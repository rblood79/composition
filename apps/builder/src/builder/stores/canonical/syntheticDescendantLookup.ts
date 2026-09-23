import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import {
  resolveCanonicalRefTree,
  type ResolvedCanonicalRefTree,
} from "../../../adapters/canonical/canonicalRefResolution";
import { getActiveCanonicalDocument } from "./canonicalElementsBridge";
import {
  getLastProjectableNodeLookupById,
  getNodeMap,
  type CanonicalProjectableNodeLookup,
} from "./canonicalTraversalHelpers";

/**
 * ADR-229 Phase 2 (F15) — synthetic 자식 (`<instance>/<path>`) 의 패널 표면.
 *
 * instance 의 자식은 canonical 문서에 노드가 없다 — 해소기 (`resolveCanonicalRefTree`) 가 origin
 * subtree 를 instance 아래로 실체화하며 만드는 **synthetic** 노드다 (id 는 `<instance>/<segment>[/…]`,
 * 캔버스 더블클릭 · Navigator 가 선택한다). 패널의 selected 파생은 projectable canonical 노드만
 * 읽어 1-level 부터 빈 상태였다 (Phase 0 실측). 여기서 같은 해소기로 instance 하나만 실체화해
 * (origin ⊕ 조합 자식 patch ⊕ 바깥 instance descendants) 그 노드를 lookup 모양으로 돌려준다 —
 * Properties/Styles 의 읽기가 plain 노드와 같은 경로를 탄다. 쓰기는 이 노드로 가지 않는다
 * (`inspectorActions.updateAndSave` 가 synthetic id 를 바깥 instance 의 `descendants[path]` 로
 * 돌린다 — U1).
 *
 * 문서 참조당 instance 별 1회 해소 (WeakMap). 문서 mutation 은 참조 교체라 캐시가 자연 무효.
 */

const SYNTHETIC_SEPARATOR = "/";

export function isSyntheticDescendantId(
  elementId: string | null | undefined,
): elementId is string {
  return (
    typeof elementId === "string" &&
    elementId.includes(SYNTHETIC_SEPARATOR) &&
    !elementId.startsWith("projection:") &&
    !elementId.includes("::page-frame::")
  );
}

/** `<instance>/<path>` 의 instance id (없으면 null). */
export function getSyntheticDescendantRootId(
  elementId: string | null | undefined,
): string | null {
  if (!isSyntheticDescendantId(elementId)) return null;
  const separator = elementId.indexOf(SYNTHETIC_SEPARATOR);
  return separator > 0 ? elementId.slice(0, separator) : null;
}

/** `<instance>/<path>` 의 path (descendants 키 — 바깥 instance 기준 전체 path). */
export function getSyntheticDescendantPathKey(
  elementId: string | null | undefined,
): string | null {
  if (!isSyntheticDescendantId(elementId)) return null;
  const separator = elementId.indexOf(SYNTHETIC_SEPARATOR);
  const path = elementId.slice(separator + 1);
  return path.length > 0 ? path : null;
}

const resolvedTreeCache = new WeakMap<
  CompositionDocument,
  Map<string, ResolvedCanonicalRefTree<CanonicalNode> | null>
>();

function resolveInstanceTree(
  document: CompositionDocument,
  rootLookup: CanonicalProjectableNodeLookup,
): ResolvedCanonicalRefTree<CanonicalNode> | null {
  let byRoot = resolvedTreeCache.get(document);
  if (!byRoot) {
    byRoot = new Map();
    resolvedTreeCache.set(document, byRoot);
  }
  const rootId = rootLookup.node.id;
  if (byRoot.has(rootId)) return byRoot.get(rootId) ?? null;
  const nodeMap = getNodeMap();
  const tree = resolveCanonicalRefTree<CanonicalNode>({
    elements: [rootLookup.node],
    // origin 조회는 문서 전체 map (Components 페이지 origin 포함) — 해소기가 id 로 찾는다.
    elementsMap: nodeMap,
    // canonical 노드는 parent_id 가 없다 — 자식 map 은 `children[]` 에서 (해소기의 기본 map 은
    //   Element 모양의 parent_id 로 만든다).
    childrenMap: canonicalChildrenMap(document, nodeMap),
  });
  byRoot.set(rootId, tree);
  return tree;
}

const childrenMapCache = new WeakMap<
  CompositionDocument,
  Map<string, CanonicalNode[]>
>();

function canonicalChildrenMap(
  document: CompositionDocument,
  nodeMap: ReadonlyMap<string, CanonicalNode>,
): Map<string, CanonicalNode[]> {
  const cached = childrenMapCache.get(document);
  if (cached) return cached;
  const map = new Map<string, CanonicalNode[]>();
  for (const node of nodeMap.values()) {
    if (node.children && node.children.length > 0) {
      map.set(node.id, [...node.children]);
    }
  }
  childrenMapCache.set(document, map);
  return map;
}

/**
 * synthetic 자식의 resolved 노드 lookup. instance 가 아니거나 path 가 없으면 null.
 * `node.id` 는 synthetic id 그대로, `parentId` 는 synthetic 부모 (직계면 instance id).
 */
export function getSyntheticDescendantLookup(
  elementId: string | null | undefined,
): CanonicalProjectableNodeLookup | null {
  const rootId = getSyntheticDescendantRootId(elementId);
  if (!rootId || !elementId) return null;
  const document = getActiveCanonicalDocument();
  if (!document) return null;
  const rootLookup = getLastProjectableNodeLookupById(rootId);
  if (!rootLookup) return null;
  const tree = resolveInstanceTree(document, rootLookup);
  const node = tree?.elementsMap.get(elementId);
  if (!node) return null;
  const parentId =
    (node as { parent_id?: string | null }).parent_id ??
    (node as { parentId?: string | null }).parentId ??
    rootId;
  return {
    node,
    parentId,
    pageId: rootLookup.pageId,
    layoutId: rootLookup.layoutId,
  };
}

/**
 * instance 의 해소된 type (origin type — `ref` 가 아니라 `TextField` 등). instance 가 아니거나 해소
 * 실패면 null. synthetic 자식의 부모 type 판정 (sub-part owner) 에 쓴다.
 */
export function getResolvedInstanceType(
  instanceId: string | null | undefined,
): string | null {
  if (!instanceId) return null;
  const document = getActiveCanonicalDocument();
  if (!document) return null;
  const rootLookup = getLastProjectableNodeLookupById(instanceId);
  if (!rootLookup) return null;
  const tree = resolveInstanceTree(document, rootLookup);
  const resolved = tree?.elementsMap.get(instanceId);
  return typeof resolved?.type === "string" ? resolved.type : null;
}

/** synthetic 자식의 synthetic 자식들 (Button 의 Icon/Text 등) — resolved children map. */
export function getSyntheticDescendantChildren(
  elementId: string | null | undefined,
): CanonicalNode[] {
  const rootId = getSyntheticDescendantRootId(elementId);
  if (!rootId || !elementId) return [];
  const document = getActiveCanonicalDocument();
  if (!document) return [];
  const rootLookup = getLastProjectableNodeLookupById(rootId);
  if (!rootLookup) return [];
  const tree = resolveInstanceTree(document, rootLookup);
  return tree?.childrenMap.get(elementId) ?? [];
}

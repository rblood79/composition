/**
 * canonical document 에서 중첩 판정에 필요한 "조상 타입 사슬" 을 읽는다.
 *
 * `resolveNestingViolation` 은 순수 표 판정이라 문서를 모른다. 이 모듈이 문서를 걸어
 * `[부모 타입, 조부모 타입, …, 루트]` 를 만들어 넘긴다. `ref` 노드의 `descendants`
 * children-mode override 안까지 내려간다 (`findNodeInChildren` 과 같은 범위).
 *
 * 문서 DFS 는 **인덱스를 만들 때 한 번**만 돈다 (`createCanonicalNestingIndex`). 다중
 * 드래그·배치 merge 는 요소마다 조상 사슬을 묻는데, 요소마다 DFS 를 다시 돌면 5k 문서
 * 에서 drop 프레임 안에 수백만 노드 방문이 들어간다 (리뷰 MEDIUM, 2026-09-08).
 */
import type {
  CanonicalNode,
  CompositionDocument,
  RefNode,
} from "../types/composition-document.types";

/** descendants 3-mode 중 children replacement 모드 — `children` 만 있고 `type` 이 없다. */
function isDescendantChildrenMode(
  override: unknown,
): override is { children: CanonicalNode[] } {
  return (
    typeof override === "object" &&
    override !== null &&
    !("type" in override) &&
    Array.isArray((override as { children?: unknown }).children)
  );
}

export interface CanonicalNestingIndexEntry {
  type: string;
  /** 직계 부모 id. 루트 직속이면 `null`. descendants 슬롯 안 노드는 ref 노드가 부모. */
  parentId: string | null;
  /** `type === "ref"` 일 때 원본 id. */
  refOrigin?: string;
}

export type CanonicalNestingIndex = ReadonlyMap<
  string,
  CanonicalNestingIndexEntry
>;

/** 문서 1회 DFS — id → {type, parentId}. 같은 문서에 여러 판정을 할 때 재사용한다. */
export function createCanonicalNestingIndex(
  document: CompositionDocument,
): CanonicalNestingIndex {
  const index = new Map<string, CanonicalNestingIndexEntry>();
  const visit = (node: CanonicalNode, parentId: string | null): void => {
    if (!index.has(node.id)) {
      index.set(node.id, {
        type: node.type,
        parentId,
        ...(node.type === "ref" ? { refOrigin: (node as RefNode).ref } : {}),
      });
    }
    for (const child of node.children ?? []) visit(child, node.id);
    if (node.type !== "ref") return;
    const descendants = (node as RefNode).descendants ?? {};
    for (const override of Object.values(descendants)) {
      if (!isDescendantChildrenMode(override)) continue;
      for (const child of override.children) visit(child, node.id);
    }
  };
  for (const child of document.children) visit(child, null);
  return index;
}

function resolveIndex(
  documentOrIndex: CompositionDocument | CanonicalNestingIndex,
): CanonicalNestingIndex {
  return documentOrIndex instanceof Map
    ? (documentOrIndex as CanonicalNestingIndex)
    : createCanonicalNestingIndex(documentOrIndex as CompositionDocument);
}

/** `startId` 부터 루트까지 타입 사슬 (startId 포함, 가까운 순). 없으면 `null`. */
function chainFrom(
  index: CanonicalNestingIndex,
  startId: string,
  stopAtInclusive?: string,
): string[] | null {
  const out: string[] = [];
  const seen = new Set<string>();
  let cursor: string | null = startId;
  while (cursor !== null) {
    if (seen.has(cursor)) return null;
    seen.add(cursor);
    const entry = index.get(cursor);
    if (!entry) return out.length > 0 ? out : null;
    out.push(entry.type);
    if (cursor === stopAtInclusive) break;
    cursor = entry.parentId;
  }
  return out;
}

export function findCanonicalNodeType(
  documentOrIndex: CompositionDocument | CanonicalNestingIndex,
  nodeId: string,
): string | null {
  return resolveIndex(documentOrIndex).get(nodeId)?.type ?? null;
}

/**
 * 노드의 직계 부모 id. 루트 직속이면 `null`, 노드가 없으면 `undefined`.
 */
export function findCanonicalParentId(
  documentOrIndex: CompositionDocument | CanonicalNestingIndex,
  nodeId: string,
): string | null | undefined {
  const entry = resolveIndex(documentOrIndex).get(nodeId);
  return entry ? entry.parentId : undefined;
}

/**
 * `parentId` 아래에 자식을 둘 때의 조상 타입 사슬 — `[parentType, …, root]`.
 * `parentId === null` 은 문서 루트 (빈 배열). 부모를 못 찾으면 `null`.
 */
export function collectAncestorTypesForChildOf(
  documentOrIndex: CompositionDocument | CanonicalNestingIndex,
  parentId: string | null,
): readonly string[] | null {
  if (parentId === null) return [];
  return chainFrom(resolveIndex(documentOrIndex), parentId);
}

/**
 * ref 노드의 descendants 슬롯 (`descendantPath`, `a/b/c` 형태 id 경로) 아래에 자식을 둘
 * 때의 조상 타입 사슬. 슬롯 컨테이너의 타입은 ref 가 가리키는 원본 안에서 읽고, 원본
 * 루트까지 올라간 뒤 ref 노드 → ref 의 문서 조상 순으로 잇는다.
 *
 * 원본이나 슬롯을 못 찾으면 `null` — 소비처는 판정을 건너뛴다 (fail-open: 이 경로는
 * projection id guard 를 이미 지난 뒤라 구조가 낯설면 막지 않는다).
 */
export function collectAncestorTypesForDescendantSlot(
  documentOrIndex: CompositionDocument | CanonicalNestingIndex,
  refNodeId: string,
  descendantPath: string,
): readonly string[] | null {
  const index = resolveIndex(documentOrIndex);
  const refEntry = index.get(refNodeId);
  if (!refEntry || refEntry.type !== "ref" || !refEntry.refOrigin) return null;
  const originId = refEntry.refOrigin;
  if (!index.has(originId)) return null;

  const slotId = descendantPath.split("/").filter(Boolean).pop();
  if (!slotId) return null;

  // 슬롯 → 원본 루트 (포함) 까지
  const withinOrigin = chainFrom(index, slotId, originId);
  if (!withinOrigin) return null;
  // 원본 루트 위로는 원본의 문서 조상이 아니라 ref 의 문서 조상을 잇는다
  const fromRef = chainFrom(index, refNodeId);
  if (!fromRef) return null;

  return [...withinOrigin, ...fromRef];
}

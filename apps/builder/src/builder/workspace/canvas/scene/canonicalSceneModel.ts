import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import { canonicalDocumentToFrameElementScopes } from "../../../../adapters/canonical/frameElementScope";
import {
  rebuildPageIndex,
  type PageElementIndex,
} from "../../../stores/utils/elementIndexer";
import type { Element } from "../../../../types/builder/unified.types";
import { canonicalDocumentToElements } from "../../../stores/canonical/canonicalElementsView";

/**
 * `CanonicalSceneModel` — canonical document 에서 derived 된 scene snapshot.
 *
 * **ADR-127 Phase 2 (canonical-native) — 2026-05-10 land**:
 * - **primary export**: `nodes` (CanonicalNode[]) + `nodesMap` (Map<string,
 *   CanonicalNode>) + `childrenByParent` (Map<string, CanonicalNode[]>).
 *   canonical document SSOT 의 평탄 projection — workspace hot path consumer 가
 *   직접 소비.
 * - **frameElementScopes / pageIndex**: 기존 derived index. Element 의존이
 *   잔존하지만 caller 는 page lookup 용도로만 사용. ADR-126 Phase 2 transition
 *   이후 canonical-native shape 으로 정렬.
 * - **legacy getter**: `Element[]` projection 이 필요한 transition caller 는
 *   `canonicalSceneModelLegacy.ts` (boundary 격리) 의
 *   `getSceneModelElementsLegacy(scene)` / `getSceneModelElementsMapLegacy(scene)`
 *   / `getSceneModelChildrenByParentLegacy(scene)` 사용. ADR-126 Phase 5 시점에
 *   본 helper 제거.
 *
 * **G2 grep gate (workspace scope 의 Element[] 사용)**: scene model interface
 * export 자체에 `Element[]` 미포함. legacy projection 은 boundary file 격리.
 *
 * **Why**: ADR-126 Phase 2 hot path 70 file transition 진입 prerequisite —
 * scene model 자체가 canonical-native shape 을 expose 해야 caller 가 점진
 * swap 가능.
 */
export interface CanonicalSceneModel {
  /** parent canonical node id → children CanonicalNode[] (배열 순서 = source order) */
  childrenByParent: Map<string, CanonicalNode[]>;
  /** canonical document 의 평탄 traversal projection (depth-first, source order) */
  nodes: CanonicalNode[];
  /** O(1) lookup index */
  nodesMap: Map<string, CanonicalNode>;
  /** legacy derived index — Page entity scope (Element[] 의존 잔존, ADR-126 Phase 2 위임) */
  frameElementScopes: ReturnType<typeof canonicalDocumentToFrameElementScopes>;
  pageIndex: PageElementIndex;
}

/**
 * canonical document 를 단일 traversal 하여 평탄 CanonicalNode list 와 derived
 * lookup map 을 생성.
 */
export function buildSceneNodeMap(
  nodes: CanonicalNode[],
): Map<string, CanonicalNode> {
  return new Map(nodes.map((node) => [node.id, node]));
}

/**
 * canonical document 의 nested CanonicalNode 를 평탄 list 로 collect (depth-first).
 */
export function flattenCanonicalDocumentNodes(
  doc: CompositionDocument,
): CanonicalNode[] {
  const result: CanonicalNode[] = [];
  const visit = (node: CanonicalNode): void => {
    result.push(node);
    if (node.children) {
      for (const child of node.children) {
        visit(child);
      }
    }
  };
  for (const child of doc.children) {
    visit(child);
  }
  return result;
}

/**
 * parent_id → children CanonicalNode[] 매핑. parent 가 없는 root level 노드는
 * map 에 entry 없음.
 */
export function buildSceneChildrenByParent(
  nodes: CanonicalNode[],
  doc: CompositionDocument,
): Map<string, CanonicalNode[]> {
  const map = new Map<string, CanonicalNode[]>();
  const visit = (node: CanonicalNode): void => {
    if (node.children && node.children.length > 0) {
      map.set(node.id, [...node.children]);
      for (const child of node.children) {
        visit(child);
      }
    }
  };
  for (const child of doc.children) {
    visit(child);
  }
  return map;
}

/**
 * canonical document 로부터 scene model 을 단일 traversal 로 build.
 *
 * **ADR-127 Phase 2 (canonical-native)**:
 * - `nodes` / `nodesMap` / `childrenByParent` 는 모두 canonical-native shape
 *   (CanonicalNode 기반) 으로 derive.
 * - `pageIndex` / `frameElementScopes` 는 legacy derived index — Element[]
 *   호환성을 위해 `canonicalDocumentToElements()` projection 을 internal source
 *   로 사용. ADR-126 Phase 2 transition 이후 canonical-native 로 정렬.
 *
 * Builder hot path 에서 `useStore.elementsMap` mutable subscription 대신 본
 * 함수의 결과 (또는 `useCanonicalSceneSnapshot` derived) 를 사용한다.
 * ADR-122 HC.1 + ADR-125 §Layer 규칙 + ADR-127 Phase 2.
 */
export function buildCanonicalSceneModel(
  doc: CompositionDocument,
): CanonicalSceneModel {
  const nodes = flattenCanonicalDocumentNodes(doc);
  const nodesMap = buildSceneNodeMap(nodes);
  const childrenByParent = buildSceneChildrenByParent(nodes, doc);

  // legacy pageIndex/frameElementScopes 는 Element 기반 indexer 호출 (boundary).
  // ADR-126 Phase 2 transition 후 canonical-native 로 정렬 예정.
  const legacyElements: Element[] = canonicalDocumentToElements(doc);
  const legacyElementsMap = new Map<string, Element>(
    legacyElements.map((e) => [e.id, e]),
  );

  return {
    childrenByParent,
    nodes,
    nodesMap,
    frameElementScopes: canonicalDocumentToFrameElementScopes(doc),
    pageIndex: rebuildPageIndex(legacyElements, legacyElementsMap),
  };
}

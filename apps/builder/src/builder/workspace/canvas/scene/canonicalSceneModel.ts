import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import { canonicalDocumentToFrameElementScopes } from "../../../../adapters/canonical/frameElementScope";
import { resolveCanonicalRefTree } from "../../../utils/canonicalRefResolution";
import type { PageElementIndex } from "../../../stores/utils/elementIndexer";
import {
  type CanvasSceneGraph,
  buildCanvasSceneGraph,
  buildCanvasScenePageIndex,
  type CanvasSceneNode,
} from "./canvasSceneNode";

/**
 * `CanonicalSceneModel` — canonical document 에서 derived 된 scene snapshot.
 *
 * **ADR-127 Phase 2 (canonical-native) — 2026-05-10 land**:
 * - **primary export**: `nodes` (CanonicalNode[]) + `nodesMap` (Map<string,
 *   CanonicalNode>) + `childrenByParent` (Map<string, CanonicalNode[]>).
 *   canonical document SSOT 의 평탄 projection — workspace hot path consumer 가
 *   직접 소비.
 * - **frameElementScopes**: 기존 frame scope boundary. caller 는 page/frame lookup
 *   용도로만 사용. ADR-126 Phase 2 이후 canonical-native shape 으로 정렬.
 * - **pageIndex**: `sceneNodes` 에서 직접 derive 하므로 scene model 내부에서
 *   flat legacy projection 을 만들지 않는다.
 * - **legacy getter**: flat compatibility projection 이 필요한 transition caller 는
 *   `canonicalSceneModelLegacy.ts` (boundary 격리) 의
 *   `getSceneModelElementsLegacy(scene)` / `getSceneModelElementsMapLegacy(scene)`
 *   / `getSceneModelChildrenByParentLegacy(scene)` 사용. ADR-126 Phase 5 시점에
 *   본 helper 제거.
 *
 * **G2 grep gate (workspace scope 의 flat compatibility projection 사용)**:
 * scene model interface export 자체에 legacy flat array 미포함. compatibility
 * projection 은 boundary file 격리.
 *
 * **Why**: ADR-126 Phase 2 hot path 70 file transition 진입 prerequisite —
 * scene model 자체가 canonical-native shape 을 expose 해야 caller 가 점진
 * swap 가능.
 */
export interface CanonicalSceneModel {
  /** parent canonical node id → children CanonicalNode[] (배열 순서 = source order) */
  childrenByParent: Map<string, CanonicalNode[]>;
  /** renderable canonical scene node 의 parent id → children list */
  sceneChildrenByParent: Map<string, CanvasSceneNode[]>;
  /** renderable canonical scene node 의 평탄 traversal projection */
  sceneNodes: CanvasSceneNode[];
  /** renderable canonical scene node O(1) lookup index */
  sceneNodesMap: Map<string, CanvasSceneNode>;
  /** renderable canonical scene node 의 child id → parent id index */
  sceneParentById: Map<string, string>;
  /** canonical document 의 평탄 traversal projection (depth-first, source order) */
  nodes: CanonicalNode[];
  /** O(1) lookup index */
  nodesMap: Map<string, CanonicalNode>;
  /** Page entity scope index, derived from renderable canonical scene nodes */
  frameElementScopes: ReturnType<typeof canonicalDocumentToFrameElementScopes>;
  pageIndex: PageElementIndex;
}

function buildSceneParentById(
  childrenByParent: Map<string, CanvasSceneNode[]>,
): Map<string, string> {
  const parentById = new Map<string, string>();
  for (const [parentId, children] of childrenByParent) {
    for (const child of children) {
      parentById.set(child.id, parentId);
    }
  }
  return parentById;
}

function resolveSceneGraph(graph: CanvasSceneGraph): CanvasSceneGraph {
  const resolved = resolveCanonicalRefTree({
    childrenMap: graph.childrenByParent,
    elements: graph.nodes,
    elementsMap: graph.nodesMap,
  });

  return {
    childrenByParent: resolved.childrenMap,
    nodes: resolved.elements,
    nodesMap: resolved.elementsMap,
    parentById: buildSceneParentById(resolved.childrenMap),
  };
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
 * - `pageIndex` 는 `sceneNodes` 에서 직접 derive 한다. scene model build 중
 *   legacy flat projection 을 만들지 않는다.
 * - `frameElementScopes` 는 frame scope compatibility boundary 로 유지하며,
 *   ADR-126 Phase 2 transition 이후 canonical-native shape 으로 정렬한다.
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
  const sceneGraph = resolveSceneGraph(
    buildCanvasSceneGraph(doc, { includeReusableFrames: true }),
  );

  return {
    childrenByParent,
    sceneChildrenByParent: sceneGraph.childrenByParent,
    sceneNodes: sceneGraph.nodes,
    sceneNodesMap: sceneGraph.nodesMap,
    sceneParentById: sceneGraph.parentById,
    nodes,
    nodesMap,
    frameElementScopes: canonicalDocumentToFrameElementScopes(doc),
    pageIndex: buildCanvasScenePageIndex(sceneGraph),
  };
}

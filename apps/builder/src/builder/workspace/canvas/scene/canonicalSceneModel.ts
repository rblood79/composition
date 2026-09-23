import type {
  BreakpointName,
  CanonicalNode,
  CompositionDocument,
  VariableDef,
} from "@composition/shared";

import { canonicalDocumentToFrameElementScopes } from "../../../../adapters/canonical/frameElementScope";
import {
  resolveCanonicalRefTree,
  type RefInstanceResolution,
} from "../../../utils/canonicalRefResolution";
import type { PageElementIndex } from "../../../stores/utils/elementIndexer";
import {
  type CanvasSceneGraph,
  appendRefInstanceChildProjections,
  appendStaticTagShowAllChips,
  appendStaticTagRemoveButtons,
  buildCanvasSceneGraph,
  buildCanvasScenePageIndex,
  type CanvasSceneNode,
  type CollectionWindowResolution,
} from "./canvasSceneNode";
import type { ListBoxCollectionDataSource } from "../../../components/listbox/listBoxRowProjectionModel";

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
 * - **legacy getter**: ADR-912 후속 cleanup 으로 scene-model flat projection
 *   getter와 초기 bootstrap fallback을 제거했다.
 *
 * **G2 grep gate (workspace scope 의 flat compatibility projection 사용)**:
 * scene model interface export 자체에 legacy flat array 미포함. compatibility
 * projection 은 workspace render path에서 사용하지 않는다.
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

type BuildCanonicalSceneModelOptions = {
  collections?: readonly ListBoxCollectionDataSource[];
  /** ADR-214 — 프로젝트 변수 정의 (가시성 사슬 마지막 단 · `stateDeps` 해석 입력). */
  projectVariables?: readonly VariableDef[];
  /**
   * ADR-150 A2: 가상화된 collection owner 의 window map (BuilderCanvas precompute).
   * 미제공 owner 는 legacy 정적 cap 투영(BC).
   */
  collectionWindows?: ReadonlyMap<string, CollectionWindowResolution>;
  /**
   * ADR-154 Bug3: collection projection 이 owner responsive override 를 resolve 할
   * 기준 breakpoint. BuilderCanvas 가 store activeBreakpoint 를 주입(useMemo dep).
   */
  activeBreakpoint?: BreakpointName;
};

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

/**
 * ADR-234 G4 — 직전 scene build 의 ref instance 해석 결과 (한 칸). 문서 · 해석 입력 옵션 (collections ·
 * 프로젝트 변수) 이 같으면 재사용한다 — breakpoint · collection window 는 projection 노드만 바꾸고 ref
 * 해석은 projection 노드를 건너뛰므로 입력이 아니다 (바인딩 목록 결과는 해석기가 기록하지 않는다).
 */
let lastRefResolution: {
  doc: CompositionDocument;
  collections: BuildCanonicalSceneModelOptions["collections"];
  projectVariables: BuildCanonicalSceneModelOptions["projectVariables"];
  records: Map<string, RefInstanceResolution<CanvasSceneNode>>;
} | null = null;

/** 테스트 · 진단용 — 다음 build 가 재사용 없이 전부 해석하게 한다. */
export function resetSceneRefResolutionReuse(): void {
  lastRefResolution = null;
}

function resolveSceneGraph(
  doc: CompositionDocument,
  graph: CanvasSceneGraph,
  options: BuildCanonicalSceneModelOptions,
  documentNodesById: Map<string, CanonicalNode>,
): CanvasSceneGraph {
  const previous =
    lastRefResolution &&
    lastRefResolution.doc === doc &&
    lastRefResolution.collections === options.collections &&
    lastRefResolution.projectVariables === options.projectVariables
      ? lastRefResolution.records
      : null;
  const next = new Map<string, RefInstanceResolution<CanvasSceneNode>>();
  const resolved = resolveCanonicalRefTree({
    childrenMap: graph.childrenByParent,
    elements: graph.nodes,
    elementsMap: graph.nodesMap,
    reuse: { previous, next },
  });
  lastRefResolution = {
    doc,
    collections: options.collections,
    projectVariables: options.projectVariables,
    records: next,
  };

  const resolvedGraph: CanvasSceneGraph = {
    childrenByParent: resolved.childrenMap,
    nodes: resolved.elements,
    nodesMap: resolved.elementsMap,
    parentById: buildSceneParentById(resolved.childrenMap),
  };
  // ADR-228: ref instance 의 synthetic 자식 (TagList/TabList) 은 실체화가 scene visit 뒤라 자식 소유
  //   projection 을 못 받는다 — resolved owner (instance) props 로 여기서 붙인다.
  appendRefInstanceChildProjections(
    resolvedGraph,
    {
      collections: options.collections,
      collectionWindows: options.collectionWindows,
      activeBreakpoint: options.activeBreakpoint,
      projectVariables: options.projectVariables,
    },
    () => documentNodesById,
  );
  const pruned = pruneDisabledSceneNodes(resolvedGraph);
  // ADR-234 후속: 정적 TagList 의 maxRows 「Show all」 chip — 숨긴 Tag 를 세지 않게 prune 뒤.
  appendStaticTagShowAllChips(pruned);
  // ADR-234 후속: 정적 Tag 의 allowsRemoving X (DOM 은 RAC 가 넣는 remove 버튼).
  appendStaticTagRemoveButtons(pruned);
  return pruned;
}

/**
 * ADR-234 — 유효 `enabled === false` 인 노드와 그 subtree 를 scene 에서 뺀다 (Skia · layout · hit
 * test 가 모두 scene 을 읽는다). 해석 전에 빼면 instance 가 `enabled: true` 로 되살릴 origin 자식이
 * 사라지므로 ref 해석 · projection 이 끝난 뒤 한 번만 뺀다. 숨긴 노드가 없으면 같은 graph.
 */
export function pruneDisabledSceneNodes(
  graph: CanvasSceneGraph,
): CanvasSceneGraph {
  const hiddenRoots = graph.nodes.filter((node) => node.enabled === false);
  if (hiddenRoots.length === 0) return graph;
  const removed = new Set<string>();
  const stack = hiddenRoots.map((node) => node.id);
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (removed.has(id)) continue;
    removed.add(id);
    for (const child of graph.childrenByParent.get(id) ?? []) {
      stack.push(child.id);
    }
  }
  const childrenByParent = new Map<string, CanvasSceneNode[]>();
  for (const [parentId, children] of graph.childrenByParent) {
    if (removed.has(parentId)) continue;
    childrenByParent.set(
      parentId,
      children.filter((child) => !removed.has(child.id)),
    );
  }
  const nodesMap = new Map(graph.nodesMap);
  for (const id of removed) nodesMap.delete(id);
  return {
    childrenByParent,
    nodes: graph.nodes.filter((node) => !removed.has(node.id)),
    nodesMap,
    parentById: buildSceneParentById(childrenByParent),
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
  options: BuildCanonicalSceneModelOptions = {},
): CanonicalSceneModel {
  const nodes = flattenCanonicalDocumentNodes(doc);
  const nodesMap = buildSceneNodeMap(nodes);
  const childrenByParent = buildSceneChildrenByParent(nodes, doc);
  const sceneGraph = resolveSceneGraph(
    doc,
    buildCanvasSceneGraph(doc, {
      collections: options.collections,
      collectionWindows: options.collectionWindows,
      activeBreakpoint: options.activeBreakpoint,
      projectVariables: options.projectVariables,
      includeReusableFrames: true,
    }),
    options,
    nodesMap,
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

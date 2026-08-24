import type { Page } from "../../../../types/core/store.types";
import type { PageElementIndex } from "../../../stores/utils/elementIndexer";
import type { ScenePageSnapshot, SceneStructureSnapshot } from "../scene";
import type {
  CanvasSceneGraph,
  CanvasSceneNode,
} from "../scene/canvasSceneNode";
import type { CanvasLayoutNode } from "../layout/layoutNode";
import type { FrameAreaGroup } from "../skia/workflowEdges";
import type {
  CanonicalFrameElementScope,
  CanonicalFrameElementScopeMap,
} from "../../../../adapters/canonical/frameElementScope";
import {
  SkiaPresentationProjectionIndexBuilder,
  type SkiaPresentationProjectionIndex,
} from "../../../presentation/skiaPresentationProjectionIndex";

export interface LayoutPublisherInput {
  bodyElement: CanvasLayoutNode | null;
  depthMap: Map<string, number>;
  dirtyElementIds: Set<string>;
  elementById: Map<string, CanvasLayoutNode>;
  layoutVersion: number;
  pageElements: CanvasLayoutNode[];
  pageHeight: number;
  pageId: string;
  pagePositionVersion: number;
  pageSnapshot: ScenePageSnapshot;
  projectionVersion: number;
  pageWidth: number;
  panOffset: { x: number; y: number };
  wasmLayoutReady: boolean;
  zoom: number;
}

interface BuildPageLayoutPublisherInputOptions {
  elementById: ReadonlyMap<string, CanvasLayoutNode>;
  dirtyElementIds: Set<string>;
  pageHeight: number;
  pageId: string;
  pagePositionVersion: number;
  pageWidth: number;
  panOffset: { x: number; y: number };
  sceneSnapshot: SceneStructureSnapshot;
  wasmLayoutReady: boolean;
  zoom: number;
}

export function buildPageLayoutPublisherInput({
  elementById,
  dirtyElementIds,
  pageHeight,
  pageId,
  pagePositionVersion,
  pageWidth,
  panOffset,
  sceneSnapshot,
  wasmLayoutReady,
  zoom,
}: BuildPageLayoutPublisherInputOptions): LayoutPublisherInput | null {
  const pageSnapshot = sceneSnapshot.pageSnapshots.get(pageId);
  if (!pageSnapshot?.bodyElement) {
    return null;
  }

  return {
    bodyElement: pageSnapshot.bodyElement,
    depthMap: sceneSnapshot.depthMap,
    dirtyElementIds,
    elementById: new Map(elementById),
    layoutVersion: sceneSnapshot.layoutVersion,
    pageElements: pageSnapshot.pageElements,
    pageHeight,
    pageId,
    pagePositionVersion,
    pageSnapshot,
    projectionVersion: sceneSnapshot.sceneVersion,
    pageWidth,
    panOffset,
    wasmLayoutReady,
    zoom,
  };
}

interface BuildFrameRendererInputOptions {
  dirtyElementIds: Set<string>;
  elementById: ReadonlyMap<string, CanvasLayoutNode>;
  /** ADR-111 P3-α framePositions[frameId] (또는 frameAreas fallback) */
  frameHeight: number;
  /** canonical reusable frame scope id */
  frameId: string;
  frameElementScope: CanonicalFrameElementScope | null;
  frameWidth: number;
  frameX: number;
  frameY: number;
  pagePositionVersion: number;
  panOffset: { x: number; y: number };
  sceneSnapshot: SceneStructureSnapshot;
  wasmLayoutReady: boolean;
  zoom: number;
}

/**
 * ADR-111 P3-δ fix #3 (D4=A, 2026-04-28) — frame body 의 LayoutPublisherInput
 * shape 빌드. page-centric 함수와 분리 (rendererInput.ts 의 page 함수와 frame
 * 함수 분리 명확).
 *
 * Body element 식별: canonical reusable FrameNode scope 의 `bodyElementId`.
 * pageElements: canonical frame scope 의 element id set 을 source 로 삼아
 * frame subtree 전체를 수집한다. legacy `layout_id` mirror predicate 는 이
 * renderer input 경로에서 더 이상 사용하지 않는다.
 *
 * **pageElements 에서 bodyElement 자신은 제외** — page 경로 (`buildSceneIndex`
 * 의 `nonBodyElements`) 와 일치. `buildPageChildrenMap` 의 `parent_id ?? bodyId`
 * fallback 으로 body 가 자기 자신의 child 가 되어 DFS 무한 재귀 발생 방지
 * (P3-δ fix #3 RangeError 회귀 fix).
 *
 * pageSnapshot 은 frame 용 synthetic 으로 빌드 (sceneSnapshot.pageSnapshots
 * 는 page 만 보유). `useLayoutPublisher` 는 pageSnapshot 미사용이므로 다른
 * consumer 영향 없음.
 */
export function buildFrameLayoutPublisherInput({
  dirtyElementIds,
  elementById,
  frameHeight,
  frameId,
  frameElementScope,
  frameWidth,
  frameX,
  frameY,
  pagePositionVersion,
  panOffset,
  sceneSnapshot,
  wasmLayoutReady,
  zoom,
}: BuildFrameRendererInputOptions): LayoutPublisherInput | null {
  if (!frameElementScope) return null;

  const layoutElementById = new Map(elementById);
  const bodyElement = frameElementScope.bodyElementId
    ? (layoutElementById.get(frameElementScope.bodyElementId) ?? null)
    : null;
  if (
    !bodyElement ||
    bodyElement.deleted ||
    bodyElement.type.toLowerCase() !== "body"
  ) {
    return null;
  }

  const bodySceneElement = bodyElement as CanvasSceneNode;
  const pageElements: CanvasSceneNode[] = [];

  for (const elementId of frameElementScope.elementIds) {
    if (elementId === bodyElement.id) continue;
    const el = layoutElementById.get(elementId);
    if (!el || el.deleted || el.type.toLowerCase() === "body") continue;
    pageElements.push(el as CanvasSceneNode);
  }

  const frameSnapshot: ScenePageSnapshot = {
    bodyElement: bodySceneElement,
    contentVersion: 0,
    frame: {
      elementCount: pageElements.length,
      height: frameHeight,
      id: frameId,
      title: bodyElement.id,
      width: frameWidth,
      x: frameX,
      y: frameY,
    },
    isVisible: true,
    pageElements,
    pageId: frameId,
    positionVersion: pagePositionVersion,
  };

  return {
    bodyElement: bodySceneElement,
    depthMap: sceneSnapshot.depthMap,
    dirtyElementIds,
    elementById: layoutElementById,
    layoutVersion: sceneSnapshot.layoutVersion,
    pageElements,
    pageHeight: frameHeight,
    pageId: frameId,
    pagePositionVersion,
    pageSnapshot: frameSnapshot,
    projectionVersion: sceneSnapshot.sceneVersion,
    pageWidth: frameWidth,
    panOffset,
    wasmLayoutReady,
    zoom,
  };
}

export interface SkiaRendererInput {
  childrenMap: Map<string, CanvasSceneNode[]>;
  elements: CanvasSceneNode[];
  interactionChildrenMap: Map<string, CanvasSceneNode[]>;
  interactionNodesMap: Map<string, CanvasSceneNode>;
  renderNodesMap: Map<string, CanvasSceneNode>;
  sceneChildrenByParent: Map<string, CanvasSceneNode[]>;
  sceneNodes: CanvasSceneNode[];
  sceneNodesMap: Map<string, CanvasSceneNode>;
  dirtyElementIds: Set<string>;
  documentRevision: number;
  editMode: "page" | "layout";
  pageIndex: PageElementIndex;
  pagePositionsVersion: number;
  pagePositions: Record<string, { x: number; y: number } | undefined>;
  pageSnapshots: Map<string, ScenePageSnapshot>;
  projectionVersion: number;
  pages: Page[];
  sceneSnapshot: SceneStructureSnapshot;
  presentationProjectionIndex: SkiaPresentationProjectionIndex;

  // ADR-111 P3-δ: reusable frame canvas authoring 시각 path
  /** P3-α store: frame id (legacy layoutId) → 캔버스 영역 좌표/크기 */
  framePositions: Record<
    string,
    { x: number; y: number; width: number; height: number } | undefined
  >;
  /** P3-α store: framePositions 변경 카운터 (cache invalidation key) */
  framePositionsVersion: number;
  /** P3-β computeFrameAreas: canonical reusable frame 별 캔버스 영역 그룹 */
  frameAreas: FrameAreaGroup[];
  frameElementScopes: CanonicalFrameElementScopeMap;
}

interface CreateSkiaRendererInputOptions {
  childrenMap: Map<string, CanvasSceneNode[]>;
  elements: CanvasSceneNode[];
  renderNodesMap: Map<string, CanvasSceneNode>;
  sceneChildrenByParent: Map<string, CanvasSceneNode[]>;
  sceneNodes: CanvasSceneNode[];
  sceneNodesMap: Map<string, CanvasSceneNode>;
  dirtyElementIds: Set<string>;
  documentRevision: number;
  editMode: "page" | "layout";
  pageIndex: PageElementIndex;
  pagePositionsVersion: number;
  pagePositions: Record<string, { x: number; y: number } | undefined>;
  pages: Page[];
  sceneSnapshot: SceneStructureSnapshot;
  framePositions: Record<
    string,
    { x: number; y: number; width: number; height: number } | undefined
  >;
  framePositionsVersion: number;
  frameAreas: FrameAreaGroup[];
  frameElementScopes: CanonicalFrameElementScopeMap;
}

function addPresentationProjection(
  builder: SkiaPresentationProjectionIndexBuilder,
  element: CanvasSceneNode,
  sceneNodesMap: Map<string, CanvasSceneNode>,
): void {
  builder.addCanonicalProjection(element.sourceNode.id, element.id);
  // Keep inherited color fan-out separate from the ordinary self projection.
  // A render node enters the inherited set only when its own style has no
  // color declaration; this makes the target set atomic while preserving
  // explicit descendant colors.
  const hasOwnColor = (node: { props?: Record<string, unknown> }): boolean => {
    const style = node.props?.style;
    return (
      style !== null &&
      typeof style === "object" &&
      !Array.isArray(style) &&
      Object.prototype.hasOwnProperty.call(style, "color")
    );
  };
  if (hasOwnColor(element.sourceNode)) {
    builder.addInheritedCanonicalProjection(element.sourceNode.id, element.id);
  }
  let parentId = element.parentId ?? element.parent_id ?? null;
  while (parentId) {
    const parent = sceneNodesMap.get(parentId);
    if (!parent) break;
    if (hasOwnColor(parent)) {
      if (!hasOwnColor(element.sourceNode)) {
        builder.addInheritedCanonicalProjection(parent.id, element.id);
      }
    }
    parentId = parent.parentId ?? parent.parent_id ?? null;
  }
  if (typeof element.ref === "string") {
    builder.addCanonicalProjection(element.ref, element.id);
  }
  // canonical ref descendant는 renderer synthetic id를 protocol로 노출하지 않고
  // `<refId>/<stable path>`를 semantic target index로 환원한다.
  const syntheticSeparator = element.id.indexOf("/");
  if (syntheticSeparator > 0 && !element.id.startsWith("projection:")) {
    builder.addRefDescendantProjection(
      element.id.slice(0, syntheticSeparator),
      element.id.slice(syntheticSeparator + 1),
      element.id,
    );
  }
  if (
    element.projection?.kind === "page-frame-element" ||
    element.projection?.kind === "page-slot-fill"
  ) {
    builder.addCanonicalProjection(
      element.projection.sourceElementId,
      element.id,
    );
  }
}

function buildPresentationProjectionIndex(
  input: CreateSkiaRendererInputOptions,
): SkiaPresentationProjectionIndex {
  const builder = new SkiaPresentationProjectionIndexBuilder();
  if (input.editMode === "page") {
    const visiblePageIds = new Set<string>();
    for (const pageSnapshot of input.sceneSnapshot.pageSnapshots.values()) {
      if (!pageSnapshot.isVisible) continue;
      visiblePageIds.add(pageSnapshot.pageId);
      if (pageSnapshot.bodyElement) {
        addPresentationProjection(
          builder,
          pageSnapshot.bodyElement,
          input.sceneNodesMap,
        );
      }
      for (const element of pageSnapshot.pageElements) {
        // page-frame / slot-fill projection은 resolvePageWithFrame가 만든
        // page snapshot에만 존재할 수 있다. source sceneNodes를 다시 훑으면
        // 실제 render id(::page-frame::)가 누락되므로 visible render tree 자체를
        // projection index의 SSOT로 사용한다.
        addPresentationProjection(builder, element, input.sceneNodesMap);
      }
    }

    // StoreRenderBridge가 실제 Skia registry를 채우는 renderNodesMap은
    // page snapshot보다 먼저 canonical store 변경을 볼 수 있다. 그 짧은
    // window에 pageElements만 SSOT로 사용하면 registry에는 node가 있는데
    // projection index에는 target이 없어 paint overlay가 조용히 no-op 된다.
    // visible pageId가 증명되는 render node만 보강하여 hidden page/source
    // element를 continuous lane에 노출하지 않는다.
    for (const element of input.renderNodesMap.values()) {
      if (element.deleted) continue;
      const pageId = element.pageId ?? element.page_id ?? null;
      if (!pageId || !visiblePageIds.has(pageId)) continue;
      addPresentationProjection(builder, element, input.sceneNodesMap);
    }
    return builder.build();
  }

  const visibleRenderIds = new Set<string>();
  const visibleFrameElementIds = new Set<string>();
  for (const area of input.frameAreas) {
    const scope = input.frameElementScopes.get(area.frameId);
    if (!scope) continue;
    for (const elementId of scope.elementIds) {
      visibleFrameElementIds.add(elementId);
    }
  }

  const visibleDescendantQueue: string[] = [];
  for (const node of input.sceneNodes) {
    if (!visibleFrameElementIds.has(node.id)) continue;
    visibleRenderIds.add(node.id);
    visibleDescendantQueue.push(node.id);
  }
  for (let index = 0; index < visibleDescendantQueue.length; index += 1) {
    const parentId = visibleDescendantQueue[index]!;
    for (const child of input.sceneChildrenByParent.get(parentId) ?? []) {
      if (visibleRenderIds.has(child.id)) continue;
      visibleRenderIds.add(child.id);
      visibleDescendantQueue.push(child.id);
    }
  }
  for (const node of input.sceneNodes) {
    if (visibleRenderIds.has(node.id)) {
      addPresentationProjection(builder, node, input.sceneNodesMap);
    }
  }
  return builder.build();
}

function buildSceneParentIndex(
  nodes: readonly CanvasSceneNode[],
): Map<string, string> {
  const parentById = new Map<string, string>();
  for (const node of nodes) {
    const parentId = node.parentId ?? node.parent_id ?? null;
    if (parentId) parentById.set(node.id, parentId);
  }
  return parentById;
}

function buildRendererChildrenMap(
  elements: Iterable<CanvasSceneNode>,
): Map<string, CanvasSceneNode[]> {
  const childrenMap = new Map<string, CanvasSceneNode[]>();

  for (const element of elements) {
    if (element.deleted) continue;
    const parentId = element.parentId ?? null;
    if (!parentId) continue;
    const list = childrenMap.get(parentId);
    if (list) {
      list.push(element);
    } else {
      childrenMap.set(parentId, [element]);
    }
  }

  return childrenMap;
}

function buildPageResolvedRenderTree(input: CreateSkiaRendererInputOptions): {
  childrenMap: Map<string, CanvasSceneNode[]>;
  elements: CanvasSceneNode[];
  renderNodesMap: Map<string, CanvasSceneNode>;
} {
  const renderNodesMap = new Map(input.renderNodesMap);
  const orderedElements: CanvasSceneNode[] = [];
  const orderedIndexById = new Map<string, number>();

  const addElement = (element: CanvasSceneNode): void => {
    renderNodesMap.set(element.id, element);
    const existingIndex = orderedIndexById.get(element.id);
    if (existingIndex !== undefined) {
      orderedElements[existingIndex] = element;
      return;
    }
    orderedIndexById.set(element.id, orderedElements.length);
    orderedElements.push(element);
  };

  for (const pageSnapshot of input.sceneSnapshot.pageSnapshots.values()) {
    if (pageSnapshot.bodyElement) {
      addElement(pageSnapshot.bodyElement);
    }
    for (const element of pageSnapshot.pageElements) {
      addElement(element);
    }
  }

  for (const element of input.elements) {
    addElement(renderNodesMap.get(element.id) ?? element);
  }

  for (const element of input.renderNodesMap.values()) {
    addElement(renderNodesMap.get(element.id) ?? element);
  }

  return {
    childrenMap: buildRendererChildrenMap(orderedElements),
    elements: orderedElements,
    renderNodesMap,
  };
}

export function createSkiaRendererInput(
  input: CreateSkiaRendererInputOptions,
): SkiaRendererInput {
  const renderTree = buildPageResolvedRenderTree(input);
  const sourceSceneGraph: CanvasSceneGraph = {
    childrenByParent: input.sceneChildrenByParent,
    nodes: input.sceneNodes,
    nodesMap: input.sceneNodesMap,
    parentById: buildSceneParentIndex(input.sceneNodes),
  };

  return {
    childrenMap: renderTree.childrenMap,
    elements: renderTree.elements,
    interactionChildrenMap: renderTree.childrenMap,
    interactionNodesMap: renderTree.renderNodesMap,
    renderNodesMap: renderTree.renderNodesMap,
    sceneChildrenByParent: sourceSceneGraph.childrenByParent,
    sceneNodes: sourceSceneGraph.nodes,
    sceneNodesMap: sourceSceneGraph.nodesMap,
    dirtyElementIds: input.dirtyElementIds,
    documentRevision: input.documentRevision,
    editMode: input.editMode,
    pageIndex: input.pageIndex,
    pagePositionsVersion: input.pagePositionsVersion,
    pagePositions: input.pagePositions,
    pageSnapshots: input.sceneSnapshot.pageSnapshots,
    projectionVersion: input.sceneSnapshot.sceneVersion,
    pages: input.pages,
    sceneSnapshot: input.sceneSnapshot,
    presentationProjectionIndex: buildPresentationProjectionIndex(input),
    framePositions: input.framePositions,
    framePositionsVersion: input.framePositionsVersion,
    frameAreas: input.frameAreas,
    frameElementScopes: input.frameElementScopes,
  };
}

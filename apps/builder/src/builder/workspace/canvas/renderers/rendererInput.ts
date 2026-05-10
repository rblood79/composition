import type { Element, Page } from "../../../../types/core/store.types";
import type { CanonicalNode } from "@composition/shared";
import type { PageElementIndex } from "../../../stores/utils/elementIndexer";
import type { ScenePageSnapshot, SceneStructureSnapshot } from "../scene";
import type {
  CanvasSceneGraph,
  CanvasSceneNode,
} from "../scene/canvasSceneNode";
import type { CanvasLayoutNode } from "../layout/layoutNode";
import type { FrameAreaGroup } from "../skia/workflowEdges";
import { resolveCanonicalRefTree } from "../../../utils/canonicalRefResolution";
import type {
  CanonicalFrameElementScope,
  CanonicalFrameElementScopeMap,
} from "../../../../adapters/canonical/frameElementScope";

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
  if (!bodyElement || bodyElement.deleted || bodyElement.type !== "body") {
    return null;
  }

  const pageElements: CanvasLayoutNode[] = [];

  for (const elementId of frameElementScope.elementIds) {
    if (elementId === bodyElement.id) continue;
    const el = layoutElementById.get(elementId);
    if (!el || el.deleted || el.type === "body") continue;
    pageElements.push(el);
  }

  const frameSnapshot: ScenePageSnapshot = {
    bodyElement,
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
    bodyElement,
    depthMap: sceneSnapshot.depthMap,
    dirtyElementIds,
    elementById: layoutElementById,
    layoutVersion: sceneSnapshot.layoutVersion,
    pageElements,
    pageHeight: frameHeight,
    pageId: frameId,
    pagePositionVersion,
    pageSnapshot: frameSnapshot,
    pageWidth: frameWidth,
    panOffset,
    wasmLayoutReady,
    zoom,
  };
}

export interface SkiaRendererInput {
  childrenMap: Map<string, Element[]>;
  elements: Element[];
  elementsMap: Map<string, Element>;
  sceneChildrenByParent: Map<string, CanvasSceneNode[]>;
  sceneNodes: CanvasSceneNode[];
  sceneNodesMap: Map<string, CanvasSceneNode>;
  dirtyElementIds: Set<string>;
  editMode: "page" | "layout";
  pageIndex: PageElementIndex;
  pagePositionsVersion: number;
  pagePositions: Record<string, { x: number; y: number } | undefined>;
  pageSnapshots: Map<string, ScenePageSnapshot>;
  pages: Page[];
  sceneSnapshot: SceneStructureSnapshot;

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
  childrenMap: Map<string, Element[]>;
  elements: Element[];
  elementsMap: Map<string, Element>;
  sceneChildrenByParent?: Map<string, CanvasSceneNode[]>;
  sceneNodes?: CanvasSceneNode[];
  sceneNodesMap?: Map<string, CanvasSceneNode>;
  dirtyElementIds: Set<string>;
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

function buildLegacyCanvasSceneGraph(elements: Element[]): CanvasSceneGraph {
  const nodes: CanvasSceneNode[] = [];
  const nodesMap = new Map<string, CanvasSceneNode>();
  const childrenByParent = new Map<string, CanvasSceneNode[]>();
  const parentById = new Map<string, string>();

  for (const element of elements) {
    const node: CanvasSceneNode = {
      id: element.id,
      type: element.type,
      props: element.props ?? {},
      parentId: element.parent_id ?? null,
      pageId: element.page_id ?? null,
      layoutId:
        typeof (element as { layout_id?: unknown }).layout_id === "string"
          ? ((element as { layout_id: string }).layout_id ?? null)
          : null,
      parent_id: element.parent_id ?? null,
      page_id: element.page_id ?? null,
      deleted: element.deleted,
      ...(element.customId ? { customId: element.customId } : {}),
      ...(element.componentName ? { name: element.componentName } : {}),
      ...(element.componentName
        ? { componentName: element.componentName }
        : {}),
      sourceNode: {
        id: element.id,
        type: element.type as CanonicalNode["type"],
        props: element.props ?? {},
      },
    };

    nodes.push(node);
    nodesMap.set(node.id, node);
    if (node.parentId) {
      parentById.set(node.id, node.parentId);
      const children = childrenByParent.get(node.parentId);
      if (children) {
        children.push(node);
      } else {
        childrenByParent.set(node.parentId, [node]);
      }
    }
  }

  return {
    childrenByParent,
    nodes,
    nodesMap,
    parentById,
  };
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

function resolveCanvasSceneGraph(graph: CanvasSceneGraph): CanvasSceneGraph {
  const resolved = resolveCanonicalRefTree<CanvasSceneNode>({
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

function buildRendererChildrenMap(
  elements: Iterable<Element>,
): Map<string, Element[]> {
  const childrenMap = new Map<string, Element[]>();

  for (const element of elements) {
    if (element.deleted) continue;
    const parentId = element.parent_id ?? null;
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
  childrenMap: Map<string, Element[]>;
  elements: Element[];
  elementsMap: Map<string, Element>;
} {
  const elementsMap = new Map(input.elementsMap);
  const orderedElements: Element[] = [];
  const orderedIndexById = new Map<string, number>();

  const addElement = (element: Element): void => {
    elementsMap.set(element.id, element);
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
    addElement(elementsMap.get(element.id) ?? element);
  }

  for (const element of input.elementsMap.values()) {
    addElement(elementsMap.get(element.id) ?? element);
  }

  return {
    childrenMap: buildRendererChildrenMap(orderedElements),
    elements: orderedElements,
    elementsMap,
  };
}

export function createSkiaRendererInput(
  input: CreateSkiaRendererInputOptions,
): SkiaRendererInput {
  const renderTree = buildPageResolvedRenderTree(input);
  const resolvedTree = resolveCanonicalRefTree({
    childrenMap: renderTree.childrenMap,
    elements: renderTree.elements,
    elementsMap: renderTree.elementsMap,
  });
  const sourceSceneGraph =
    input.sceneChildrenByParent && input.sceneNodes && input.sceneNodesMap
      ? {
          childrenByParent: input.sceneChildrenByParent,
          nodes: input.sceneNodes,
          nodesMap: input.sceneNodesMap,
          parentById: buildSceneParentById(input.sceneChildrenByParent),
        }
      : buildLegacyCanvasSceneGraph(resolvedTree.elements);
  const sceneGraph = resolveCanvasSceneGraph(sourceSceneGraph);

  return {
    childrenMap: resolvedTree.childrenMap,
    elements: resolvedTree.elements,
    elementsMap: resolvedTree.elementsMap,
    sceneChildrenByParent: sceneGraph.childrenByParent,
    sceneNodes: sceneGraph.nodes,
    sceneNodesMap: sceneGraph.nodesMap,
    dirtyElementIds: input.dirtyElementIds,
    editMode: input.editMode,
    pageIndex: input.pageIndex,
    pagePositionsVersion: input.pagePositionsVersion,
    pagePositions: input.pagePositions,
    pageSnapshots: input.sceneSnapshot.pageSnapshots,
    pages: input.pages,
    sceneSnapshot: input.sceneSnapshot,
    framePositions: input.framePositions,
    framePositionsVersion: input.framePositionsVersion,
    frameAreas: input.frameAreas,
    frameElementScopes: input.frameElementScopes,
  };
}

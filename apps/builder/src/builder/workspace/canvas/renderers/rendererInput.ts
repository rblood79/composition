import type { Element, Page } from "../../../../types/core/store.types";
import type { PageElementIndex } from "../../../stores/utils/elementIndexer";
import type { ScenePageSnapshot, SceneStructureSnapshot } from "../scene";
import type { FrameAreaGroup } from "../skia/workflowEdges";
import { resolveCanonicalRefTree } from "../../../utils/canonicalRefResolution";
import type {
  CanonicalFrameElementScope,
  CanonicalFrameElementScopeMap,
} from "../../../../adapters/canonical/frameElementScope";

export interface PixiPageRendererInput {
  bodyElement: Element | null;
  depthMap: Map<string, number>;
  dirtyElementIds: Set<string>;
  elementById: Map<string, Element>;
  layoutVersion: number;
  pageElements: Element[];
  pageHeight: number;
  pageId: string;
  pagePositionVersion: number;
  pageSnapshot: ScenePageSnapshot;
  pageWidth: number;
  panOffset: { x: number; y: number };
  wasmLayoutReady: boolean;
  zoom: number;
}

interface BuildPixiPageRendererInputOptions {
  elementById: Map<string, Element>;
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

export function buildPixiPageRendererInput({
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
}: BuildPixiPageRendererInputOptions): PixiPageRendererInput | null {
  const pageSnapshot = sceneSnapshot.pageSnapshots.get(pageId);
  if (!pageSnapshot?.bodyElement) {
    return null;
  }

  return {
    bodyElement: pageSnapshot.bodyElement,
    depthMap: sceneSnapshot.depthMap,
    dirtyElementIds,
    elementById,
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
  elementById: Map<string, Element>;
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
 * ADR-111 P3-δ fix #3 (D4=A, 2026-04-28) — frame body 의 PixiPageRendererInput
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
export function buildFrameRendererInput({
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
}: BuildFrameRendererInputOptions): PixiPageRendererInput | null {
  if (!frameElementScope) return null;

  const bodyElement = frameElementScope.bodyElementId
    ? (elementById.get(frameElementScope.bodyElementId) ?? null)
    : null;
  if (!bodyElement || bodyElement.deleted || bodyElement.type !== "body") {
    return null;
  }

  const pageElements: Element[] = [];

  for (const elementId of frameElementScope.elementIds) {
    if (elementId === bodyElement.id) continue;
    const el = elementById.get(elementId);
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
    elementById,
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

function buildRendererChildrenMap(
  elementsMap: Map<string, Element>,
): Map<string, Element[]> {
  const childrenMap = new Map<string, Element[]>();

  for (const element of elementsMap.values()) {
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

  for (const list of childrenMap.values()) {
    list.sort((a, b) => (a.order_num ?? 0) - (b.order_num ?? 0));
  }

  return childrenMap;
}

function buildPageResolvedRenderTree(input: CreateSkiaRendererInputOptions): {
  childrenMap: Map<string, Element[]>;
  elements: Element[];
  elementsMap: Map<string, Element>;
} {
  const elementsMap = new Map(input.elementsMap);

  for (const pageSnapshot of input.sceneSnapshot.pageSnapshots.values()) {
    if (pageSnapshot.bodyElement) {
      elementsMap.set(pageSnapshot.bodyElement.id, pageSnapshot.bodyElement);
    }
    for (const element of pageSnapshot.pageElements) {
      elementsMap.set(element.id, element);
    }
  }

  return {
    childrenMap: buildRendererChildrenMap(elementsMap),
    elements: Array.from(elementsMap.values()),
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

  return {
    childrenMap: resolvedTree.childrenMap,
    elements: resolvedTree.elements,
    elementsMap: resolvedTree.elementsMap,
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

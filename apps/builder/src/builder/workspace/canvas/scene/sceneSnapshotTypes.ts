import type { PageElementIndex } from "../../../stores/utils/elementIndexer";
import type { Page } from "../../../../types/core/store.types";
import type { CanvasSceneNode } from "./canvasSceneNode";
import type { BoundingBox } from "../selection/types";

export type SceneInputSource = "canonical" | "legacy-bootstrap";

export interface ScenePageFrame {
  elementCount: number;
  height: number;
  id: string;
  title: string;
  width: number;
  x: number;
  y: number;
}

export interface ScenePageData {
  bodyElement: CanvasSceneNode | null;
  pageElements: CanvasSceneNode[];
}

export interface ScenePageSnapshot extends ScenePageData {
  contentVersion: number;
  frame: ScenePageFrame;
  isVisible: boolean;
  pageId: string;
  positionVersion: number;
}

export interface SceneDocumentSnapshot {
  allPageFrames: ScenePageFrame[];
  allPageFrameVersion: number;
  currentPageId: string | null;
  currentPageSnapshot: ScenePageSnapshot | null;
  pageCount: number;
  visibleContentVersion: number;
  visiblePageFrames: ScenePageFrame[];
  visiblePageIds: Set<string>;
  visiblePagePositionVersion: number;
}

export interface SelectionSnapshot {
  selectedIds: string[];
  selectionBounds: BoundingBox | null;
}

/**
 * ADR-074 Phase 2: selection-invariant 필드만 포함하는 structure snapshot.
 * selection-only 변화 시 재계산 skip 대상.
 */
export interface SceneStructureSnapshot {
  depthMap: Map<string, number>;
  document: SceneDocumentSnapshot;
  layoutVersion: number;
  pageSnapshots: Map<string, ScenePageSnapshot>;
  sceneVersion: number;
  source: SceneInputSource;
  viewportVersion: number;
}

/**
 * ADR-074 Phase 2: selection 관련 필드만 포함하는 selection state.
 */
export interface SceneSelectionState {
  selection: SelectionSnapshot;
  selectionVersion: number;
}

/**
 * SceneSnapshot 은 structure + selection 의 합성 뷰.
 * 기존 하위 consumer (skiaRendererInput, rendererInvalidationPacket, etc.) 와
 * 인터페이스 호환을 유지하기 위해 두 타입의 교차로 정의.
 */
export interface SceneSnapshot
  extends SceneStructureSnapshot, SceneSelectionState {}

/**
 * ADR-074 Phase 2: structure 계산에 필요한 입력만 포함.
 * selection 입력(selectedElementIds) 제외.
 */
export interface BuildSceneStructureInput {
  containerSize?: { height: number; width: number };
  currentPageId: string | null;
  elements: CanvasSceneNode[];
  elementsMap: Map<string, CanvasSceneNode>;
  layoutVersion: number;
  pageHeight: number;
  pageIndex: PageElementIndex;
  pagePositions: Record<string, { x: number; y: number } | undefined>;
  pagePositionsVersion: number;
  pageWidth: number;
  pages: Page[];
  panOffset: { x: number; y: number };
  source: SceneInputSource;
  zoom: number;
  /**
   * ADR-144 Wave D Phase 1 — `CompositionDocument.reusableComponents`
   * root collection 의 master node ids. 본 ids 는 가상 page 형태로
   * `pages` 옆 spatial 배치되어 pencil/Figma 패턴처럼 canvas 에 직접
   * 표시된다 (page 와 동일 multi-frame infinite canvas 메커니즘).
   *
   * 구성: caller (BuilderCanvas) 가 `doc.reusableComponents` 의 root id +
   * title (name ?? type) 만 전달. 실제 master sub-tree 는 elementsMap 에
   * 이미 포함 (canonicalElementsView 양쪽 traverse — Wave D Task 7).
   */
  reusableComponentRoots?: ReadonlyArray<{
    id: string;
    title: string;
  }>;
}

/**
 * 기존 buildSceneSnapshot 호환 — structure + selection 입력 통합.
 */
export interface BuildSceneSnapshotInput extends BuildSceneStructureInput {
  selectedElementIds: string[];
}

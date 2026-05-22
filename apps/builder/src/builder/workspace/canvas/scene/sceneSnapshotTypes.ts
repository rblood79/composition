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
}

/**
 * 기존 buildSceneSnapshot 호환 — structure + selection 입력 통합.
 */
export interface BuildSceneSnapshotInput extends BuildSceneStructureInput {
  selectedElementIds: string[];
}

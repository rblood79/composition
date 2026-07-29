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

/**
 * ADR-172 Phase 3 — `isVisible` 은 없다.
 *
 * 카메라 의존 필드가 여기 있으면 `pageSnapshots` 전체가 카메라에 묶여 팬
 * 프레임마다 재구성된다. 소비자 전수 확인 결과 읽는 곳이 0건이라 계약에서
 * 제거했다 (4-1-a). 가시성 판정이 필요하면 `document.visiblePageIds.has(id)`
 * 로 조회할 것 — 그쪽이 카메라 축의 정본이다.
 */
export interface ScenePageSnapshot extends ScenePageData {
  contentVersion: number;
  frame: ScenePageFrame;
  pageId: string;
  positionVersion: number;
}

/** ADR-172 Phase 3: 카메라와 무관한 document 필드. */
export interface SceneDocumentCore {
  allPageFrames: ScenePageFrame[];
  allPageFrameVersion: number;
  currentPageId: string | null;
  currentPageSnapshot: ScenePageSnapshot | null;
  pageCount: number;
}

export interface SceneDocumentSnapshot extends SceneDocumentCore {
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
 * ADR-172 Phase 3: structure snapshot 의 **카메라 무관** 부분.
 *
 * 팬/줌 프레임에서 이 identity 가 유지되어야 하류(`layoutPublisherInputs` →
 * `layoutInputKey`)의 memo 가 hit 한다. 카메라를 쓰는 값은 하나도 없다.
 */
export interface SceneStructureCore {
  depthMap: Map<string, number>;
  document: SceneDocumentCore;
  layoutVersion: number;
  pageSnapshots: Map<string, ScenePageSnapshot>;
  /**
   * `sceneVersion` 해싱의 카메라 무관 접두. visibility 단계가 뒤에
   * visible\* 2종 + projection signature 를 붙여 최종 해시를 만든다 —
   * 입력 순서는 ADR-136 signature 계약 그대로다.
   */
  sceneVersionPrefix: string;
  projectionContentSignature: number;
  source: SceneInputSource;
}

/** ADR-172 Phase 3: 카메라 의존 산출물 + 그 identity 판정 키. */
export interface SceneVisibilityResult {
  /**
   * visible set 이 불변이면 같은 문자열이 나온다. 호출측은 이 키로 합성
   * 결과를 캐시해 팬 프레임의 snapshot identity 를 유지한다 (CRITICAL —
   * 매 프레임 새 객체를 만들면 Phase 1·2 의 이득이 전부 사라진다).
   */
  key: string;
  visibleContentVersion: number;
  visiblePageFrames: ScenePageFrame[];
  visiblePageIds: Set<string>;
  visiblePagePositionVersion: number;
}

/**
 * ADR-074 Phase 2: selection-invariant 필드만 포함하는 structure snapshot.
 * selection-only 변화 시 재계산 skip 대상.
 *
 * ADR-172 Phase 3: `viewportVersion`(카메라 직접 해싱) 제거 — 소비자 0건인
 * 잔재였고, 남겨두면 팬 프레임마다 snapshot identity 가 깨진다. 카메라 값이
 * 필요한 소비자는 viewport store 를 직접 구독할 것.
 */
export interface SceneStructureSnapshot {
  depthMap: Map<string, number>;
  document: SceneDocumentSnapshot;
  layoutVersion: number;
  pageSnapshots: Map<string, ScenePageSnapshot>;
  sceneVersion: number;
  source: SceneInputSource;
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

/** ADR-172 Phase 3: 카메라 인자를 **받지 않는** core 입력. */
export interface BuildSceneStructureCoreInput {
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
  /**
   * ADR-916 2-C 안 A: projection content signature 를 호출측이 pan/zoom 독립
   * useMemo 로 미리 계산해 주입. 주입 시 전체 `createResolvedProjectionSignature`
   * (전체 elements stableSerialize) 를 skip. 미주입이면 내부 계산(하위 호환).
   */
  precomputedProjectionSignature?: number;
  source: SceneInputSource;
}

/** ADR-172 Phase 3: visibility 단계가 받는 카메라 인자. */
export interface SceneVisibilityCamera {
  containerSize?: { height: number; width: number };
  panOffset: { x: number; y: number };
  zoom: number;
}

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
  /**
   * ADR-916 2-C 안 A: projection content signature 를 호출측이 pan/zoom 독립
   * useMemo 로 미리 계산해 주입. 주입 시 `buildSceneStructureSnapshot` 내부의
   * 전체 `createResolvedProjectionSignature`(전체 elements stableSerialize) 를
   * skip — pan/zoom-only 변경 시 재직렬화 회피. 미주입이면 내부 계산(하위 호환).
   */
  precomputedProjectionSignature?: number;
  source: SceneInputSource;
  zoom: number;
}

/**
 * 기존 buildSceneSnapshot 호환 — structure + selection 입력 통합.
 */
export interface BuildSceneSnapshotInput extends BuildSceneStructureInput {
  selectedElementIds: string[];
}

import type { CanvasSceneNode } from "./canvasSceneNode";
import {
  buildPageDataMap,
  buildDepthMap,
  buildPageFrames,
} from "./buildSceneIndex";
import { buildSelectionSnapshot } from "./buildSelectionSnapshot";
import { buildVisiblePageSet } from "./buildVisiblePageSet";
import type {
  BuildSceneSnapshotInput,
  BuildSceneStructureInput,
  ScenePageSnapshot,
  SceneSelectionState,
  SceneSnapshot,
  SceneStructureSnapshot,
} from "./sceneSnapshotTypes";

interface BuildSceneSelectionInput {
  currentPageId: string | null;
  elementsMap: Map<string, CanvasSceneNode>;
  selectedElementIds: string[];
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

/**
 * ADR-074 Phase 2: selection-invariant structure snapshot.
 *
 * depthMap / pageDataMap / pageFrames / visiblePages / pageSnapshots /
 * document 전부 포함. selection 과 독립 계산되어 selection-only 변화 시
 * useMemo identity 유지가 가능.
 */
export function buildSceneStructureSnapshot(
  input: BuildSceneStructureInput,
): SceneStructureSnapshot {
  const depthMap = buildDepthMap(input.elements, input.elementsMap);
  const pageDataMap = buildPageDataMap(
    input.pages,
    input.pageIndex,
    input.elementsMap,
  );
  const allPageFrames = buildPageFrames(
    input.pages,
    input.pageIndex,
    input.elementsMap,
    input.pagePositions,
    input.pageWidth,
    input.pageHeight,
  );
  const visiblePageIds = buildVisiblePageSet({
    containerSize: input.containerSize,
    pageFrames: allPageFrames,
    panOffset: input.panOffset,
    zoom: input.zoom,
  });
  const visiblePageFrames = allPageFrames.filter((frame) =>
    visiblePageIds.has(frame.id),
  );
  const pageFrameMap = new Map(
    allPageFrames.map((frame) => [frame.id, frame] as const),
  );
  const allPageFrameVersion = hashString(
    allPageFrames
      .map(
        (frame) =>
          `${frame.id}:${frame.title}:${frame.x}:${frame.y}:${frame.width}:${frame.height}`,
      )
      .join("|"),
  );
  const pageSnapshots = new Map<string, ScenePageSnapshot>();

  for (const page of input.pages) {
    const pageData = pageDataMap.get(page.id) ?? {
      bodyElement: null,
      pageElements: [],
    };
    const frame = pageFrameMap.get(page.id) ?? {
      elementCount: 0,
      height: input.pageHeight,
      id: page.id,
      title: page.title,
      width: input.pageWidth,
      x: 0,
      y: 0,
    };
    const pageElementIds = pageData.pageElements.map((element) => element.id);
    const contentVersion = hashString(
      [
        page.id,
        pageData.bodyElement?.id ?? "no-body",
        pageElementIds.join("|"),
        input.layoutVersion,
      ].join(":"),
    );
    const positionVersion = hashString(
      [page.id, frame.x, frame.y, frame.width, frame.height].join(":"),
    );

    pageSnapshots.set(page.id, {
      ...pageData,
      contentVersion,
      frame,
      isVisible: visiblePageIds.has(page.id),
      pageId: page.id,
      positionVersion,
    });
  }

  const currentPageSnapshot = input.currentPageId
    ? (pageSnapshots.get(input.currentPageId) ?? null)
    : null;
  const visibleContentVersion = hashString(
    visiblePageFrames
      .map((frame) => {
        const pageSnapshot = pageSnapshots.get(frame.id);
        return `${frame.id}:${pageSnapshot?.contentVersion ?? 0}`;
      })
      .join(":"),
  );
  const visiblePagePositionVersion = hashString(
    visiblePageFrames
      .map((frame) => {
        const pageSnapshot = pageSnapshots.get(frame.id);
        return `${frame.id}:${pageSnapshot?.positionVersion ?? 0}`;
      })
      .join(":"),
  );

  return {
    depthMap,
    document: {
      allPageFrames,
      allPageFrameVersion,
      currentPageId: input.currentPageId,
      currentPageSnapshot,
      pageCount: input.pages.length,
      visibleContentVersion,
      visiblePageFrames,
      visiblePageIds,
      visiblePagePositionVersion,
    },
    layoutVersion: input.layoutVersion,
    pageSnapshots,
    sceneVersion: hashString(
      [
        input.layoutVersion,
        input.pagePositionsVersion,
        input.elements.length,
        input.pages.length,
        visibleContentVersion,
        visiblePagePositionVersion,
      ].join(":"),
    ),
    source: input.source,
    viewportVersion: hashString(
      [
        input.zoom,
        input.panOffset.x,
        input.panOffset.y,
        input.containerSize?.width ?? 0,
        input.containerSize?.height ?? 0,
      ].join(":"),
    ),
  };
}

/**
 * ADR-074 Phase 2: selection-only state (selection + selectionVersion).
 * selectedElementIds 변화 시에만 재계산 대상.
 */
export function buildSceneSelectionState(
  input: BuildSceneSelectionInput,
): SceneSelectionState {
  const selection = buildSelectionSnapshot({
    currentPageId: input.currentPageId,
    elementsMap: input.elementsMap,
    selectedElementIds: input.selectedElementIds,
  });
  return {
    selection,
    selectionVersion: hashString(selection.selectedIds.join("|")),
  };
}

/**
 * 기존 호출처 호환용 합성 entry point.
 * structure + selection 을 각각 계산한 뒤 합쳐서 반환.
 */
export function buildSceneSnapshot(
  input: BuildSceneSnapshotInput,
): SceneSnapshot {
  const structure = buildSceneStructureSnapshot(input);
  const selectionState = buildSceneSelectionState({
    currentPageId: input.currentPageId,
    elementsMap: input.elementsMap,
    selectedElementIds: input.selectedElementIds,
  });
  return {
    ...structure,
    ...selectionState,
  };
}

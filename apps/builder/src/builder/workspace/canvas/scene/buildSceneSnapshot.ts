import type { Page } from "../../../../types/builder/unified.types";
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

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
    .join(",")}}`;
}

function createNodeProjectionSignature(node: CanvasSceneNode | null) {
  if (!node) return null;
  return {
    deleted: node.deleted === true,
    id: node.id,
    layoutId: node.layoutId ?? node.layout_id ?? null,
    pageId: node.pageId ?? node.page_id ?? null,
    parentId: node.parentId ?? node.parent_id ?? null,
    projection: node.projection ?? null,
    props: node.props ?? {},
    ref: node.ref ?? null,
    reusable: node.reusable === true,
    type: node.type,
  };
}

function createResolvedProjectionSignature(input: {
  elements: CanvasSceneNode[];
  pageSnapshots: Map<string, ScenePageSnapshot>;
}): number {
  return hashString(
    stableSerialize({
      rawSceneNodes: input.elements.map(createNodeProjectionSignature),
      resolvedPages: Array.from(input.pageSnapshots.entries()).map(
        ([pageId, snapshot]) => ({
          bodyElement: createNodeProjectionSignature(snapshot.bodyElement),
          pageElements: snapshot.pageElements.map(
            createNodeProjectionSignature,
          ),
          pageId,
        }),
      ),
    }),
  );
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
  // ADR-144 Wave D Phase 1 — reusableComponentRoots 를 가상 page 로 변환하여
  // page 와 동일 multi-frame infinite canvas 메커니즘 통해 canvas spatial
  // 표시. pencil/Figma 패턴. 좌표 자동 할당 = page 바로 옆 (viewport 안).
  const MASTER_PAGE_GAP = 80;
  const reusableRoots = input.reusableComponentRoots ?? [];
  const pageCount = input.pages.length;
  // Phase 1.5: baseOffsetX 를 page 바로 옆으로 (이전 (pageCount+1)*... 는
  // viewport 밖이라 buildVisiblePageSet 가 invisible 판정 → render skip).
  const baseOffsetX =
    pageCount > 0
      ? pageCount * (input.pageWidth + MASTER_PAGE_GAP)
      : MASTER_PAGE_GAP;
  const virtualMasterPages: Page[] = reusableRoots.map((root, index) => ({
    id: root.id,
    title: root.title,
    project_id: "",
    slug: `/__reusable_${root.id}`,
    parent_id: null,
  }));
  const masterPagePositions: Record<
    string,
    { x: number; y: number } | undefined
  > = {};
  reusableRoots.forEach((root, index) => {
    if (input.pagePositions[root.id]) return; // 사용자 명시 좌표 우선
    masterPagePositions[root.id] = {
      x: baseOffsetX + index * (input.pageWidth + MASTER_PAGE_GAP),
      y: 0,
    };
  });
  const mergedPages: Page[] = [...input.pages, ...virtualMasterPages];
  const mergedPagePositions = {
    ...input.pagePositions,
    ...masterPagePositions,
  };

  const depthMap = buildDepthMap(input.elements, input.elementsMap);
  const pageDataMap = buildPageDataMap(
    mergedPages,
    input.pageIndex,
    input.elementsMap,
  );
  const allPageFrames = buildPageFrames(
    mergedPages,
    input.pageIndex,
    input.elementsMap,
    mergedPagePositions,
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

  for (const page of mergedPages) {
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
  const projectionContentSignature = createResolvedProjectionSignature({
    elements: input.elements,
    pageSnapshots,
  });

  return {
    depthMap,
    document: {
      allPageFrames,
      allPageFrameVersion,
      currentPageId: input.currentPageId,
      currentPageSnapshot,
      pageCount: mergedPages.length,
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
        mergedPages.length,
        visibleContentVersion,
        visiblePagePositionVersion,
        projectionContentSignature,
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

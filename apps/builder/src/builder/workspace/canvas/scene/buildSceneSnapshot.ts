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
  ScenePageData,
  ScenePageSnapshot,
  SceneSelectionState,
  SceneSnapshot,
  SceneStructureSnapshot,
} from "./sceneSnapshotTypes";
import { recordEditorPresentationProjectionSignature } from "../../../performance/editorPresentationPhase0Metrics";

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

function stableSerialize(
  value: unknown,
  serialized: WeakMap<object, string>,
): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  const cached = serialized.get(value);
  if (cached !== undefined) return cached;

  const result = Array.isArray(value)
    ? `[${value.map((item) => stableSerialize(item, serialized)).join(",")}]`
    : `{${Object.keys(value)
        .sort()
        .map(
          (key) =>
            `${JSON.stringify(key)}:${stableSerialize((value as Record<string, unknown>)[key], serialized)}`,
        )
        .join(",")}}`;
  serialized.set(value, result);
  return result;
}

function createNodeProjectionSignature(node: CanvasSceneNode | null) {
  if (!node) return null;
  return {
    deleted: node.deleted === true,
    // fills 는 top-level 시각 필드 (props 밖) — ADR-136 projection-relevant field
    // 추가 규칙에 따라 signature 입력에 동시 등재 (누락 시 fills-only 변경이
    // same-count phantom change 로 미감지).
    fills: node.fills ?? null,
    id: node.id,
    layoutId: node.layoutId ?? null,
    pageId: node.pageId ?? node.page_id ?? null,
    parentId: node.parentId ?? node.parent_id ?? null,
    projection: node.projection ?? null,
    props: node.props ?? {},
    ref: node.ref ?? null,
    reusable: node.reusable === true,
    type: node.type,
  };
}

/**
 * projection content signature — sceneVersion 의 핵심 입력.
 *
 * **ADR-916 2-C 재평가 (2026-07-05)**: 벤치상 `buildSceneStructureSnapshot`
 * 프레임타임 비용의 대부분이 본 함수(전체 elements `stableSerialize` +
 * `hashString`) 에서 발생. 입력은 `elements`(sceneNodes) + `pageSnapshots` 의
 * node 참조뿐 — **pan/zoom/containerSize 와 독립**. 향후 최소 수정안은 본
 * 계산을 pan/zoom deps 에서 분리(별도 useMemo)하거나 증분 hash 로 대체한다.
 * 재평가 벤치(`sceneDirtyDetection.bench.ts`)가 본 export 를 소비.
 */
export function createResolvedProjectionSignature(input: {
  elements: CanvasSceneNode[];
  // ScenePageData(bodyElement/pageElements) 만 참조 — ScenePageSnapshot 도
  // extends ScenePageData 이므로 기존 pageSnapshots 호출과 호환. 안 A(별도
  // useMemo)는 전체 snapshot 없이 pageDataMap(ScenePageData) 으로 호출.
  pageSnapshots: Map<string, ScenePageData>;
}): number {
  const startedAt = performance.now();
  // raw/resolved 페이지가 공유하는 props는 이 호출 안에서만 직렬화를 재사용한다.
  // 다음 호출은 새 캐시로 시작해 동일 객체 내부 편집도 감지한다.
  const signature = hashString(
    stableSerialize(
      {
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
      },
      new WeakMap(),
    ),
  );
  recordEditorPresentationProjectionSignature(performance.now() - startedAt);
  return signature;
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
  const calculatedVisiblePageIds = buildVisiblePageSet({
    containerSize: input.containerSize,
    pageFrames: allPageFrames,
    panOffset: input.panOffset,
    zoom: input.zoom,
  });
  const visiblePageIds = input.visiblePageIdsOverride
    ? new Set(
        allPageFrames
          .filter((frame) => input.visiblePageIdsOverride?.has(frame.id))
          .map((frame) => frame.id),
      )
    : calculatedVisiblePageIds;
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
  // ADR-916 2-C 안 A: 호출측(BuilderCanvas)이 pan/zoom 독립 useMemo 로 미리
  // 계산해 주입하면 전체 재직렬화 skip. 미주입(기존 호출·테스트)이면 내부 계산.
  const projectionContentSignature =
    input.precomputedProjectionSignature ??
    createResolvedProjectionSignature({
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

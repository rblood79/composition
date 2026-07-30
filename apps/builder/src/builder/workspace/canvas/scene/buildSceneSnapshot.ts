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
  BuildSceneStructureCoreInput,
  BuildSceneStructureInput,
  ScenePageData,
  ScenePageSnapshot,
  SceneSelectionState,
  SceneSnapshot,
  SceneStructureCore,
  SceneStructureSnapshot,
  SceneVisibilityCamera,
  SceneVisibilityResult,
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
 * ADR-074 Phase 2: selection-invariant structure.
 * ADR-172 Phase 3: **카메라 무관** 부분만 담당 — 카메라 인자를 받지 않는다.
 *
 * depthMap / pageDataMap / pageFrames / pageSnapshots / document core 를
 * 계산한다. 팬/줌 프레임에서 이 결과의 identity 가 유지되는 것이 하류
 * memo(`layoutPublisherInputs` → `layoutInputKey`) hit 의 전제다.
 *
 * 카메라를 쓰는 값(visible\*)은 `resolveSceneVisibility` 소관이며, 여기에
 * 카메라 인자를 다시 들이지 말 것 — 그 순간 전체가 팬마다 재계산된다.
 */
export function buildSceneStructureCore(
  input: BuildSceneStructureCoreInput,
): SceneStructureCore {
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
      pageId: page.id,
      positionVersion,
    });
  }

  const currentPageSnapshot = input.currentPageId
    ? (pageSnapshots.get(input.currentPageId) ?? null)
    : null;
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
    },
    layoutVersion: input.layoutVersion,
    pageSnapshots,
    projectionContentSignature,
    // ADR-136 signature 계약: 입력 순서 유지 (layoutVersion :
    // pagePositionsVersion : elementCount : pageCount : visibleContentVersion :
    // visiblePagePositionVersion : projectionContentSignature).
    sceneVersionPrefix: [
      input.layoutVersion,
      input.pagePositionsVersion,
      input.elements.length,
      input.pages.length,
    ].join(":"),
    source: input.source,
  };
}

/**
 * ADR-172 Phase 3: 카메라 의존 산출물 — core 대비 O(페이지) 로 싸다.
 *
 * `key` 는 visible set 이 불변인 팬 프레임을 식별한다. 호출측은 이 키로
 * `composeSceneStructureSnapshot` 결과를 캐시해 snapshot identity 를 유지해야
 * 한다 (`BuilderCanvas` 의 `sceneStructureCacheRef` 참조).
 */
export function resolveSceneVisibility(
  core: SceneStructureCore,
  camera: SceneVisibilityCamera,
): SceneVisibilityResult {
  const allPageFrames = core.document.allPageFrames;
  const visiblePageIds = buildVisiblePageSet({
    containerSize: camera.containerSize,
    pageFrames: allPageFrames,
    panOffset: camera.panOffset,
    zoom: camera.zoom,
  });
  const visiblePageFrames = allPageFrames.filter((frame) =>
    visiblePageIds.has(frame.id),
  );
  const visibleContentVersion = hashString(
    visiblePageFrames
      .map((frame) => {
        const pageSnapshot = core.pageSnapshots.get(frame.id);
        return `${frame.id}:${pageSnapshot?.contentVersion ?? 0}`;
      })
      .join(":"),
  );
  const visiblePagePositionVersion = hashString(
    visiblePageFrames
      .map((frame) => {
        const pageSnapshot = core.pageSnapshots.get(frame.id);
        return `${frame.id}:${pageSnapshot?.positionVersion ?? 0}`;
      })
      .join(":"),
  );

  return {
    key: `${visiblePageFrames.map((frame) => frame.id).join("|")}:${visibleContentVersion}:${visiblePagePositionVersion}`,
    visibleContentVersion,
    visiblePageFrames,
    visiblePageIds,
    visiblePagePositionVersion,
  };
}

/** ADR-172 Phase 3: core + visibility 합성 — 순수 조립, 계산 없음. */
export function composeSceneStructureSnapshot(
  core: SceneStructureCore,
  visibility: SceneVisibilityResult,
): SceneStructureSnapshot {
  return {
    depthMap: core.depthMap,
    document: {
      ...core.document,
      visibleContentVersion: visibility.visibleContentVersion,
      visiblePageFrames: visibility.visiblePageFrames,
      visiblePageIds: visibility.visiblePageIds,
      visiblePagePositionVersion: visibility.visiblePagePositionVersion,
    },
    layoutVersion: core.layoutVersion,
    pageSnapshots: core.pageSnapshots,
    sceneVersion: hashString(
      [
        core.sceneVersionPrefix,
        visibility.visibleContentVersion,
        visibility.visiblePagePositionVersion,
        core.projectionContentSignature,
      ].join(":"),
    ),
    source: core.source,
  };
}

/**
 * 기존 호출처(테스트·벤치) 호환용 합성 entry point — core → visibility →
 * compose 를 한 번에 수행한다. **라이브 렌더 경로에서는 쓰지 말 것**:
 * 카메라가 core 계산에 다시 묶여 팬 프레임마다 전체가 재계산된다
 * (`BuilderCanvas` 는 세 단계를 별도 useMemo 로 분리해 호출한다).
 */
export function buildSceneStructureSnapshot(
  input: BuildSceneStructureInput,
): SceneStructureSnapshot {
  const core = buildSceneStructureCore(input);
  const visibility = resolveSceneVisibility(core, {
    containerSize: input.containerSize,
    panOffset: input.panOffset,
    zoom: input.zoom,
  });
  return composeSceneStructureSnapshot(core, visibility);
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

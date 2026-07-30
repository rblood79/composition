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

type ProjectionDescriptor = NonNullable<
  ReturnType<typeof createNodeProjectionSignature>
>;

interface NodeSignatureEntry {
  descriptor: ProjectionDescriptor;
  serialized: string;
}

/**
 * 노드별 직렬화 캐시 — 키는 **canonical 원본(`sourceNode`)**.
 *
 * scene node 자체는 편집마다 전량 새 객체(실측 0/201)라 키가 못 된다. 원본은
 * 199/201 유지된다(`signatureCacheKey.test.ts`). 한 원본을 여러 scene node 가
 * 공유할 수 있어(collection projection) 안쪽을 id 별 Map 으로 둔다 — 1:1 이면
 * 엔트리 하나다.
 */
const nodeSignatureCache = new WeakMap<
  object,
  Map<string, NodeSignatureEntry>
>();

/**
 * 적중 카운터 — **모듈 로컬**.
 *
 * `skia/cacheMetrics` 의 공용 채널을 쓰지 않는다: 본 모듈은 씬 파이프라인의
 * 핵심이라 node 환경 테스트에서 그대로 로드되는데, 그 import 하나가 모듈 그래프를
 * 넓혀 `@/` alias 해석이 깨진다(실측 30 파일 FAIL). 의존을 늘리는 대신 숫자 둘만
 * 들고, 적중 자체는 `projectionSignatureCache.test.ts` 가 작업량으로 단언한다.
 */
let signatureCacheHits = 0;
let signatureCacheMisses = 0;

/** 테스트 전용 — 캐시가 실제로 히트하는지 확인한다 (적중률이 유일한 조기 신호) */
export function readProjectionSignatureCacheStats(): {
  hits: number;
  misses: number;
} {
  return { hits: signatureCacheHits, misses: signatureCacheMisses };
}

/**
 * 캐시 적중 판정 — **얕은 비교**.
 *
 * `props` 는 scene 변환이 매번 새 객체로 만들지만(실측 0/201) 그 **키 집합과 값
 * identity 는 200/201 유지**된다. 그래서 한 단계만 얕게 비교하면 재귀
 * `stableSerialize` 를 건너뛸 수 있다 — 비싼 쪽은 순회가 아니라 직렬화다.
 *
 * 비교 대상을 필드 이름으로 나열하지 않고 `createNodeProjectionSignature` 가
 * 만든 descriptor 를 통째로 훑는다. 그래야 **시그니처 입력 필드가 늘어도 검증이
 * 자동으로 따라온다** — 나열식이면 ADR-136 의 projection-relevant field 추가
 * 규칙을 여기서 한 번 더 지켜야 하고, 놓치면 캐시가 stale 값을 돌려준다.
 */
function isProjectionDescriptorEqual(
  a: ProjectionDescriptor,
  b: ProjectionDescriptor,
): boolean {
  for (const key of Object.keys(a) as (keyof ProjectionDescriptor)[]) {
    if (key === "props") continue;
    if (a[key] !== b[key]) return false;
  }

  const prevProps = a.props as Record<string, unknown>;
  const nextProps = b.props as Record<string, unknown>;
  if (prevProps === nextProps) return true;
  const prevKeys = Object.keys(prevProps);
  if (prevKeys.length !== Object.keys(nextProps).length) return false;
  for (const key of prevKeys) {
    if (prevProps[key] !== nextProps[key]) return false;
  }
  return true;
}

function serializeNodeProjection(node: CanvasSceneNode | null): string {
  const descriptor = createNodeProjectionSignature(node);
  if (!descriptor) return "null";

  // descriptor 조립은 필드 11개 복사라 싸다. 캐시가 막는 것은 그 다음의 재귀
  // 직렬화(`Object.keys().sort()` + `JSON.stringify` 중첩)다.
  const cacheKey = (node?.sourceNode ?? node) as object | undefined;
  if (!cacheKey) return stableSerialize(descriptor);

  let byId = nodeSignatureCache.get(cacheKey);
  const cached = byId?.get(descriptor.id);
  if (cached && isProjectionDescriptorEqual(cached.descriptor, descriptor)) {
    signatureCacheHits += 1;
    return cached.serialized;
  }
  signatureCacheMisses += 1;

  const serialized = stableSerialize(descriptor);
  if (!byId) {
    byId = new Map();
    nodeSignatureCache.set(cacheKey, byId);
  }
  byId.set(descriptor.id, { descriptor, serialized });
  return serialized;
}

/**
 * projection content signature — sceneVersion 의 핵심 입력.
 *
 * **ADR-916 2-C 재평가 (2026-07-05)**: 벤치상 `buildSceneStructureSnapshot`
 * 프레임타임 비용의 대부분이 본 함수(전체 elements `stableSerialize` +
 * `hashString`) 에서 발생. 입력은 `elements`(sceneNodes) + `pageSnapshots` 의
 * node 참조뿐 — **pan/zoom/containerSize 와 독립**. 재평가 벤치
 * (`sceneDirtyDetection.bench.ts`)가 본 export 를 소비.
 *
 * **2026-07-30**: 편집 프레임 실측에서 편집 1회당 2회 × 17.3ms 로 파생 memo 중
 * 최대였다. 전체를 한 덩어리로 직렬화하던 것을 **노드별 문자열 + 이어붙이기**로
 * 바꿔 미변경 노드의 직렬화를 캐시가 흡수한다. 결과 해시의 절대값은 달라지지만
 * 이 값은 변경 감지용이라 무해하다 — 같은 입력에 같은 값, 다른 입력에 다른 값이면
 * 되고, 형식이 바뀐 첫 프레임에만 miss 가 한 번 난다.
 */
export function createResolvedProjectionSignature(input: {
  elements: CanvasSceneNode[];
  // ScenePageData(bodyElement/pageElements) 만 참조 — ScenePageSnapshot 도
  // extends ScenePageData 이므로 기존 pageSnapshots 호출과 호환. 안 A(별도
  // useMemo)는 전체 snapshot 없이 pageDataMap(ScenePageData) 으로 호출.
  pageSnapshots: Map<string, ScenePageData>;
}): number {
  const parts: string[] = [];
  for (const node of input.elements) {
    parts.push(serializeNodeProjection(node));
  }
  parts.push("::pages::");
  for (const [pageId, snapshot] of input.pageSnapshots) {
    parts.push(pageId);
    parts.push(serializeNodeProjection(snapshot.bodyElement));
    for (const element of snapshot.pageElements) {
      parts.push(serializeNodeProjection(element));
    }
  }
  return hashString(parts.join(","));
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

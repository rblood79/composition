// PixiJS Container 대체 (Phase 9: PixiJS 제거)
type Container = {
  label?: string;
  parent?: Container | null;
  visible: boolean;
  position?: { x: number; y: number };
};
import {
  calculateCombinedBounds,
  hitTestHandle,
  hitTestSelectionBounds,
  type BoundingBox,
  type HandleConfig,
} from "../selection/types";
import {
  findBodySelectionAtCanvasPoint,
  findTopPageIdAtCanvasPoint,
  pickTopmostHitElementId,
  type BodySelectionResult,
  type CanvasPoint,
  type FrameBodySelectionArea,
  type TopPageAtPointOptions,
} from "../selection/selectionHitTest";
import { getViewportController } from "../viewport/ViewportController";
import { getFrameElementMirrorId } from "../../../../adapters/canonical/frameMirror";
import { resolveClickTarget } from "../../../utils/hierarchicalSelection";
import type { CanvasInteractionNode } from "./interactionNode";
import {
  getPagePositionPresentationSnapshot,
  readPagePosition,
} from "./pagePositionPresentation";

interface ResolveSelectedElementsForPageInput {
  currentPageId: string | null;
  elementsMap: ReadonlyMap<string, CanvasInteractionNode>;
  selectedElementIds: string[];
}

interface ComputeSelectionBoundsOptions {
  frameAreas?: FrameBodySelectionArea[];
  getBounds?: (elementId: string) => BoundingBox | null | undefined;
  getContainer?: (elementId: string) => Container | undefined;
  getCurrentZoom?: () => number | undefined;
  pageHeight: number;
  pagePositions?: Record<string, { x: number; y: number } | undefined>;
  pagePositionReader?: (pageId: string) => { x: number; y: number } | undefined;
  pageWidth: number;
  selectedElements: CanvasInteractionNode[];
  zoom?: number;
}

interface ResolveSelectionHitResult {
  hitHandle: HandleConfig | null;
  inSelectionBounds: boolean;
}

function getCameraLocalPosition(
  container: Container,
): { x: number; y: number } | null {
  let x = 0;
  let y = 0;
  let node: Container | null = container;

  while (node) {
    if (node.label === "Camera") {
      return { x, y };
    }
    x += node.position?.x ?? 0;
    y += node.position?.y ?? 0;
    node = node.parent as Container | null;
  }

  return null;
}

function resolveCurrentZoom({
  getCurrentZoom,
  zoom,
}: Pick<ComputeSelectionBoundsOptions, "getCurrentZoom" | "zoom">): number {
  const viewportZoom =
    getCurrentZoom?.() ?? getViewportController().getState().scale;

  if (typeof viewportZoom === "number" && viewportZoom > 0) {
    return viewportZoom;
  }

  if (typeof zoom === "number" && zoom > 0) {
    return zoom;
  }

  return 1;
}

export function resolveSelectedElementsForPage({
  currentPageId,
  elementsMap,
  selectedElementIds,
}: ResolveSelectedElementsForPageInput): CanvasInteractionNode[] {
  if (selectedElementIds.length === 0) {
    return [];
  }

  const resolved: CanvasInteractionNode[] = [];
  for (const id of selectedElementIds) {
    const element = elementsMap.get(id);
    if (!element) continue;
    // Scene projection은 canonical snake_case를 우선하지만, interaction node는
    // compatibility camelCase도 함께 보장한다. selection hit-test가 한 쪽만 읽으면
    // Page body outline이 누락되어 page-position drag 진입점도 사라진다.
    const elementPageId = element.page_id ?? element.pageId;
    if (currentPageId !== null && elementPageId === currentPageId) {
      resolved.push(element);
      continue;
    }
    if (element.page_id == null && getFrameElementMirrorId(element)) {
      resolved.push(element);
    }
  }

  return resolved;
}

export function computeSelectionBounds({
  frameAreas = [],
  getBounds,
  getContainer,
  getCurrentZoom,
  pageHeight,
  pagePositions,
  pagePositionReader,
  pageWidth,
  selectedElements,
  zoom = 1,
}: ComputeSelectionBoundsOptions): BoundingBox | null {
  if (selectedElements.length === 0) {
    return null;
  }

  const currentZoom = resolveCurrentZoom({ getCurrentZoom, zoom });
  const boxes: BoundingBox[] = [];

  for (const element of selectedElements) {
    if (element.type.toLowerCase() === "body") {
      const frameId =
        element.page_id == null ? getFrameElementMirrorId(element) : null;
      const frameArea = frameId
        ? frameAreas.find((area) => area.frameId === frameId)
        : undefined;
      const position = element.page_id
        ? (pagePositionReader?.(element.page_id) ??
          pagePositions?.[element.page_id])
        : undefined;
      boxes.push({
        x: frameArea?.x ?? position?.x ?? 0,
        y: frameArea?.y ?? position?.y ?? 0,
        width: frameArea?.width ?? pageWidth,
        height: frameArea?.height ?? pageHeight,
      });
      continue;
    }

    const container = getContainer?.(element.id);
    if (container) {
      const localPosition = getCameraLocalPosition(container);
      if (localPosition) {
        const bounds = getBounds?.(element.id);
        boxes.push({
          x: localPosition.x,
          y: localPosition.y,
          width: (bounds?.width ?? 100) / currentZoom,
          height: (bounds?.height ?? 40) / currentZoom,
        });
        continue;
      }
    }

    const bounds = getBounds?.(element.id);
    if (bounds) {
      // scene 좌표 그대로 사용 — pan/zoom 보정 금지.
      //   `getBounds`(=getElementBoundsSimple)는 이미 scene 좌표를 반환하고, 히트 판정
      //   상대인 canvasPos 도 screenToCanvasPoint 결과라 같은 좌표계다. 여기서 panOffset 을
      //   빼거나 zoom 으로 나누면 선택 박스가 유령 위치로 이동해, 엉뚱한 좌표의 클릭이
      //   `inSelectionBounds` 로 판정돼 선택이 통째로 무시된다 (2026-07-24 실측: scene
      //   20,104 350x84 → -195,-124 로 panOffset(215,228) 만큼 이탈). 바로 위 body 분기가
      //   raw scene 좌표를 쓰는 것과도 일치한다. PixiJS `getBounds()`가 screen 좌표를
      //   반환하던 시절의 잔재였다.
      boxes.push(bounds);
      continue;
    }

    boxes.push({ x: 0, y: 0, width: 100, height: 40 });
  }

  return calculateCombinedBounds(boxes);
}

interface ResolveSelectionDragIntentInput {
  editingContextId: string | null;
  elementsMap: ReadonlyMap<string, CanvasInteractionNode>;
  hitElementId: string | null;
  selectedIds: readonly string[];
}

/**
 * pointerdown 을 "현재 선택을 잡아 끄는 동작" 으로 볼지 판정한다.
 *
 * 판정 기준은 선택 박스(bbox) 가 아니라 **클릭 타깃의 계층 정규화 결과**다. 커서 아래
 * 요소를 현재 editingContext 깊이로 정규화(`resolveClickTarget`)한 결과가 지금 선택된
 * 요소면 드래그, 아니면 그 요소를 새로 선택하도록 흘려보낸다.
 *
 * **Why**: bbox 로 판정하면 선택 요소의 박스에 겹쳐 있을 뿐인 **다른 요소** 를 클릭해도
 * 드래그 의도로 먹혀서 선택이 통째로 무시된다 (2026-07-24 실측: `component-gridlist`
 * 선택 상태에서 그 박스 안으로 들어온 `component-form` 입력 클릭이 무반응). Figma /
 * Pencil 은 둘 다 실제 객체 지오메트리로 판정해 그 객체를 선택한다 (Pencil 실측 확인:
 * 파랑 선택 → 파랑 bbox 안의 주황 클릭 → 주황 선택). 깊이 진입은 더블클릭 +
 * editingContext 가 이미 전담하므로 이 판정이 깊이 모델을 대신할 이유가 없다.
 *
 * 예외 2가지는 기존 동작을 그대로 보존한다:
 * - body 선택: 선택 박스가 페이지 전체를 덮어 모든 클릭이 삼켜지므로 드래그 의도 아님
 *   (body 는 하위 로직에서도 드래그 대상 제외).
 * - 히트 없음(`hitElementId === null`): 빈 영역이라도 선택 박스 안이면 드래그 핸들로 둔다.
 */
export function resolveSelectionDragIntent({
  editingContextId,
  elementsMap,
  hitElementId,
  selectedIds,
}: ResolveSelectionDragIntentInput): boolean {
  if (selectedIds.length === 0) {
    return false;
  }

  const singleSelected =
    selectedIds.length === 1 ? elementsMap.get(selectedIds[0]) : null;
  if (singleSelected?.type.toLowerCase() === "body") {
    return false;
  }

  if (hitElementId === null) {
    return true;
  }

  if (selectedIds.includes(hitElementId)) {
    return true;
  }

  const resolved = resolveClickTarget(
    hitElementId,
    editingContextId,
    elementsMap,
  );
  return resolved !== null && selectedIds.includes(resolved);
}

/**
 * 다중 드래그 대상 정규화 — ADR-178 §3.1 단일 진입점.
 *
 * - body 는 요소 드래그 대상이 아니다 (페이지 이동은 별도 page gesture 축).
 *   다중 선택에 body 가 섞여도 요소 집합에서 제외한다 — 종전에는 다중 선택 시
 *   body 가드가 통과해 `selectedIds[0]`(body 가능)로 드래그가 시작되는 엣지가
 *   있었다 (breakdown §2.1 재현 기록).
 * - 조상이 집합에 있으면 자손은 제외한다 (조상 이동이 자손을 함께 옮기므로
 *   이중 이동 방지 — Figma 동형).
 * - 반환 순서는 입력 `selectedIds` 순서를 보존한다 — 첫 요소가 드래그 리더
 *   (드롭 타겟 판정 기준).
 */
export function resolveMultiDragTargets({
  elementsMap,
  selectedIds,
}: {
  elementsMap: ReadonlyMap<string, CanvasInteractionNode>;
  selectedIds: readonly string[];
}): string[] {
  if (selectedIds.length === 0) {
    return [];
  }

  // 1차: 드래그 자격이 있는 선택만 (body/삭제/부재 제외). 조상 판정은 이
  // 집합 기준이어야 한다 — body 를 selectedIds 그대로 조상으로 치면 body 의
  // 자손 전부가 오제외된다 (body 는 이동 대상이 아니므로 조상 자격도 없다).
  const eligible: CanvasInteractionNode[] = [];
  const eligibleIds = new Set<string>();
  for (const id of selectedIds) {
    const element = elementsMap.get(id);
    if (!element || element.deleted) continue;
    if (element.type.toLowerCase() === "body") continue;
    eligible.push(element);
    eligibleIds.add(id);
  }

  // 2차: 조상이 자격 집합에 있으면 자손 제외
  const targets: string[] = [];
  for (const element of eligible) {
    let ancestorSelected = false;
    let parentId = element.parent_id ?? null;
    while (parentId) {
      if (eligibleIds.has(parentId)) {
        ancestorSelected = true;
        break;
      }
      parentId = elementsMap.get(parentId)?.parent_id ?? null;
    }
    if (!ancestorSelected) {
      targets.push(element.id);
    }
  }
  return targets;
}

/**
 * 다중 드래그의 드롭 타겟 필터 — 타겟 컨테이너가 드래그 대상 집합의 **자신
 * 또는 자손**이면 무효다 (ADR-178 R2 lock: 자기 안으로 드롭 금지 — Figma 동형.
 * 부분 적용 대신 타겟 자체를 무효화해 전체 취소로 흐른다).
 */
export function isContainerWithinDragTargets({
  containerId,
  elementsMap,
  targetIds,
}: {
  containerId: string;
  elementsMap: ReadonlyMap<string, CanvasInteractionNode>;
  targetIds: ReadonlySet<string>;
}): boolean {
  let currentId: string | null = containerId;
  while (currentId) {
    if (targetIds.has(currentId)) {
      return true;
    }
    currentId = elementsMap.get(currentId)?.parent_id ?? null;
  }
  return false;
}

export function resolveSelectionHit(
  canvasPoint: CanvasPoint,
  selectionBounds: BoundingBox | null,
  zoom: number,
): ResolveSelectionHitResult {
  const hitHandle = hitTestHandle(canvasPoint, selectionBounds, zoom);

  return {
    hitHandle,
    inSelectionBounds: hitTestSelectionBounds(canvasPoint, selectionBounds),
  };
}

export function resolveTopmostHitElementId(
  hitCandidates: string[],
  elementsMap: ReadonlyMap<string, CanvasInteractionNode>,
  childrenMap?: ReadonlyMap<string, readonly CanvasInteractionNode[]> | null,
  pagePaintRank?: ReadonlyMap<string, number> | null,
  occludingPageRank?: number | null,
): string | null {
  return pickTopmostHitElementId(
    hitCandidates,
    elementsMap,
    childrenMap,
    pagePaintRank,
    occludingPageRank,
  );
}

/**
 * 지점을 덮는 페인트 최상단 페이지 id (드래그 중 transient 위치 반영).
 * 요소 히트 occlusion 필터 (pickTopmostHitElementId 의 occludingPageRank) 입력용.
 */
export function resolveTopPageIdAtPoint(
  options: Omit<TopPageAtPointOptions, "pagePositionReader">,
): string | null {
  const presentationSnapshot = getPagePositionPresentationSnapshot();
  return findTopPageIdAtCanvasPoint({
    ...options,
    pagePositionReader: (pageId) =>
      readPagePosition(pageId, presentationSnapshot),
  });
}

export function resolveBodySelection(
  options: Parameters<typeof findBodySelectionAtCanvasPoint>[0],
): BodySelectionResult {
  const presentationSnapshot = getPagePositionPresentationSnapshot();
  return findBodySelectionAtCanvasPoint({
    ...options,
    pagePositionReader: (pageId) =>
      readPagePosition(pageId, presentationSnapshot),
  });
}

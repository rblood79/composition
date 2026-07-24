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
  pickTopmostHitElementId,
  type BodySelectionResult,
  type CanvasPoint,
  type FrameBodySelectionArea,
} from "../selection/selectionHitTest";
import { getViewportController } from "../viewport/ViewportController";
import { getFrameElementMirrorId } from "../../../../adapters/canonical/frameMirror";
import type { CanvasInteractionNode } from "./interactionNode";

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
    if (currentPageId !== null && element.page_id === currentPageId) {
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
        ? pagePositions?.[element.page_id]
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
): string | null {
  return pickTopmostHitElementId(hitCandidates, elementsMap, childrenMap);
}

export function resolveBodySelection(
  options: Parameters<typeof findBodySelectionAtCanvasPoint>[0],
): BodySelectionResult {
  return findBodySelectionAtCanvasPoint(options);
}

import type { CanvasKit, Canvas, FontMgr } from "canvaskit-wasm";
import { beginRenderEffects, endRenderEffects } from "./effects";
import { toSkiaBlendMode } from "./blendModes";
import { acquirePooledPaint, releasePooledPaint } from "./paints";
import { renderBox } from "./nodeRendererBorders";
import { buildClipPath, sortByStackingOrder } from "./nodeRendererClip";
import { renderImage } from "./nodeRendererImage";
import { getEditingElementId } from "./nodeRendererState";
import {
  renderLine,
  renderArc,
  renderIconPath,
  renderPartialBorder,
  renderScrollbar,
} from "./nodeRendererShapes";
import { renderText } from "./nodeRendererText";
import type { SkiaNodeData } from "./nodeRendererTypes";
import { notifyLayoutChange } from "./useSkiaNode";
import {
  getPagePositionPresentationSnapshot,
  readPagePositionDelta,
  type PagePositionPresentationSnapshot,
} from "../interaction/pagePositionPresentation";

// ============================================
// Drag Visual Offset (Pencil deferred-drop 패턴)
// globalThis 사용 — HMR 모듈 인스턴스 분리 방지
// ============================================

interface DragVisualOffsetData {
  elementId: string;
  dx: number;
  dy: number;
}

const G = globalThis as unknown as {
  __composition_dragVisualOffset?: DragVisualOffsetData | null;
  __composition_dragSiblingOffsets?: Map<
    string,
    { dx: number; dy: number }
  > | null;
};

function _get(): DragVisualOffsetData | null {
  return G.__composition_dragVisualOffset ?? null;
}

export function getSiblingOffset(
  elementId: string,
): { dx: number; dy: number } | undefined {
  return G.__composition_dragSiblingOffsets?.get(elementId);
}

/**
 * 드래그 중인 요소의 시각적 오프셋을 설정한다.
 * Store는 변경하지 않고, 렌더링 시점에만 canvas.translate로 적용.
 *
 * @param skipInvalidation true면 notifyLayoutChange() 호출 스킵 (drop 시 store 갱신이 별도로 트리거)
 */
export function setDragVisualOffset(
  elementId: string | null,
  dx = 0,
  dy = 0,
  skipInvalidation = false,
): void {
  const prev = _get();
  G.__composition_dragVisualOffset =
    elementId !== null ? { elementId, dx, dy } : null;

  if (skipInvalidation) return;

  const next = G.__composition_dragVisualOffset;
  const changed =
    (prev === null) !== (next === null) ||
    (prev &&
      next &&
      (prev.elementId !== next.elementId ||
        prev.dx !== next.dx ||
        prev.dy !== next.dy));
  if (changed) {
    notifyLayoutChange();
  }
}

/**
 * 드래그 중 형제 요소들의 시각적 오프셋을 설정한다.
 * Pencil deferred-drop 패턴: vacate(빈 자리 채움) + insertion(공간 열기).
 *
 * @param offsets elementId → {dx, dy} 맵. null이면 모든 형제 오프셋 제거.
 */
export function setDragSiblingOffsets(
  offsets: Map<string, { dx: number; dy: number }> | null,
): void {
  G.__composition_dragSiblingOffsets = offsets;
  notifyLayoutChange();
}

/** 현재 드래그 시각적 오프셋 반환 */
export function getDragVisualOffset() {
  return _get();
}

export function renderNode(
  ck: CanvasKit,
  canvas: Canvas,
  node: SkiaNodeData,
  cullingBounds: DOMRect,
  fontMgr?: FontMgr,
  pageRootPageIds?: ReadonlyMap<string, string>,
  pagePositionSnapshot: PagePositionPresentationSnapshot = getPagePositionPresentationSnapshot(),
): void {
  const left = cullingBounds.x;
  const top = cullingBounds.y;
  renderNodeInternal(
    ck,
    canvas,
    node,
    left,
    top,
    left + cullingBounds.width,
    top + cullingBounds.height,
    fontMgr,
    pageRootPageIds,
    pagePositionSnapshot,
  );
}

function renderNodeInternal(
  ck: CanvasKit,
  canvas: Canvas,
  node: SkiaNodeData,
  cullLeft: number,
  cullTop: number,
  cullRight: number,
  cullBottom: number,
  fontMgr?: FontMgr,
  pageRootPageIds?: ReadonlyMap<string, string>,
  pagePositionSnapshot?: PagePositionPresentationSnapshot,
): void {
  if (!node.visible) return;

  const pageId = node.elementId
    ? pageRootPageIds?.get(node.elementId)
    : undefined;
  const pageDelta = pageId
    ? readPagePositionDelta(
        pageId,
        pagePositionSnapshot ?? getPagePositionPresentationSnapshot(),
      )
    : null;
  const nodeX = node.x + (pageDelta?.dx ?? 0);
  const nodeY = node.y + (pageDelta?.dy ?? 0);

  // ADR-043: 드래그 오프셋은 skiaTreeBuilder에서 node.x/y에 반영됨
  if (node.width > 0 || node.height > 0) {
    const nodeRight = nodeX + node.width;
    const nodeBottom = nodeY + node.height;
    if (
      cullLeft > nodeRight ||
      cullRight < nodeX ||
      cullTop > nodeBottom ||
      cullBottom < nodeY
    ) {
      return;
    }
  }

  canvas.save();
  canvas.translate(nodeX, nodeY);

  if (node.transform) {
    canvas.concat(node.transform);
  }

  if (node.clipPath) {
    const clipP = buildClipPath(ck, node.clipPath, node.width, node.height);
    if (clipP) {
      canvas.clipPath(clipP, ck.ClipOp.Intersect, true);
      clipP.delete();
    }
  }

  let hasBlendLayer = false;
  if (node.blendMode && node.blendMode !== "normal") {
    const blendPaint = acquirePooledPaint(ck);
    blendPaint.setBlendMode(
      toSkiaBlendMode(ck, node.blendMode) as Parameters<
        typeof blendPaint.setBlendMode
      >[0],
    );
    canvas.saveLayer(blendPaint);
    releasePooledPaint(blendPaint);
    hasBlendLayer = true;
  }

  const layerCount = node.effects
    ? beginRenderEffects(ck, canvas, node.effects)
    : 0;

  switch (node.type) {
    case "box":
      renderBox(ck, canvas, node);
      break;
    case "text":
      if (node.box) renderBox(ck, canvas, node);
      if (
        fontMgr &&
        !(node.elementId && node.elementId === getEditingElementId())
      ) {
        renderText(ck, canvas, node, fontMgr);
      }
      break;
    case "image":
      renderImage(ck, canvas, node, fontMgr);
      break;
    case "line":
      renderLine(ck, canvas, node);
      break;
    case "arc":
      renderArc(ck, canvas, node);
      break;
    case "icon_path":
      renderIconPath(ck, canvas, node);
      break;
    case "partial_border":
      renderPartialBorder(ck, canvas, node);
      break;
    case "container":
      break;
  }

  if (node.children) {
    if (node.clipChildren && node.width > 0 && node.height > 0) {
      canvas.save();
      const clipRect = ck.LTRBRect(0, 0, node.width, node.height);
      canvas.clipRect(clipRect, ck.ClipOp.Intersect, true);
    }

    const hasScrollOffset =
      node.scrollOffset &&
      (node.scrollOffset.scrollTop !== 0 || node.scrollOffset.scrollLeft !== 0);
    if (hasScrollOffset) {
      canvas.save();
      canvas.translate(
        -node.scrollOffset!.scrollLeft,
        -node.scrollOffset!.scrollTop,
      );
    }

    const childCullLeft =
      cullLeft - nodeX + (node.scrollOffset?.scrollLeft ?? 0);
    const childCullTop = cullTop - nodeY + (node.scrollOffset?.scrollTop ?? 0);
    const childCullRight =
      cullRight - nodeX + (node.scrollOffset?.scrollLeft ?? 0);
    const childCullBottom =
      cullBottom - nodeY + (node.scrollOffset?.scrollTop ?? 0);
    const hasZIndex = node.children.some((c) => c.zIndex !== undefined);
    const childrenToRender = hasZIndex
      ? sortByStackingOrder(node.children)
      : node.children;
    for (const child of childrenToRender) {
      renderNodeInternal(
        ck,
        canvas,
        child,
        childCullLeft,
        childCullTop,
        childCullRight,
        childCullBottom,
        fontMgr,
        pageRootPageIds,
        pagePositionSnapshot,
      );
    }

    if (hasScrollOffset) {
      canvas.restore();
    }

    if (node.scrollbar) {
      renderScrollbar(ck, canvas, node);
    }

    if (node.clipChildren && node.width > 0 && node.height > 0) {
      canvas.restore();
    }
  }

  endRenderEffects(canvas, layerCount);
  if (hasBlendLayer) canvas.restore();
  canvas.restore();
}

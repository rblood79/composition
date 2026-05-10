/**
 * buildImageNodeData — ImageSprite SkiaNodeData 빌드 로직 추출 (ADR-100 Phase 6)
 *
 * ImageSprite.tsx useMemo (lines 286-322)의 순수 함수 버전.
 * PixiJS 의존성 없음. element.props + layout + skImage에서 구축.
 *
 * 특수 사항:
 * - skImage는 비동기 로딩 결과를 외부에서 주입 (StoreRenderBridge가 관리)
 * - object-fit 계산 포함 (cover/contain/fill/none)
 */

import type { CanvasSceneNode } from "../scene/canvasSceneNode";
import type { ComputedLayout } from "../layout/engines/LayoutEngine";
import type { SkiaNodeData } from "./nodeRendererTypes";
import type { Image as SkImage } from "canvaskit-wasm";
import { parsePadding, getContentBounds } from "../sprites/paddingUtils";
import { buildBaseNodeProps } from "./buildBaseNodeProps";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImageBuildInput {
  element: CanvasSceneNode;
  layout: ComputedLayout | undefined;
  /** 비동기 로드된 SkImage (null이면 placeholder 표시) */
  skImage: SkImage | null;
}

// ---------------------------------------------------------------------------
// Object-fit 계산
// ---------------------------------------------------------------------------

interface ContentRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function computeObjectFit(
  skImage: SkImage | null,
  objectFit: "cover" | "contain" | "fill" | "none",
  contentBounds: ContentRect,
): ContentRect {
  if (!skImage || objectFit === "fill") {
    return contentBounds;
  }

  const imgW = skImage.width();
  const imgH = skImage.height();
  const cw = contentBounds.width;
  const ch = contentBounds.height;

  if (objectFit === "none") {
    return {
      x: contentBounds.x + (cw - imgW) / 2,
      y: contentBounds.y + (ch - imgH) / 2,
      width: imgW,
      height: imgH,
    };
  }

  // contain / cover
  const scaleX = cw / imgW;
  const scaleY = ch / imgH;
  const scale =
    objectFit === "contain"
      ? Math.min(scaleX, scaleY)
      : Math.max(scaleX, scaleY);
  const w = imgW * scale;
  const h = imgH * scale;
  return {
    x: contentBounds.x + (cw - w) / 2,
    y: contentBounds.y + (ch - h) / 2,
    width: w,
    height: h,
  };
}

// ---------------------------------------------------------------------------
// Main Builder
// ---------------------------------------------------------------------------

/**
 * ImageSprite의 skiaNodeData useMemo 로직을 순수 함수로 추출.
 *
 * ImageSprite.tsx lines 286-322의 완전한 이식:
 * - object-fit 기반 이미지 콘텐츠 영역 계산
 * - placeholder box (gray-200 배경)
 * - border-radius, effects, visibility
 * - altText (미로드 시)
 */
export function buildImageNodeData(
  input: ImageBuildInput,
): SkiaNodeData | null {
  const { element, layout, skImage } = input;

  const base = buildBaseNodeProps(element, layout);
  if (!base) return null;

  const {
    converted,
    effects,
    blendMode,
    skiaTransform,
    x,
    y,
    w,
    h,
    visible,
    zIndex,
    isStackingContext: isStackingCtx,
    clipPath,
    style,
  } = base;
  const { borderRadius } = converted;

  // ---------- Props ----------
  const props = element.props as Record<string, unknown> | undefined;
  const objectFit = (() => {
    const fit = props?.objectFit as string | undefined;
    if (
      fit === "contain" ||
      fit === "cover" ||
      fit === "fill" ||
      fit === "none"
    )
      return fit;
    return "cover";
  })();
  const altText = String(props?.alt || "");

  // ---------- Padding + content bounds ----------
  const padding = parsePadding(style as Parameters<typeof parsePadding>[0]);
  const contentBounds = getContentBounds(w, h, padding);

  // ---------- Object-fit ----------
  const imageContent = computeObjectFit(skImage, objectFit, contentBounds);

  // ---------- Assemble SkiaNodeData ----------
  const nodeData: SkiaNodeData = {
    type: "image",
    elementId: element.id,
    x,
    y,
    width: w,
    height: h,
    visible,
    // placeholder 렌더링용 box (skImage 미로드 시 fillColor로 배경 표시)
    box: {
      fillColor: Float32Array.of(0.898, 0.906, 0.922, 1), // gray-200 (#e5e7eb)
      borderRadius: borderRadius ?? 0,
    },
    image: {
      skImage,
      contentX: imageContent.x,
      contentY: imageContent.y,
      contentWidth: imageContent.width,
      contentHeight: imageContent.height,
      ...(altText && !skImage ? { altText } : {}),
    },
  };

  if (effects) nodeData.effects = effects;
  if (blendMode) nodeData.blendMode = blendMode;
  if (skiaTransform) nodeData.transform = skiaTransform;
  if (clipPath) nodeData.clipPath = clipPath;
  if (zIndex !== undefined) nodeData.zIndex = zIndex;
  if (isStackingCtx) nodeData.isStackingContext = true;

  return nodeData;
}

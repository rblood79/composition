/**
 * buildSkiaNodeData — CanvasSceneNode→SkiaNodeData 순수 변환 (ADR-100 Phase 6)
 *
 * PixiJS Sprite 컴포넌트 없이 store 데이터에서 직접 SkiaNodeData를 구축한다.
 * 기존 유틸리티(convertStyle, buildSkiaEffects)를 재사용.
 *
 * 지원 범위:
 * - box (div, section 등 컨테이너)
 * - text (Heading, Text, Label 등)
 * - image (Image)
 */

import type { CanvasSceneNode } from "../scene/canvasSceneNode";
import type { SkiaNodeData } from "./nodeRendererTypes";
import type { ComputedLayout } from "../layout/engines/LayoutEngine";
import {
  convertStyle,
  buildSkiaEffects,
  parseClipPath,
  colorIntToFloat32,
} from "../sprites/styleConverter";
import {
  parseZIndex,
  createsStackingContext,
} from "../layout/engines/cssStackingContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BuildContext {
  /** Taffy 레이아웃 결과 */
  layoutMap: Map<string, ComputedLayout>;
  /** 현재 테마 (dark/light) */
  theme: "light" | "dark";
  /** 스크롤 상태 */
  scrollMap?: Map<string, { scrollTop: number; scrollLeft: number }>;
}

// ---------------------------------------------------------------------------
// Main Builder
// ---------------------------------------------------------------------------

/**
 * CanvasSceneNode → SkiaNodeData 순수 변환.
 * PixiJS 의존성 없음. store 데이터만으로 렌더 데이터를 구축.
 */
export function buildSkiaNodeData(
  element: CanvasSceneNode,
  ctx: BuildContext,
): SkiaNodeData | null {
  const style = element.props?.style as Record<string, unknown> | undefined;

  // style 없는 요소 (Spec 기반 Button 등): 최소 placeholder로 등록
  // → command stream 트리 순회가 끊기지 않도록 함
  if (!style) {
    const layout = ctx.layoutMap.get(element.id);
    return {
      type: "box",
      elementId: element.id,
      x: layout?.x ?? 0,
      y: layout?.y ?? 0,
      width: layout?.width ?? 0,
      height: layout?.height ?? 0,
      visible: true,
      box: {
        fillColor: Float32Array.of(0, 0, 0, 0),
        borderRadius: 0,
      },
    };
  }

  // display:none → 렌더 스킵
  if (style.display === "none") return null;
  if (style.visibility === "hidden" || style.visibility === "collapse") {
    return null;
  }

  const layout = ctx.layoutMap.get(element.id);
  const converted = convertStyle(
    style as Parameters<typeof convertStyle>[0],
    style.color as string | undefined,
  );

  const width = layout?.width ?? converted.transform.width;
  const height = layout?.height ?? converted.transform.height;
  const x = layout?.x ?? converted.transform.x;
  const y = layout?.y ?? converted.transform.y;

  const skiaEffects = buildSkiaEffects(
    style as Parameters<typeof buildSkiaEffects>[0],
  );

  const overflow = style.overflow as string | undefined;
  const clipChildren =
    overflow === "hidden" ||
    overflow === "clip" ||
    overflow === "scroll" ||
    overflow === "auto";

  const zIndex = parseZIndex(style.zIndex as string | number | undefined);
  const isStackingContext = createsStackingContext(
    style as Record<string, unknown>,
  );

  // position: sticky / fixed
  const position = style.position as string | undefined;
  const isSticky = position === "sticky";
  const isFixed = position === "fixed";
  const stickyTop = isSticky
    ? parseFloat((style.top as string | undefined) ?? "0")
    : undefined;
  const stickyLeft = isSticky
    ? parseFloat((style.left as string | undefined) ?? "0")
    : undefined;

  // 스크롤 상태
  const scrollState = ctx.scrollMap?.get(element.id);
  const scrollOffset = scrollState
    ? { scrollTop: scrollState.scrollTop, scrollLeft: scrollState.scrollLeft }
    : undefined;

  // clip-path
  const clipPath =
    typeof style.clipPath === "string"
      ? (parseClipPath(style.clipPath, width, height) ?? undefined)
      : undefined;

  const { fill, stroke, borderRadius } = converted;
  const fillColor = colorIntToFloat32(fill.color, fill.alpha);
  const strokeColor = stroke?.color
    ? colorIntToFloat32(stroke.color, stroke.alpha ?? 1)
    : undefined;

  // 기본 SkiaNodeData (box 타입)
  const nodeData: SkiaNodeData = {
    type: "box",
    elementId: element.id,
    x,
    y,
    width,
    height,
    visible: true,
    clipChildren,
    scrollOffset,
    zIndex,
    isStackingContext,
    clipPath,
    ...(isSticky && { isSticky, stickyTop, stickyLeft }),
    ...(isFixed && { isFixed }),
    box: {
      fillColor,
      borderRadius: borderRadius ?? 0,
      strokeColor,
      strokeWidth: stroke?.width,
    },
  };

  if (skiaEffects.effects) nodeData.effects = skiaEffects.effects;
  if (skiaEffects.blendMode) nodeData.blendMode = skiaEffects.blendMode;
  if (skiaEffects.transform) nodeData.transform = skiaEffects.transform;

  return nodeData;
}

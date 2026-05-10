/**
 * buildBaseNodeProps — Box/Text/Image 공통 SkiaNodeData 속성 추출 (ADR-100)
 *
 * convertStyle + buildSkiaEffects + layout dimensions + visibility +
 * zIndex + stackingContext + CSS transform + clipPath 패턴을
 * 단일 함수로 통합하여 buildBoxNodeData/buildImageNodeData/buildSpecNodeData에서 재사용.
 */

import type { CanvasSceneNode } from "../scene/canvasSceneNode";
import type { ComputedLayout } from "../layout/engines/LayoutEngine";
import type { EffectStyle } from "./types";
import type { ClipPathShape } from "../sprites/styleConverter";
import type { ConvertedStyle } from "../sprites/styleConverter";
import {
  convertStyle,
  buildSkiaEffects,
  parseClipPath,
  applyTransformOrigin,
  parseTransformOrigin,
} from "../sprites/styleConverter";
import {
  parseZIndex,
  createsStackingContext,
} from "../layout/engines/cssStackingContext";

export interface BaseNodeProps {
  /** convertStyle 결과 */
  converted: ConvertedStyle;
  /** buildSkiaEffects 결과 */
  effects: EffectStyle[] | undefined;
  blendMode: string | undefined;
  /** CSS transform → CanvasKit 3x3 matrix (transform-origin 적용 완료) */
  skiaTransform: Float32Array | undefined;
  /** layout 좌표/크기 */
  x: number;
  y: number;
  w: number;
  h: number;
  /** visibility */
  visible: boolean;
  /** z-index */
  zIndex: number | undefined;
  isStackingContext: boolean;
  /** clip-path */
  clipPath: ClipPathShape | undefined;
  /** 원본 style */
  style: Record<string, unknown>;
}

/**
 * element + layout에서 공통 SkiaNodeData 속성을 추출.
 * style이 없으면 null 반환.
 */
export function buildBaseNodeProps(
  element: CanvasSceneNode,
  layout: ComputedLayout | undefined,
): BaseNodeProps | null {
  const styleRaw = element.props?.style as
    | Record<string, unknown>
    | undefined
    | null;

  // style이 없고 layout도 없으면 렌더 불가 → null
  if (!styleRaw && !layout) return null;

  const style = styleRaw ?? {};

  const converted = convertStyle(
    style as Parameters<typeof convertStyle>[0],
    style.color as string | undefined,
  );

  const skiaEffects = buildSkiaEffects(
    style as Parameters<typeof buildSkiaEffects>[0],
  );

  const w = layout?.width ?? converted.transform.width;
  const h = layout?.height ?? converted.transform.height;
  const x = layout?.x ?? converted.transform.x;
  const y = layout?.y ?? converted.transform.y;

  const visible =
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.visibility !== "collapse";

  const zIndex = parseZIndex(style.zIndex as string | number | undefined);
  const isStackingContext = createsStackingContext(style);

  let skiaTransform: Float32Array | undefined;
  if (skiaEffects.transform) {
    const [ox, oy] = parseTransformOrigin(
      style.transformOrigin as string | undefined,
      w,
      h,
    );
    skiaTransform = applyTransformOrigin(skiaEffects.transform, ox, oy);
  }

  const clipPath =
    typeof style.clipPath === "string"
      ? (parseClipPath(style.clipPath, w, h) ?? undefined)
      : undefined;

  return {
    converted,
    effects: skiaEffects.effects,
    blendMode: skiaEffects.blendMode,
    skiaTransform,
    x,
    y,
    w,
    h,
    visible,
    zIndex,
    isStackingContext,
    clipPath,
    style,
  };
}

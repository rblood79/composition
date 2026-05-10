/**
 * buildBoxNodeData — BoxSprite SkiaNodeData 빌드 로직 추출 (ADR-100 Phase 6)
 *
 * BoxSprite.tsx useMemo (lines 232-455)의 순수 함수 버전.
 * PixiJS 의존성 없음. element.props + layoutMap에서 구축.
 */

import type { CanvasSceneNode } from "../scene/canvasSceneNode";
import type { SkiaNodeData } from "./nodeRendererTypes";
import type { ComputedLayout } from "../layout/engines/LayoutEngine";
import type { EffectStyle } from "./types";
import {
  convertStyle,
  buildSkiaEffects,
  parseClipPath,
  applyTransformOrigin,
  parseTransformOrigin,
  cssColorToAlpha,
} from "../sprites/styleConverter";
import {
  parseZIndex,
  createsStackingContext,
} from "../layout/engines/cssStackingContext";
import {
  fillsToSkiaFillColor,
  fillsToSkiaFillStyle,
  cssBgImageToSkia,
} from "../../../panels/styles/utils/fillToSkia";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BoxBuildInput {
  element: CanvasSceneNode;
  layout: ComputedLayout | undefined;
  scrollState?: {
    scrollTop: number;
    scrollLeft: number;
    maxScrollTop: number;
    maxScrollLeft: number;
  } | null;
  isCollectionItem?: boolean;
  isCardItem?: boolean;
  theme?: "light" | "dark";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function buildBoxNodeData(input: BoxBuildInput): SkiaNodeData | null {
  const { element, layout, scrollState, isCollectionItem, isCardItem } = input;

  // ADR-902 후속: body 는 BodySpec (TAG_SPEC_MAP 등록) 이 담당 → isSpecPath=true
  // → buildSpecNodeData 경로로 진입하여 이 함수에 body 가 도달하지 않는다.
  // 과거 isBody theme override 블록 및 commit 3256c8a7 의 !isBody 가드는 모두
  // dead code 이므로 제거. Spec 경로가 theme resolve 단일 진입점.
  const style =
    (element.props?.style as Record<string, unknown> | undefined) ?? {};

  const converted = convertStyle(
    style as Parameters<typeof convertStyle>[0],
    style.color as string | undefined,
  );
  const { transform, fill, stroke, borderRadius } = converted;
  const skiaEffects = buildSkiaEffects(
    style as Parameters<typeof buildSkiaEffects>[0],
  );

  const w = layout?.width ?? transform.width;
  const h = layout?.height ?? transform.height;
  const x = layout?.x ?? transform.x;
  const y = layout?.y ?? transform.y;

  // display/visibility 체크
  if (
    style.display === "none" ||
    style.display === "contents" ||
    style.visibility === "hidden" ||
    style.visibility === "collapse"
  ) {
    return null;
  }

  // Fill color
  const fills = (element as unknown as { fills?: unknown[] }).fills;
  let fillColor: Float32Array;

  const fillV2Color =
    fills && fills.length > 0
      ? fillsToSkiaFillColor(
          fills as Parameters<typeof fillsToSkiaFillColor>[0],
        )
      : null;

  const fillV2Style =
    fills && fills.length > 0
      ? fillsToSkiaFillStyle(
          fills as Parameters<typeof fillsToSkiaFillStyle>[0],
          w,
          h,
        )
      : null;
  const gradientFill =
    fillV2Style && fillV2Style.type !== "color" ? fillV2Style : undefined;

  // CSS background-image: url(...)
  const cssBgImageFill = gradientFill
    ? undefined
    : (() => {
        const bgImg = style.backgroundImage as string | undefined;
        if (!bgImg || !bgImg.startsWith("url(")) return undefined;
        const urlMatch = bgImg.match(/url\(\s*["']?([^"')]+)["']?\s*\)/);
        if (!urlMatch) return undefined;
        return (
          cssBgImageToSkia(
            urlMatch[1],
            w,
            h,
            style.backgroundSize as string | undefined,
            style.backgroundPosition as string | undefined,
            style.backgroundRepeat as string | undefined,
          ) ?? undefined
        );
      })();

  if (fillV2Color) {
    fillColor = fillV2Color;
  } else if (isCollectionItem && fill.alpha === 0) {
    fillColor = Float32Array.of(0.98, 0.98, 0.98, 1);
  } else {
    const r = ((fill.color >> 16) & 0xff) / 255;
    const g = ((fill.color >> 8) & 0xff) / 255;
    const b = (fill.color & 0xff) / 255;
    const bgAlpha = skiaEffects.effects?.some(
      (e: EffectStyle) => e.type === "opacity",
    )
      ? cssColorToAlpha(style.backgroundColor as string | undefined)
      : fill.alpha;
    fillColor = Float32Array.of(r, g, b, bgAlpha);
  }

  // Border radius
  const defaultBr = borderRadius ?? 0;
  const br =
    (isCardItem || isCollectionItem) &&
    (typeof defaultBr === "number" ? defaultBr : (defaultBr?.[0] ?? 0)) === 0
      ? 8
      : defaultBr;

  // CSS transform
  let skiaTransform: Float32Array | undefined;
  if (skiaEffects.transform) {
    const [ox, oy] = parseTransformOrigin(
      style.transformOrigin as string | undefined,
      w,
      h,
    );
    skiaTransform = applyTransformOrigin(skiaEffects.transform, ox, oy);
  }

  const zIndex = parseZIndex(style.zIndex as string | number | undefined);
  const isStackingCtx = createsStackingContext(style);

  // Overflow
  const overflow = style.overflow as string | undefined;
  const clipChildren =
    overflow === "hidden" ||
    overflow === "clip" ||
    overflow === "scroll" ||
    overflow === "auto";

  // Scroll
  let scrollOffset: { scrollTop: number; scrollLeft: number } | undefined;
  let scrollbar: Record<string, unknown> | undefined;

  if (scrollState && (overflow === "scroll" || overflow === "auto")) {
    scrollOffset = {
      scrollTop: scrollState.scrollTop,
      scrollLeft: scrollState.scrollLeft,
    };
    const sb: Record<string, unknown> = {};
    if (scrollState.maxScrollTop > 0) {
      const contentH = h + scrollState.maxScrollTop;
      const thumbH = Math.max(20, (h / contentH) * h);
      const thumbY =
        scrollState.maxScrollTop > 0
          ? (scrollState.scrollTop / scrollState.maxScrollTop) * (h - thumbH)
          : 0;
      sb.vertical = { trackHeight: h, thumbHeight: thumbH, thumbY };
    }
    if (scrollState.maxScrollLeft > 0) {
      const contentW = w + scrollState.maxScrollLeft;
      const thumbW = Math.max(20, (w / contentW) * w);
      const thumbX =
        scrollState.maxScrollLeft > 0
          ? (scrollState.scrollLeft / scrollState.maxScrollLeft) * (w - thumbW)
          : 0;
      sb.horizontal = { trackWidth: w, thumbWidth: thumbW, thumbX };
    }
    if (Object.keys(sb).length > 0) scrollbar = sb;
  }

  // Clip path
  const clipPath =
    typeof style.clipPath === "string"
      ? parseClipPath(style.clipPath, w, h)
      : undefined;

  // Stroke — PixiStrokeStyle (color, width, alpha)
  const strokeColor = stroke?.color
    ? Float32Array.of(
        ((stroke.color >> 16) & 0xff) / 255,
        ((stroke.color >> 8) & 0xff) / 255,
        (stroke.color & 0xff) / 255,
        stroke.alpha ?? 1,
      )
    : isCardItem || isCollectionItem
      ? Float32Array.of(0.83, 0.83, 0.83, 1)
      : undefined;

  return {
    type: "box",
    elementId: element.id,
    x,
    y,
    width: w,
    height: h,
    visible: true,
    ...(clipChildren ? { clipChildren: true } : {}),
    ...(scrollOffset ? { scrollOffset } : {}),
    ...(scrollbar ? { scrollbar } : {}),
    ...(skiaEffects.effects ? { effects: skiaEffects.effects } : {}),
    ...(skiaEffects.blendMode ? { blendMode: skiaEffects.blendMode } : {}),
    ...(skiaTransform ? { transform: skiaTransform } : {}),
    ...(zIndex !== undefined ? { zIndex } : {}),
    ...(isStackingCtx ? { isStackingContext: true } : {}),
    ...(clipPath ? { clipPath } : {}),
    box: {
      fillColor,
      ...(cssBgImageFill
        ? { fill: cssBgImageFill }
        : gradientFill
          ? { fill: gradientFill }
          : {}),
      borderRadius: br,
      strokeColor,
      strokeWidth:
        stroke?.width ?? (isCardItem || isCollectionItem ? 1 : undefined),
    },
  } as SkiaNodeData;
}

/**
 * buildBoxNodeData — BoxSprite SkiaNodeData 빌드 로직 추출 (ADR-100 Phase 6)
 *
 * BoxSprite.tsx useMemo (lines 232-455)의 순수 함수 버전.
 * PixiJS 의존성 없음. element.props + layoutMap에서 구축.
 */

import type { BorderStyleValue, TokenRef } from "@composition/specs";
import { resolveColor, hexStringToNumber } from "@composition/specs";
import { resolveComponentRule } from "@composition/shared";
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
  colorIntToFloat32,
} from "../sprites/styleConverter";
import {
  parseZIndex,
  createsStackingContext,
} from "../layout/engines/cssStackingContext";
import {
  resolveEffectiveOverflow,
  resolveEffectiveBoxShadow,
} from "../layout/engines/implicitStyles";
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
  const {
    element,
    layout,
    scrollState,
    isCollectionItem,
    isCardItem,
    theme = "light",
  } = input;

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
  // Box shadow — catalog containerStyles 에만 elevation 을 둔 overlay(Popover/Tooltip/Modal)도
  //   캔버스 그림자가 나오도록 catalog fallback 포괄(raw props.style 우선). TokenRef 는 theme 별
  //   rgba 로 전개되어 parseOneShadow 를 그대로 통과한다 (ADR-166 Phase 3).
  //   ADR-166 후속: raw 도 정규화 대상이라(패널이 기록한 프리셋 리터럴 → 현재 theme) 부재
  //   조건이 아니라 **결과가 달라졌을 때**만 갈아끼운다. 값이 그대로면 style 객체를 그대로
  //   넘겨 hot path 할당을 만들지 않는다.
  const effectiveBoxShadow = resolveEffectiveBoxShadow(
    element.type,
    style,
    theme,
  );
  const effectsStyle =
    effectiveBoxShadow != null && effectiveBoxShadow !== style.boxShadow
      ? { ...style, boxShadow: effectiveBoxShadow }
      : style;
  const skiaEffects = buildSkiaEffects(
    effectsStyle as Parameters<typeof buildSkiaEffects>[0],
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

  // data-bound collection projection 컨테이너(scene 이 collectionShellTag 마커)는 box 경로라
  //   catalog "shell variant" 배경(ListBox `structure.containerStyles.background = {color.raised}`)을
  //   건너뛴다 — catalog 경로(buildCatalogShapes)만 shell 을 그리기 때문. 사용자 배경이 없을 때
  //   (fillV2Color 없음 + fill.alpha 0) catalog 배경 토큰을 theme-aware 해석해 복원. 불투명해지면
  //   컨테이너 drop-shadow 실루엣 = border-box 로 자동 교정(투명 시 자식 행 실루엣 캡처 문제 봉쇄).
  const shellBgToken =
    element.collectionShellTag != null && !fillV2Color && fill.alpha === 0
      ? (resolveComponentRule(element.collectionShellTag)?.structure
          ?.containerStyles?.background as TokenRef | undefined)
      : undefined;
  const shellBgResolved = shellBgToken
    ? resolveColor(shellBgToken, theme)
    : undefined;

  if (fillV2Color) {
    fillColor = fillV2Color;
  } else if (shellBgResolved != null) {
    // resolveColor 는 string | number 반환 — 색 토큰은 항상 hex 문자열이나 타입 계약상
    //   number 도 수용. hexStringToNumber 는 비-hex(transparent 등)에 0x000000 안전 fallback
    //   (인라인 parseInt(x,16) 은 NaN → 검정 오염). colorIntToFloat32 로 int→[r,g,b,a] 공용화.
    const hex =
      typeof shellBgResolved === "number"
        ? shellBgResolved
        : hexStringToNumber(shellBgResolved);
    fillColor = colorIntToFloat32(hex, 1);
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

  // Overflow — catalog containerStyles 에만 overflow 를 둔 컨테이너도 clip/scroll 발화하도록
  //   catalog fallback 포괄(raw props.style 우선). box 경로 element 는 resolved scene tag(element.type).
  const overflow = resolveEffectiveOverflow(element.type, style);
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

  // border-style: 사용자 style.borderStyle → box.strokeStyle (nodeRendererBorders 8종
  //   렌더). "none" 은 테두리 자체를 숨긴다(DOM border-style:none 대칭) → stroke 억제.
  //   catalog/spec 경로와 동일 규약. solid 는 렌더러 기본값이라 키 생략.
  const borderStyleRaw = style.borderStyle as string | undefined;
  const suppressBorder = borderStyleRaw === "none";
  const strokeStyleValue: BorderStyleValue | undefined =
    borderStyleRaw && borderStyleRaw !== "solid" && borderStyleRaw !== "none"
      ? (borderStyleRaw as BorderStyleValue)
      : undefined;

  // Stroke — PixiStrokeStyle (color, width, alpha)
  const strokeColor =
    !suppressBorder && stroke?.color
      ? Float32Array.of(
          ((stroke.color >> 16) & 0xff) / 255,
          ((stroke.color >> 8) & 0xff) / 255,
          (stroke.color & 0xff) / 255,
          stroke.alpha ?? 1,
        )
      : !suppressBorder && (isCardItem || isCollectionItem)
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
      strokeWidth: suppressBorder
        ? undefined
        : (stroke?.width ?? (isCardItem || isCollectionItem ? 1 : undefined)),
      ...(strokeStyleValue ? { strokeStyle: strokeStyleValue } : {}),
    },
  } as SkiaNodeData;
}

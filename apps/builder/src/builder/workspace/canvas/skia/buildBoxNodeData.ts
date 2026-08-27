/**
 * buildBoxNodeData — BoxSprite SkiaNodeData 빌드 로직 추출 (ADR-100 Phase 6)
 *
 * BoxSprite.tsx useMemo (lines 232-455)의 순수 함수 버전.
 * element.props + layoutMap에서 구축한다.
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
} from "../styleConversion/styleConverter";
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
  getTopEnabledFill,
  cssBgImageToSkia,
} from "../../../panels/styles/utils/fillToSkia";
import type { FillItem } from "../../../../types/builder/fill.types";
import { hexToColor4fChannels } from "./themeWatcher";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScrollNodeState {
  scrollTop: number;
  scrollLeft: number;
  maxScrollTop: number;
  maxScrollLeft: number;
}

interface BoxBuildInput {
  element: CanvasSceneNode;
  layout: ComputedLayout | undefined;
  scrollState?: ScrollNodeState | null;
  theme?: "light" | "dark";
}

/**
 * overflow: scroll/auto 컨테이너의 scrollOffset + scrollbar(thumb 기하) 산출.
 *
 * box 경로(아래)와 spec 경로(buildSpecNodeData)가 같은 계약을 공유한다 —
 * 종전엔 두 파일이 "동일 계약" 주석으로만 묶인 verbatim 사본이라 한쪽만
 * 조정될 수 있었다. renderCommands 가 scrollOffset 으로 자식 좌표를 이동하고
 * scrollbar 를 그린다. min thumb 20px.
 */
export function buildScrollNodeFields(
  width: number,
  height: number,
  scrollState: ScrollNodeState,
): {
  scrollOffset: { scrollTop: number; scrollLeft: number };
  scrollbar?: NonNullable<SkiaNodeData["scrollbar"]>;
} {
  const scrollOffset = {
    scrollTop: scrollState.scrollTop,
    scrollLeft: scrollState.scrollLeft,
  };
  const sb: NonNullable<SkiaNodeData["scrollbar"]> = {};
  if (scrollState.maxScrollTop > 0) {
    const contentH = height + scrollState.maxScrollTop;
    const thumbH = Math.max(20, (height / contentH) * height);
    const thumbY =
      (scrollState.scrollTop / scrollState.maxScrollTop) * (height - thumbH);
    sb.vertical = { trackHeight: height, thumbHeight: thumbH, thumbY };
  }
  if (scrollState.maxScrollLeft > 0) {
    const contentW = width + scrollState.maxScrollLeft;
    const thumbW = Math.max(20, (width / contentW) * width);
    const thumbX =
      (scrollState.scrollLeft / scrollState.maxScrollLeft) * (width - thumbW);
    sb.horizontal = { trackWidth: width, thumbWidth: thumbW, thumbX };
  }
  return Object.keys(sb).length > 0
    ? { scrollOffset, scrollbar: sb }
    : { scrollOffset };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function buildBoxNodeData(input: BoxBuildInput): SkiaNodeData | null {
  const { element, layout, scrollState, theme = "light" } = input;

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
  const presentationShadowTargets = skiaEffects.effects
    ?.filter((effect) => effect.type === "drop-shadow")
    .map((effect) => ({ effect }));

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
    fillV2Style &&
    (fillV2Style.type === "linear-gradient" ||
      fillV2Style.type === "radial-gradient" ||
      fillV2Style.type === "angular-gradient")
      ? fillV2Style
      : undefined;
  // mesh 는 stop(colors/positions) 이 없어 gradientFill(= stop drag 채널) 에 넣을 수 없지만,
  //   box.fill 에는 실려야 한다 — fills.ts 의 SkSL bilinear 셰이더가 이 채널만 소비한다.
  //   누락 시 Preview DOM(fillAdapter 의 SVG mesh)과 Canvas(첫 point 색 단색)가 어긋난다.
  const meshFill =
    fillV2Style && fillV2Style.type === "mesh-gradient"
      ? fillV2Style
      : undefined;
  const topEnabledFill =
    fills && fills.length > 0 ? getTopEnabledFill(fills as FillItem[]) : null;

  // CSS background-image: url(...)
  //   fills 가 shader 를 만들면(gradient/mesh) 그쪽이 이긴다 — 두 채널이 같은 box.fill 을 쓴다.
  const cssBgImageFill =
    (gradientFill ?? meshFill)
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
  } else {
    const [r, g, b] = hexToColor4fChannels(fill.color);
    const bgAlpha = skiaEffects.effects?.some(
      (e: EffectStyle) => e.type === "opacity",
    )
      ? cssColorToAlpha(style.backgroundColor as string | undefined)
      : fill.alpha;
    fillColor = Float32Array.of(r, g, b, bgAlpha);
  }

  // Border radius
  const br = borderRadius ?? 0;

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

  // Overflow — catalog containerStyles 에만 overflow 를 둔 컨테이너도 clip/scroll 이 동작하도록
  //   catalog fallback 포괄(raw props.style 우선). box 경로 element 는 resolved scene tag(element.type).
  const overflow = resolveEffectiveOverflow(element.type, style);
  const clipChildren =
    overflow === "hidden" ||
    overflow === "clip" ||
    overflow === "scroll" ||
    overflow === "auto";

  // Scroll — spec 경로(buildSpecNodeData)와 공유 helper (동일 계약)
  const scrollFields =
    scrollState && (overflow === "scroll" || overflow === "auto")
      ? buildScrollNodeFields(w, h, scrollState)
      : undefined;
  const scrollOffset = scrollFields?.scrollOffset;
  const scrollbar = scrollFields?.scrollbar;

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

  // Stroke — RenderStrokeStyle (color, width, alpha)
  const strokeColor =
    !suppressBorder && stroke?.color
      ? Float32Array.of(
          ...hexToColor4fChannels(stroke.color),
          stroke.alpha ?? 1,
        )
      : undefined;

  const box: NonNullable<SkiaNodeData["box"]> = {
    fillColor,
    ...(cssBgImageFill
      ? { fill: cssBgImageFill }
      : gradientFill
        ? { fill: gradientFill }
        : meshFill
          ? { fill: meshFill }
          : {}),
    borderRadius: br,
    strokeColor,
    strokeWidth: suppressBorder ? undefined : stroke?.width,
    ...(strokeStyleValue ? { strokeStyle: strokeStyleValue } : {}),
  };

  const presentationFillTarget = {
    color: box.fillColor,
    opacityMultiplier: 1,
    ...(gradientFill && topEnabledFill
      ? {
          fillId: topEnabledFill.id,
          gradientColors: gradientFill.colors,
          gradientPositions: gradientFill.positions,
          gradientWidth: w,
          gradientHeight: h,
        }
      : {}),
  };

  const presentationStrokeTargets = strokeColor
    ? [{ color: strokeColor }]
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
    ...(presentationShadowTargets && presentationShadowTargets.length > 0
      ? { presentationShadowTargets }
      : {}),
    ...(skiaEffects.blendMode ? { blendMode: skiaEffects.blendMode } : {}),
    ...(skiaTransform ? { transform: skiaTransform } : {}),
    ...(zIndex !== undefined ? { zIndex } : {}),
    ...(isStackingCtx ? { isStackingContext: true } : {}),
    ...(clipPath ? { clipPath } : {}),
    box,
    presentationFillTargets: [presentationFillTarget],
    ...(presentationStrokeTargets ? { presentationStrokeTargets } : {}),
  } as SkiaNodeData;
}

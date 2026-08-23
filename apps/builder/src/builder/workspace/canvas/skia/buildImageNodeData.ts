/**
 * buildImageNodeData — ImageSprite SkiaNodeData 빌드 로직 추출 (ADR-100 Phase 6)
 *
 * ImageSprite.tsx useMemo (lines 286-322)의 순수 함수 버전.
 * element.props + layout + skImage에서 구축한다.
 *
 * 특수 사항:
 * - skImage는 비동기 로딩 결과를 외부에서 주입 (StoreRenderBridge가 관리)
 * - object-fit 계산 포함 (cover/contain/fill/none)
 */

import type { TokenRef } from "@composition/specs";
import { resolveColor, hexStringToNumber } from "@composition/specs";
import type { CanvasSceneNode } from "../scene/canvasSceneNode";
import type { ComputedLayout } from "../layout/engines/LayoutEngine";
import type { SkiaNodeData } from "./nodeRendererTypes";
import type { Image as SkImage } from "canvaskit-wasm";
import {
  parsePadding,
  getContentBounds,
} from "../styleConversion/paddingUtils";
import {
  colorIntToFloat32,
  cssColorToAlpha,
} from "../styleConversion/styleConverter";
import { fillsToSkiaFillColor } from "../../../panels/styles/utils/fillToSkia";
import { hexToColor4fChannels } from "./themeWatcher";
import { buildBaseNodeProps } from "./buildBaseNodeProps";
import { resolveSkiaVisualRule } from "./resolveSkiaVisualRule";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImageBuildInput {
  element: CanvasSceneNode;
  layout: ComputedLayout | undefined;
  /** 비동기 로드된 SkImage (null이면 placeholder 표시) */
  skImage: SkImage | null;
  /** placeholder 배경 토큰 theme 해석용 — 누락 시 "light" (dark 캔버스에서 light 값) */
  theme?: "light" | "dark";
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
 * - placeholder box (catalog fill base 토큰 theme 해석 배경)
 * - border-radius, effects, visibility
 * - altText (미로드 시)
 */
export function buildImageNodeData(
  input: ImageBuildInput,
): SkiaNodeData | null {
  const { element, layout, skImage, theme = "light" } = input;

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

  // ---------- 배경 (D3) ----------
  // DOM oracle: `.react-aria-Image` 가 `background: var(--bg-muted)` 를 항상 깔고,
  //   사용자 배경이 이를 override 한다. 사용자 배경 채널은 둘 —
  //   ① canonical `fills` (현행 Style 패널 Background — commit sanitize 가
  //     style.backgroundColor 를 비우고 fills 에 기록. DOM 은 preview 가
  //     `fillsToCssBackgroundStyle(fills)` 를 style 위에 merge)
  //   ② legacy inline style.background(-Color) (구 문서 잔존 + shorthand 는 sanitize
  //     필터 대상 아님. DOM 은 `...element.props.style` spread)
  //   우선순위는 buildBoxNodeData 와 동일: fills → solid style bg → catalog fill base
  //   토큰 theme 해석 (Image/Avatar {color.neutral-subtle}, catalog 미보유
  //   Logo/Thumbnail 은 동일 토큰 fallback — 리터럴 고정 시 dark 캔버스에 light 회색).
  //   gradient/url 문자열은 이 경로가 그리지 못하므로(box 경로의 cssBgImageToSkia
  //   미탑재) 토큰 fallback — cssColorToHex 실패 fallback(흰색) 오염 방지.
  const fills = (element as unknown as { fills?: unknown[] }).fills;
  const fillV2Color =
    fills && fills.length > 0
      ? fillsToSkiaFillColor(
          fills as Parameters<typeof fillsToSkiaFillColor>[0],
        )
      : null;

  const userBg = (style.backgroundColor ?? style.background) as
    string | undefined;
  const isSolidUserBg =
    typeof userBg === "string" &&
    userBg !== "" &&
    !userBg.includes("gradient(") &&
    !userBg.includes("url(");

  let fillColor: Float32Array;
  if (fillV2Color) {
    fillColor = fillV2Color;
  } else if (isSolidUserBg) {
    const [r, g, b] = hexToColor4fChannels(converted.fill.color);
    // opacity 는 OpacityEffect 로 노드 전체에 걸린다 — fill 에 이중 적용 금지
    //   (buildBoxNodeData 동일 어법: effect 존재 시 bg 자체 alpha 만 사용)
    const bgAlpha = effects?.some((e) => e.type === "opacity")
      ? cssColorToAlpha(userBg)
      : converted.fill.alpha;
    fillColor = Float32Array.of(r, g, b, bgAlpha);
  } else {
    const placeholderToken =
      resolveSkiaVisualRule(element.type, props?.variant as string | undefined)
        ?.fill?.default.base ?? ("{color.neutral-subtle}" as TokenRef);
    const placeholderResolved = resolveColor(placeholderToken, theme);
    const placeholderHex =
      typeof placeholderResolved === "number"
        ? placeholderResolved
        : hexStringToNumber(placeholderResolved);
    fillColor = colorIntToFloat32(placeholderHex, 1);
  }

  // ---------- Assemble SkiaNodeData ----------
  const box: NonNullable<SkiaNodeData["box"]> = {
    fillColor,
    borderRadius: borderRadius ?? 0,
  };
  const nodeData: SkiaNodeData = {
    type: "image",
    elementId: element.id,
    x,
    y,
    width: w,
    height: h,
    visible,
    // 배경 box — placeholder(미로드)와 로드 경로 양쪽에서 이미지 뒤 배경으로 그린다
    box,
    presentationFillTargets: [{ color: box.fillColor, opacityMultiplier: 1 }],
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
  const presentationShadowTargets = effects
    ?.filter((effect) => effect.type === "drop-shadow")
    .map((effect) => ({ effect }));
  if (presentationShadowTargets && presentationShadowTargets.length > 0) {
    nodeData.presentationShadowTargets = presentationShadowTargets;
  }
  if (blendMode) nodeData.blendMode = blendMode;
  if (skiaTransform) nodeData.transform = skiaTransform;
  if (clipPath) nodeData.clipPath = clipPath;
  if (zIndex !== undefined) nodeData.zIndex = zIndex;
  if (isStackingCtx) nodeData.isStackingContext = true;

  return nodeData;
}

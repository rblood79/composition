/**
 * specBuildHelpers — buildSpecNodeData가 사용하는 순수 헬퍼 함수 (ADR-100 Phase 8)
 *
 * spec shape builder에서 추출한 공통 helper.
 */

import type { Shape, TokenRef } from "@composition/specs";
import { resolveToken } from "@composition/specs";
import { measureWrappedTextHeight } from "../utils/textMeasure";
import { DEFAULT_FONT_FAMILY } from "../../../fonts/customFonts";

// ---------------------------------------------------------------------------
// rearrangeShapesForColumn — Column layout shapes 세로 재배치
// ---------------------------------------------------------------------------

/**
 * Column layout: shapes 위치를 세로 쌓기로 재배치
 *
 * Checkbox/Radio/Switch 등에서 flexDirection: column일 때
 * indicator와 label을 수직 배치한다.
 *
 * indicator 블록의 center X = `centerX + boxSize / 2`를 고정하여
 * 모든 circle(ring, dot)이 동일한 center X를 공유하도록 변경.
 */
export function rearrangeShapesForColumn(
  shapes: Shape[],
  containerWidth: number,
  gap: number,
): void {
  // indicator 크기 찾기 (첫 번째 고정 크기 roundRect/rect/circle)
  let boxSize = 0;
  for (const shape of shapes) {
    if (
      (shape.type === "roundRect" || shape.type === "rect") &&
      typeof shape.width === "number" &&
      shape.width > 0 &&
      shape.width !== containerWidth
    ) {
      boxSize = shape.width;
      break;
    }
    if (shape.type === "circle" && shape.radius > 0) {
      boxSize = shape.radius * 2;
      break;
    }
  }
  if (boxSize === 0) return;

  // indicator 블록 top-left X (box 전체를 수평 중앙 배치)
  const centerX = Math.round((containerWidth - boxSize) / 2);
  // indicator 블록 center X: circle의 center 좌표로 사용 (모든 circle 공통)
  const indicatorCenterX = centerX + boxSize / 2;

  for (const shape of shapes) {
    switch (shape.type) {
      case "roundRect":
      case "rect":
        if (typeof shape.width === "number" && shape.width <= boxSize) {
          shape.x = centerX;
        }
        break;
      case "circle":
        // specShapeConverter가 center → top-left 변환(x - radius)을 수행하므로
        // shape.x에는 center X를 유지해야 한다.
        shape.x = indicatorCenterX;
        shape.y = boxSize / 2;
        break;
      case "line":
        (shape as unknown as { x1: number; x2: number }).x1 += centerX;
        (shape as unknown as { x1: number; x2: number }).x2 += centerX;
        break;
      case "text":
        // 텍스트를 indicator 아래에 배치, 가운데 정렬
        shape.x = 0;
        shape.y = boxSize + gap;
        shape.baseline = "top";
        shape.align = "center";
        shape.maxWidth = containerWidth;
        break;
      case "border":
      case "shadow":
        // target 참조 shape — 위치는 target을 따름
        break;
    }
  }
}

// ---------------------------------------------------------------------------
// normalizeMiddleBaselineTextLineHeight
// ---------------------------------------------------------------------------

function resolveLineHeightValue(value: unknown): number | undefined {
  if (typeof value === "number") {
    return value > 0 ? value : undefined;
  }

  if (typeof value === "string") {
    if (value.startsWith("{")) {
      const resolved = resolveToken(value as TokenRef);
      const numeric =
        typeof resolved === "number"
          ? resolved
          : parseFloat(String(resolved ?? ""));
      return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
    }

    const numeric = parseFloat(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
  }

  return undefined;
}

/**
 * `baseline: middle` 텍스트는 수직 중앙 배치 계산과 실제 Paragraph 렌더링이
 * 동일한 line-height를 공유해야 상하 padding이 대칭으로 보인다.
 *
 * Button spec은 sizeSpec.lineHeight를 갖고 있지만 개별 text shape에는
 * lineHeight를 항상 적지 않으므로, 여기서 middle-baseline 텍스트에 주입한다.
 */
export function normalizeMiddleBaselineTextLineHeight(
  shapes: Shape[],
  sizeSpec: Record<string, unknown>,
): void {
  const resolvedLineHeight = resolveLineHeightValue(sizeSpec.lineHeight);
  if (!resolvedLineHeight) return;

  for (const shape of shapes) {
    if (shape.type !== "text") continue;
    if (shape.baseline !== "middle") continue;
    if (shape.lineHeight !== undefined) continue;
    shape.lineHeight = resolvedLineHeight;
  }
}

// ---------------------------------------------------------------------------
// measureSpecTextMinHeight — 텍스트 줄바꿈 시 최소 높이 계산
// ---------------------------------------------------------------------------

/**
 * Spec shapes 내 텍스트가 word-wrap될 때 필요한 최소 높이를 계산한다.
 * 텍스트가 한 줄에 들어가면 undefined 반환 (auto-height 불필요).
 */
export function measureSpecTextMinHeight(
  shapes: Shape[],
  containerWidth: number,
  sizeSpec: Record<string, unknown>,
  whiteSpace?: string,
  wordBreak?: string,
  overflowWrap?: string,
): number | undefined {
  // ADR-008: nowrap/pre → 텍스트 줄바꿈 없음 → 높이 확장 불필요
  if (whiteSpace === "nowrap" || whiteSpace === "pre") return undefined;

  const paddingY = (sizeSpec.paddingY as number) ?? 8;

  // CSS border-box 보정: border shape에서 borderWidth 추출
  const borderShape = shapes.find((s) => s.type === "border");
  const bgBorderWidth = borderShape
    ? (((borderShape as unknown as Record<string, unknown>)
        .borderWidth as number) ?? 0)
    : 0;

  for (const shape of shapes) {
    if (shape.type !== "text" || !shape.text) continue;

    // fontSize: TokenRef일 수 있으므로 resolveToken으로 해석
    let fontSize = 14;
    if (shape.fontSize !== undefined) {
      if (typeof shape.fontSize === "number") {
        fontSize = shape.fontSize;
      } else if (
        typeof (shape.fontSize as unknown) === "string" &&
        (shape.fontSize as unknown as string).startsWith("{")
      ) {
        const resolved = resolveToken(shape.fontSize as unknown as TokenRef);
        fontSize =
          typeof resolved === "number"
            ? resolved
            : parseFloat(String(resolved)) || 14;
      }
    }

    const fontWeight =
      typeof shape.fontWeight === "number" ? shape.fontWeight : 500;
    const fontFamily = shape.fontFamily || DEFAULT_FONT_FAMILY;

    // maxWidth 계산: specShapesToSkia와 동일한 로직 + border-box 보정
    let maxWidth = shape.maxWidth ?? containerWidth;
    if (shape.x > 0 && shape.maxWidth == null) {
      const effectiveX = shape.x + bgBorderWidth;
      if (shape.align === "center") {
        maxWidth = containerWidth - effectiveX * 2;
      } else {
        maxWidth = containerWidth - effectiveX;
      }
      if (maxWidth < 1) maxWidth = containerWidth;
    }

    const lineHeight = fontSize * 1.2;
    const wrappedHeight = measureWrappedTextHeight(
      shape.text,
      fontSize,
      fontWeight,
      fontFamily,
      maxWidth,
      undefined,
      wordBreak as "normal" | "break-all" | "keep-all" | undefined,
      overflowWrap as "normal" | "break-word" | "anywhere" | undefined,
    );

    // 한 줄이면 auto-height 불필요
    if (wrappedHeight <= lineHeight + 0.5) return undefined;

    // 다중 줄: paddingY * 2 + wrappedHeight
    return paddingY * 2 + wrappedHeight;
  }

  return undefined;
}

/**
 * specBuildHelpers — catalog Canvas 의 텍스트 shape 순수 헬퍼 (ADR-100 Phase 8 에서 추출)
 */

import type { Shape, TokenRef } from "@composition/rendering";
import { resolveToken, snapBorderWidth } from "@composition/rendering";
import { measureWrappedTextHeight } from "../utils/textMeasure";
import { DEFAULT_FONT_FAMILY } from "../../../fonts/customFonts";

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
    ? snapBorderWidth(
        ((borderShape as unknown as Record<string, unknown>)
          .borderWidth as number) ?? 0,
      )
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
    if (
      shape.maxWidth == null &&
      (shape.x > 0 || (shape.paddingRight ?? 0) > 0)
    ) {
      const effectiveX = shape.x + bgBorderWidth;
      if (typeof shape.paddingRight === "number") {
        // specShapesToSkia 와 같은 식 — 우측 padding + border 도 뺀다.
        maxWidth =
          containerWidth - effectiveX - shape.paddingRight - bgBorderWidth;
      } else if (shape.align === "center") {
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

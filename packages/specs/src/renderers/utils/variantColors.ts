/**
 * Variant/Size preset resolvers — Skia/Canvas 공용 (렌더러 무관)
 *
 * 렌더러별 중복을 피하기 위해 공용 helper로 분리.
 */

import type { VariantSpec, SizeSpec } from "../../types";
import { resolveColor, resolveToken, hexStringToNumber } from "./tokenResolver";
// ADR-908 Phase 3-A: Fill token dual-read seam
import { resolveFillTokens } from "../../utils/fillTokens";

/**
 * Variant 색상 세트 (numeric hex — Skia/Canvas 공용)
 *
 * ADR-908 Phase 3-A: fill token dual-read seam — legacy VariantSpec.background* 대신
 * `resolveFillTokens()` 경유. legacy path 에서는 bg/Hover/Pressed/alpha 항상 채워져
 * bit-identical. Phase 3-B spec fill migration 시 hover/pressed 선언 생략 가능.
 */
export function getVariantColors(
  variantSpec: VariantSpec,
  theme: "light" | "dark" = "light",
): {
  bg: number;
  bgHover: number;
  bgPressed: number;
  text: number;
  border?: number;
  borderHover?: number;
  bgAlpha: number;
} {
  const fill = resolveFillTokens(variantSpec);
  const bg = resolveColor(fill.default.base, theme);
  const bgHover = resolveColor(fill.default.hover ?? fill.default.base, theme);
  const bgPressed = resolveColor(
    fill.default.pressed ?? fill.default.base,
    theme,
  );
  const text = resolveColor(variantSpec.text, theme);
  const border = variantSpec.border
    ? resolveColor(variantSpec.border, theme)
    : undefined;
  const borderHover = variantSpec.borderHover
    ? resolveColor(variantSpec.borderHover, theme)
    : undefined;

  const toNum = (v: string | number): number =>
    typeof v === "string" ? hexStringToNumber(v) : (v as number);

  return {
    bg: toNum(bg),
    bgHover: toNum(bgHover),
    bgPressed: toNum(bgPressed),
    text: toNum(text),
    border: border !== undefined ? toNum(border) : undefined,
    borderHover: borderHover !== undefined ? toNum(borderHover) : undefined,
    bgAlpha: fill.alpha ?? 1,
  };
}

/**
 * Size 프리셋 (numeric — Skia/Canvas 공용)
 */
export function getSizePreset(
  sizeSpec: SizeSpec,
  theme: "light" | "dark" = "light",
): {
  height: number;
  paddingX: number;
  paddingY: number;
  fontSize: number;
  borderRadius: number;
  iconSize: number;
  gap: number;
  [key: string]: number | undefined;
} {
  const fontSize = resolveToken(sizeSpec.fontSize, theme);
  const borderRadius = resolveToken(sizeSpec.borderRadius, theme);

  const extra: Record<string, number | undefined> = {};
  const standardKeys = new Set([
    "height",
    "paddingX",
    "paddingY",
    "fontSize",
    "borderRadius",
    "iconSize",
    "gap",
  ]);
  for (const [key, value] of Object.entries(sizeSpec)) {
    if (!standardKeys.has(key) && typeof value === "number") {
      extra[key] = value;
    }
  }

  return {
    height: sizeSpec.height,
    paddingX: sizeSpec.paddingX,
    paddingY: sizeSpec.paddingY,
    fontSize: typeof fontSize === "number" ? fontSize : 14,
    borderRadius: typeof borderRadius === "number" ? borderRadius : 4,
    iconSize: sizeSpec.iconSize ?? 0,
    gap: sizeSpec.gap ?? 0,
    ...extra,
  };
}

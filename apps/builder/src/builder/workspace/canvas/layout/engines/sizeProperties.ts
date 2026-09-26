import { isAutoSizeValue, type SizeAxis } from "@composition/shared";
import { resolveCSSSizeValue, type CSSValueContext } from "./cssValueParser";

export type { SizeAxis };

/** CSS 크기 선언의 공통 키. 측정 스칼라는 WASM layoutTypes 계약을 따른다. */
export const SIZE_STYLE_KEYS = [
  "width",
  "height",
  "minWidth",
  "minHeight",
  "maxWidth",
  "maxHeight",
] as const;

const CONSTRAINT_KEYS = {
  width: ["minWidth", "maxWidth"],
  height: ["minHeight", "maxHeight"],
} as const;

export function isEngineIntrinsicKeyword(value: unknown): value is string {
  return (
    value === "min-content" ||
    value === "max-content" ||
    value === "fit-content"
  );
}

export function isAutoOrIntrinsicSize(value: unknown): boolean {
  return value == null || (typeof value === "string" && isAutoSizeValue(value));
}

export function hasIntrinsicSizeConstraint(
  style: Record<string, unknown> | undefined,
  axis: SizeAxis,
): boolean {
  const [min, max] = CONSTRAINT_KEYS[axis];
  return (
    isEngineIntrinsicKeyword(style?.[min]) ||
    isEngineIntrinsicKeyword(style?.[max])
  );
}

/** 내용 변경 뒤 재측정 필요 여부. % 해소·최종 used size 판정은 엔진이 소유한다. */
export function sizeMayDependOnContent(
  style: Record<string, unknown>,
  axis: SizeAxis,
): boolean {
  const value = style[axis];
  return (
    isAutoOrIntrinsicSize(value) ||
    (typeof value === "string" && value.trim().endsWith("%")) ||
    hasIntrinsicSizeConstraint(style, axis)
  );
}

/** 길이 파서. %는 엔진으로 넘기고 intrinsic 값은 별도 크기 선언 채널에서 보존한다. */
export function parseCSSPropWithContext(
  value: unknown,
  ctx: CSSValueContext = {},
): number | string | undefined {
  if (value === undefined || value === null || value === "" || value === "auto")
    return undefined;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    if (value.endsWith("%")) return value;
    if (isEngineIntrinsicKeyword(value)) return undefined;
    const px = resolveCSSSizeValue(value, ctx);
    if (px !== undefined && px >= 0) return px;
    const num = parseFloat(value);
    if (!isNaN(num)) return num;
  }
  return undefined;
}

/** block/flex/grid와 implicit patch 모두 같은 여섯 크기 선언을 엔진에 전달한다. */
export function applyEngineSizeProperties(
  result: Record<string, unknown>,
  style: Record<string, unknown>,
  ctx: CSSValueContext,
): void {
  for (const key of SIZE_STYLE_KEYS) {
    const value = style[key];
    const resolved = isEngineIntrinsicKeyword(value)
      ? value
      : parseCSSPropWithContext(value, ctx);
    if (resolved !== undefined) result[key] = resolved;
  }
}

export function toEngineDimension(value: string | number): string {
  return typeof value === "number" ? `${value}px` : value;
}

/** 높이 재측정만을 위한 임시 폭. 저작 width/min/max 선언에는 되써 넣지 않는다. */
export function resolveRemeasureStyle(
  style: Record<string, unknown>,
  usedWidth: number,
): Record<string, unknown> {
  if (style.width === usedWidth || style.width === toEngineDimension(usedWidth))
    return style;
  return { ...style, width: usedWidth };
}

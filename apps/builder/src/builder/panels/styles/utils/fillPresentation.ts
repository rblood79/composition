import type { CSSProperties } from "react";
import { fillsToCssBackgroundStyle } from "@composition/shared";

import type { ColorFillItem, FillItem } from "../../../../types/builder/fill.types";
import { FillType, createDefaultColorFill } from "../../../../types/builder/fill.types";
import { normalizeToHex8, toDisplayHex } from "./colorUtils";

export const VIRTUAL_FILL_ID = "__virtual_fill__";

export function resolveFillSeedColor(backgroundColor?: string | null): string {
  return normalizeToHex8(backgroundColor ?? "#FFFFFF", "#FFFFFFFF");
}

export function createVirtualColorFill(
  backgroundColor?: string | null,
): ColorFillItem {
  return {
    ...createDefaultColorFill(resolveFillSeedColor(backgroundColor)),
    id: VIRTUAL_FILL_ID,
  };
}

export function buildFillSwatchStyle(
  fill: FillItem | null | undefined,
): CSSProperties | undefined {
  if (!fill || fill.type === FillType.Color) return undefined;

  const css = fillsToCssBackgroundStyle([fill]);
  if (!css.backgroundImage && !css.backgroundColor) return undefined;

  return {
    backgroundColor: css.backgroundColor,
    backgroundImage: css.backgroundImage,
    backgroundSize: css.backgroundSize,
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  };
}

export function getFillDisplayLabel(fill: FillItem): string {
  switch (fill.type) {
    case FillType.Color:
      // 다른 색 칸 (Border · Shadow · 피커 HEX) 과 같은 표기 — `#` 없는 대문자, 알파가 있으면 8자리
      return toDisplayHex(normalizeToHex8(fill.color));
    case FillType.LinearGradient:
      return "Linear";
    case FillType.RadialGradient:
      return "Radial";
    case FillType.AngularGradient:
      return "Angular";
    case FillType.MeshGradient:
      return "Mesh";
    case FillType.Image:
      return "Image";
    default:
      return "";
  }
}

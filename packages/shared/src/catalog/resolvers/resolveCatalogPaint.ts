import type {
  ComponentRuleSize,
  ComponentRuleVariant,
} from "../../types/composition-document.types";

export type CatalogInteractionState = "default" | "hover" | "pressed";

export interface ResolveCatalogPaintInput {
  variant: ComponentRuleVariant | undefined;
  size: ComponentRuleSize | undefined;
  props: Readonly<Record<string, unknown>>;
  style: Readonly<Record<string, unknown>> | undefined;
  interactionState: CatalogInteractionState;
}

export interface ResolvedCatalogPaint {
  backgroundColor?: string;
  color?: string;
  borderColor?: string;
  /** Catalog 고유 opacity 배율. canonical `_fillBgAlpha`는 renderer adapter가 별도로 곱한다. */
  backgroundAlpha: number;
  staticTrackWash: boolean;
  hasVisibleBoxPaint: boolean;
  hasOpaqueCatalogBackground: boolean;
}

const TRANSPARENT_TOKEN = "{color.transparent}";
const ACCENT_TOKEN = "{color.accent}";

/**
 * Catalog variant와 authored semantic props에서 root symbolic paint를 선택한다.
 *
 * DOM/Canvas 객체나 global store를 읽지 않는 O(1) pure resolver다. component type을
 * 입력받지 않고 fill/border/fillBar 같은 data channel 존재 여부만으로 분기한다.
 */
export function resolveCatalogPaint({
  variant,
  size,
  props,
  style,
  interactionState,
}: ResolveCatalogPaintInput): ResolvedCatalogPaint {
  const fill = variant?.fill;
  const colors = variant?.colors;

  const fillStyle = (props.fillStyle as string | undefined) ?? "fill";
  const isOutline = fillStyle === "outline";
  const isSubtle = fillStyle === "subtle";
  const isQuiet = props.isQuiet === true && fill?.quiet != null;
  const fillStates = isQuiet
    ? fill?.quiet
    : isOutline
      ? fill?.outline
      : isSubtle
        ? fill?.subtle
        : fill?.default;

  const isSelected = props.isSelected === true;
  const isEmphasized = props.isEmphasized === true;
  const isShowAll = props._isShowAll === true;
  const stateBackground = isSelected
    ? isEmphasized
      ? (fill?.default.emphasizedSelected ?? fill?.default.selected)
      : fill?.default.selected
    : interactionState === "hover"
      ? (fillStates?.hover ?? fillStates?.base)
      : interactionState === "pressed"
        ? (fillStates?.pressed ?? fillStates?.base)
        : fillStates?.base;

  const staticColor = props.staticColor;
  const staticHex =
    staticColor === "black"
      ? "#000000"
      : staticColor === "white"
        ? "#ffffff"
        : undefined;
  const catalogAlpha = fill?.alpha ?? 1;
  const staticOnOpaqueBackground =
    staticHex != null &&
    !isOutline &&
    !isSubtle &&
    stateBackground != null &&
    stateBackground !== TRANSPARENT_TOKEN &&
    catalogAlpha !== 0;
  const staticTrackWash = staticOnOpaqueBackground && variant?.fillBar != null;
  const staticTextColor =
    staticHex == null
      ? undefined
      : staticOnOpaqueBackground && !staticTrackWash
        ? staticHex === "#000000"
          ? "#ffffff"
          : "#000000"
        : staticHex;

  const backgroundColor = isShowAll
    ? TRANSPARENT_TOKEN
    : ((style?.backgroundColor as string | undefined) ??
      (staticOnOpaqueBackground ? staticHex : undefined) ??
      stateBackground ??
      (isOutline ? TRANSPARENT_TOKEN : undefined));
  const color = isShowAll
    ? ACCENT_TOKEN
    : ((style?.color as string | undefined) ??
      staticTextColor ??
      (isSelected
        ? isEmphasized
          ? (colors?.emphasizedSelectedText ?? colors?.selectedText)
          : colors?.selectedText
        : isOutline
          ? (colors?.outlineText ?? colors?.text)
          : isSubtle
            ? (colors?.subtleText ?? colors?.text)
            : interactionState === "hover" && colors?.textHover
              ? colors.textHover
              : colors?.text));

  const variantBorderColor = isSelected
    ? isEmphasized
      ? (colors?.emphasizedSelectedBorder ?? colors?.selectedBorder)
      : colors?.selectedBorder
    : isOutline
      ? (colors?.outlineBorder ?? colors?.border)
      : interactionState === "hover" && colors?.borderHover
        ? colors.borderHover
        : colors?.border;
  const hasBorderWidthChannel =
    size?.borderWidth != null || style?.borderWidth != null;
  const staticBorderEligible =
    variantBorderColor != null &&
    (variantBorderColor !== TRANSPARENT_TOKEN || hasBorderWidthChannel);
  const borderColor = isShowAll
    ? undefined
    : ((style?.borderColor as string | undefined) ??
      (staticHex != null && staticBorderEligible
        ? staticHex
        : variantBorderColor));

  const hasVisibleBoxPaint =
    style?.backgroundColor != null ||
    (backgroundColor != null && catalogAlpha !== 0) ||
    !!borderColor;
  const hasOpaqueCatalogBackground =
    (stateBackground != null &&
      stateBackground !== TRANSPARENT_TOKEN &&
      catalogAlpha !== 0) ||
    !!borderColor;

  return {
    backgroundColor,
    color,
    borderColor,
    backgroundAlpha: catalogAlpha * (staticTrackWash ? 0.25 : 1),
    staticTrackWash,
    hasVisibleBoxPaint,
    hasOpaqueCatalogBackground,
  };
}

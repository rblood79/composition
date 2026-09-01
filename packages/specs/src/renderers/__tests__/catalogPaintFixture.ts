/**
 * Phase 2 cutover 전 shape oracle를 보존하는 test-only adapter.
 *
 * production renderer는 injected paint를 필수로 받고 상태를 계산하지 않는다. 기존 geometry/
 * snapshot tests는 이 fixture로 cutover 직전 paint를 만들어 동일 assertion을 유지한다.
 */
import type { ComponentState, SizeSpec } from "../../types";
import { buildCatalogShapes as renderCatalogShapes } from "../buildCatalogShapes";
import type { CatalogResolvedPaint } from "../catalogPaint";
import {
  getSkiaPrimitive as getPrimitive,
  type SkiaPrimitiveDrawFn,
} from "../skiaPrimitives";
import type { ComponentVisualRule } from "../utils/resolveComponentVisual";

export {
  resolveLeadingIconName,
  resolveLeadingSlot,
  resolveSegmentedRadius,
  resolveSelectionSlot,
  resolveTreeIndent,
} from "../buildCatalogShapes";
export {
  canMaterializeSkiaPresentationFill,
  getSkiaPrimitiveMode,
} from "../skiaPrimitives";

function resolveFixturePaint(
  visual: ComponentVisualRule | undefined,
  props: Record<string, unknown>,
  size: SizeSpec,
  state: ComponentState = "default",
  styleInput?: Record<string, unknown>,
): CatalogResolvedPaint {
  const style =
    styleInput ?? (props.style as Record<string, unknown> | undefined);
  const fill = visual?.fill;
  const fillStyle = (props.fillStyle as string | undefined) ?? "fill";
  const isOutline = fillStyle === "outline";
  const isSubtle = fillStyle === "subtle";
  const fillStates =
    props.isQuiet === true && fill?.quiet != null
      ? fill.quiet
      : isOutline
        ? fill?.outline
        : isSubtle
          ? fill?.subtle
          : fill?.default;
  const isSelected = props.isSelected === true;
  const isEmphasized = props.isEmphasized === true;
  const stateBackground = isSelected
    ? isEmphasized
      ? (fill?.default.emphasizedSelected ?? fill?.default.selected)
      : fill?.default.selected
    : state === "hover"
      ? (fillStates?.hover ?? fillStates?.base)
      : state === "pressed"
        ? (fillStates?.pressed ?? fillStates?.base)
        : fillStates?.base;
  const staticHex =
    props.staticColor === "black"
      ? "#000000"
      : props.staticColor === "white"
        ? "#ffffff"
        : undefined;
  const catalogAlpha = fill?.alpha ?? 1;
  const staticOnOpaqueBackground =
    staticHex != null &&
    !isOutline &&
    !isSubtle &&
    stateBackground != null &&
    stateBackground !== "{color.transparent}" &&
    catalogAlpha !== 0;
  const staticTrackWash = staticOnOpaqueBackground && visual?.fillBar != null;
  const staticTextColor =
    staticHex == null
      ? undefined
      : staticOnOpaqueBackground && !staticTrackWash
        ? staticHex === "#000000"
          ? "#ffffff"
          : "#000000"
        : staticHex;
  const isShowAll = props._isShowAll === true;
  const backgroundColor = isShowAll
    ? "{color.transparent}"
    : ((style?.backgroundColor as string | undefined) ??
      (staticOnOpaqueBackground ? staticHex : undefined) ??
      stateBackground ??
      (isOutline ? "{color.transparent}" : undefined));
  const color = isShowAll
    ? "{color.accent}"
    : ((style?.color as string | undefined) ??
      staticTextColor ??
      (isSelected
        ? isEmphasized
          ? (visual?.emphasizedSelectedText ?? visual?.selectedText)
          : visual?.selectedText
        : isOutline
          ? (visual?.outlineText ?? visual?.text)
          : isSubtle
            ? (visual?.subtleText ?? visual?.text)
            : state === "hover" && visual?.textHover
              ? visual.textHover
              : visual?.text));
  const variantBorderColor = isSelected
    ? isEmphasized
      ? (visual?.emphasizedSelectedBorder ?? visual?.selectedBorder)
      : visual?.selectedBorder
    : isOutline
      ? (visual?.outlineBorder ?? visual?.border)
      : state === "hover" && visual?.borderHover
        ? visual.borderHover
        : visual?.border;
  const staticBorderEligible =
    variantBorderColor != null &&
    (variantBorderColor !== "{color.transparent}" ||
      size.borderWidth != null ||
      style?.borderWidth != null);
  const borderColor = isShowAll
    ? undefined
    : ((style?.borderColor as string | undefined) ??
      (staticHex != null && staticBorderEligible
        ? staticHex
        : variantBorderColor));

  return {
    backgroundColor,
    color,
    borderColor,
    backgroundAlpha: catalogAlpha * (staticTrackWash ? 0.25 : 1),
    staticTrackWash,
    hasVisibleBoxPaint:
      style?.backgroundColor != null ||
      (backgroundColor != null && catalogAlpha !== 0) ||
      !!borderColor,
    hasOpaqueCatalogBackground:
      (stateBackground != null &&
        stateBackground !== "{color.transparent}" &&
        catalogAlpha !== 0) ||
      !!borderColor,
  };
}

function preserveLegacyPrimitiveFallbacks(
  key: string,
  paint: CatalogResolvedPaint,
  visual: ComponentVisualRule | undefined,
  props: Record<string, unknown>,
): CatalogResolvedPaint {
  if (
    key === "switch_toggle" &&
    (paint.backgroundColor == null ||
      paint.backgroundColor === "{color.transparent}")
  ) {
    return { ...paint, backgroundColor: "{color.accent-subtle}" };
  }
  if (
    key === "gridlist_card" &&
    props.isSelected === true &&
    paint.borderColor == null
  ) {
    return { ...paint, borderColor: "{color.accent}" };
  }
  if (
    key === "listbox_item" &&
    props.isSelected === true &&
    paint.backgroundColor == null
  ) {
    return {
      ...paint,
      backgroundColor:
        visual?.fill?.default.selected ?? "{color.accent-subtle}",
      hasVisibleBoxPaint: true,
    };
  }
  return paint;
}

export function buildCatalogShapes(
  visual: ComponentVisualRule | undefined,
  props: Record<string, unknown>,
  size: SizeSpec,
  state: ComponentState = "default",
  textDecoration?: string,
  nodeType?: string,
) {
  return renderCatalogShapes(
    visual,
    resolveFixturePaint(visual, props, size, state),
    props,
    size,
    textDecoration,
    nodeType,
  );
}

type PrimitiveContext = Omit<Parameters<SkiaPrimitiveDrawFn>[0], "paint"> & {
  paint?: CatalogResolvedPaint;
};

export function getSkiaPrimitive(
  key: string,
): ((ctx: PrimitiveContext) => ReturnType<SkiaPrimitiveDrawFn>) | undefined {
  const draw = getPrimitive(key);
  if (!draw) return undefined;
  return (ctx) => {
    const paint =
      ctx.paint ??
      resolveFixturePaint(
        ctx.visual,
        ctx.props,
        ctx.size,
        "default",
        ctx.style,
      );
    return draw({
      ...ctx,
      paint: preserveLegacyPrimitiveFallbacks(
        key,
        paint,
        ctx.visual,
        ctx.props,
      ),
    });
  };
}

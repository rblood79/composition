import {
  getFillBehavior,
  isValidFillFactor,
  resolveEffectiveFill,
  type SizeAxis,
  type FillParentContext,
  type BreakpointName,
} from "@composition/shared";
import type { Element } from "../../../types/core/store.types";
import {
  buildResponsiveStyleOverride,
  shouldWriteBreakpointOverride,
} from "./responsiveWriteRouting";
import {
  inferFillGrow,
  inferSizeMode,
  resolveSizeMode,
  sizeModeToStyleUpdates,
} from "./sizeModeResolver";

export interface SizingEdit {
  axis: SizeAxis;
  mode: "fill" | "css" | "reset";
  value?: string;
  factor?: number;
}

/** 단일 축 계획. 호출자가 모든 대상의 계획을 먼저 검증한 뒤 하나의 history로 적용한다. */
export function buildSizingEdit(
  element: Element,
  effective: Element,
  edit: SizingEdit,
  context: FillParentContext,
  breakpoint: BreakpointName,
): Partial<Element> | null {
  const { axis, mode } = edit;
  const effectiveStyle = (effective.props.style ?? {}) as Record<
    string,
    unknown
  >;
  const previous = resolveEffectiveFill(effective, breakpoint)?.[axis];
  const tier = shouldWriteBreakpointOverride(
    element.responsive,
    axis,
    breakpoint,
  )
    ? breakpoint
    : "desktop";
  let responsive = element.responsive;
  const sizing = { ...element.sizing };
  const axes = tier === "desktop" ? sizing : { ...responsive?.sizing?.[tier] };
  const style = { ...((element.props.style ?? {}) as Record<string, unknown>) };
  const setStyle = (key: string, value: string) => {
    if (tier === "desktop") {
      if (value === "") delete style[key];
      else style[key] = value;
    } else {
      responsive = buildResponsiveStyleOverride(responsive, key, value, tier);
    }
  };
  if (mode === "fill") {
    if (!getFillBehavior(axis, effectiveStyle, context)) return null;
    if (edit.factor !== undefined && !isValidFillFactor(edit.factor))
      return null;
    const legacyGrow = inferFillGrow(
      effectiveStyle,
      axis,
      context.display,
      context.flexDirection,
    );
    // 읽기/재선택만으로 기존 CSS grow를 migration하거나 clamp하지 않는다.
    if (
      edit.factor === undefined &&
      (previous ||
        inferSizeMode(
          effectiveStyle,
          axis,
          context.display,
          context.flexDirection,
        ) === "fill")
    )
      return {};
    axes[axis] = { factor: edit.factor ?? previous?.factor ?? legacyGrow ?? 1 };
    const cleanup = resolveSizeMode(
      "fixed",
      axis,
      context.display,
      context.flexDirection,
    ).remove;
    setStyle(axis, "");
    for (const key of cleanup) setStyle(key, "");
  } else {
    if (mode === "reset") delete axes[axis];
    else axes[axis] = null;
    const value = mode === "reset" ? "" : (edit.value ?? "");
    const cleanup = sizeModeToStyleUpdates(
      resolveSizeMode(
        value === "fit-content" ? "fit" : "fixed",
        axis,
        context.display,
        context.flexDirection,
        value,
        value,
      ),
    );
    for (const [key, next] of Object.entries(cleanup))
      setStyle(key, key === axis ? value : next);
  }
  if (tier !== "desktop")
    responsive = {
      ...responsive,
      sizing: { ...responsive?.sizing, [tier]: axes },
    };
  return { sizing, responsive, props: { ...element.props, style } };
}

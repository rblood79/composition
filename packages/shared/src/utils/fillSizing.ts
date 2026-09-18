import type { FillAxes, SizeAxis } from "../types/sizing.types";
import type {
  BreakpointName,
  ElementResponsiveConfig,
} from "../types/responsive.types";

export interface FillSizingSource {
  sizing?: FillAxes;
  responsive?: ElementResponsiveConfig;
}
export interface FillParentContext {
  display: string;
  flexDirection?: string;
  writingMode?: string;
}
export type FillBehavior =
  "fraction" | "stretch" | "grid-stretch" | "flow-stretch";

export function isValidFillFactor(value: number): boolean {
  return Number.isFinite(value) && value >= 1 && value <= 1000;
}

/** 축 객체 단위 덮어쓰기. null을 보존하고 factor를 leaf merge하지 않는다. */
export function resolveEffectiveFill(
  node: FillSizingSource,
  breakpoint: BreakpointName = "desktop",
): FillAxes | undefined {
  if (breakpoint === "desktop" || !node.responsive?.sizing) return node.sizing;
  return {
    ...node.sizing,
    ...node.responsive.sizing.tablet,
    ...(breakpoint === "mobile" ? node.responsive.sizing.mobile : {}),
  };
}

/** ref의 축·tier별 상속. 기존 CSS/visibility 병합은 호출자가 소유한다. */
export function mergeFillSizing(
  origin: FillSizingSource,
  override: FillSizingSource,
): FillSizingSource {
  const sizing =
    origin.sizing || override.sizing
      ? { ...origin.sizing, ...override.sizing }
      : undefined;
  const a = origin.responsive?.sizing;
  const b = override.responsive?.sizing;
  const responsive =
    origin.responsive || override.responsive
      ? {
          ...origin.responsive,
          ...override.responsive,
          ...(a || b
            ? {
                sizing: {
                  ...(a?.tablet || b?.tablet
                    ? { tablet: { ...a?.tablet, ...b?.tablet } }
                    : {}),
                  ...(a?.mobile || b?.mobile
                    ? { mobile: { ...a?.mobile, ...b?.mobile } }
                    : {}),
                },
              }
            : {}),
        }
      : undefined;
  return {
    ...(sizing ? { sizing } : {}),
    ...(responsive ? { responsive } : {}),
  };
}

export function getFillBehavior(
  axis: SizeAxis,
  style: Record<string, unknown>,
  parent: FillParentContext,
): FillBehavior | null {
  if (style.position === "absolute" || style.position === "fixed") return null;
  if (parent.writingMode && parent.writingMode !== "horizontal-tb") return null;
  if (parent.display === "flex" || parent.display === "inline-flex") {
    const column = parent.flexDirection?.startsWith("column") ?? false;
    return (axis === "height") === column ? "fraction" : "stretch";
  }
  if (parent.display === "grid" || parent.display === "inline-grid")
    return "grid-stretch";
  if (
    (parent.display === "block" || parent.display === "inline-block") &&
    axis === "width"
  )
    return "flow-stretch";
  return null;
}

export function getRatioDependentAxis(
  style: Record<string, unknown>,
  fill?: FillAxes,
): SizeAxis | null {
  const ratio = String(style.aspectRatio ?? "").trim();
  if (!ratio || ratio === "auto") return null;
  const widthIndependent =
    !!fill?.width ||
    (style.width != null && style.width !== "" && style.width !== "auto");
  const heightIndependent =
    !!fill?.height ||
    (style.height != null && style.height !== "" && style.height !== "auto");
  if (widthIndependent && !heightIndependent) return "height";
  if (heightIndependent && !widthIndependent) return "width";
  return null;
}

/**
 * catalog/origin/instance/tier 해석 후 effective style에서 렌더용 CSS만 반환한다.
 * authored style에 쓰지 않는다. marker 없는 CSS-only 노드는 변경하지 않는다.
 */
export function resolveFillProjection(
  fill: FillAxes | undefined,
  style: Record<string, unknown>,
  parent: FillParentContext,
): Record<string, string | number> {
  const projected: Record<string, string | number> = {};
  for (const axis of ["width", "height"] as const) {
    const intent = fill?.[axis];
    if (!intent || !isValidFillFactor(intent.factor)) continue;
    const behavior = getFillBehavior(axis, style, parent);
    if (!behavior) continue;
    projected[axis] = "auto";
    if (behavior === "fraction") {
      projected.flexGrow = intent.factor;
      projected.flexShrink = 1;
      projected.flexBasis = "0px";
      const min = axis === "width" ? "minWidth" : "minHeight";
      if (style[min] == null || style[min] === "" || style[min] === "auto")
        projected[min] = "0px";
    } else if (behavior === "stretch") {
      projected.alignSelf = "stretch";
    } else if (behavior === "grid-stretch") {
      projected[axis === "width" ? "justifySelf" : "alignSelf"] = "stretch";
    }
  }
  // Ratio 종속 축의 auto가 부모 stretch로 무효화되지 않게 한다.
  const dependent = getRatioDependentAxis(style, fill);
  if (dependent && (fill?.width !== undefined || fill?.height !== undefined)) {
    const behavior = getFillBehavior(dependent, style, parent);
    if (behavior === "stretch") projected.alignSelf = "start";
    if (behavior === "grid-stretch")
      projected[dependent === "width" ? "justifySelf" : "alignSelf"] = "start";
  }
  return projected;
}

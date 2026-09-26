import type { FillAxes, SizeAxis } from "../types/sizing.types";
import type {
  BreakpointName,
  ElementResponsiveConfig,
} from "../types/responsive.types";
import { isBodyType } from "../domain/predicates";

export interface FillSizingSource {
  sizing?: FillAxes;
  responsive?: ElementResponsiveConfig;
}
export interface FillParentContext {
  display: string;
  flexDirection?: string;
  writingMode?: string;
  /**
   * 부모가 그 축에 크기를 갖는가 (명시 길이·% · 부모 자신의 Fill · body). 없으면 (hug) fraction Fill 은
   * `flex-basis: auto` 로 내려 콘텐츠 크기를 유지한다 — basis 0 이면 hug 부모 안에서 Chrome 도 엔진도
   * 항목이 pad/border 만 남기고 무너진다 (Button 30 → 10, 2026-09-18 사용자 보고). 생략 = 정해진 것으로 본다.
   */
  definite?: { width?: boolean; height?: boolean };
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

/**
 * ref의 축·tier별 상속. `responsive.styles` 는 **키 × tier**, `visibility` 는 tier 단위로 origin 위에
 * 얹는다 — instance (또는 조합 자식 patch) 가 한 키의 tier 값을 쓰면 origin 의 다른 키 · 다른 tier 는
 * 그대로 상속된다 (style 의 키 단위 병합과 같은 규칙, ADR-236 후속 2026-09-26). 종전엔 얕은 병합이라
 * override 에 styles 가 하나라도 있으면 origin 의 tier styles 전체가 가려졌다.
 */
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
  const originStyles = origin.responsive?.styles as
    Record<string, Record<string, unknown> | undefined> | undefined;
  const overrideStyles = override.responsive?.styles as
    Record<string, Record<string, unknown> | undefined> | undefined;
  let styles: Record<string, Record<string, unknown>> | undefined;
  if (originStyles || overrideStyles) {
    styles = {};
    for (const key of new Set([
      ...Object.keys(originStyles ?? {}),
      ...Object.keys(overrideStyles ?? {}),
    ])) {
      styles[key] = { ...originStyles?.[key], ...overrideStyles?.[key] };
    }
  }
  const visibility =
    origin.responsive?.visibility || override.responsive?.visibility
      ? { ...origin.responsive?.visibility, ...override.responsive?.visibility }
      : undefined;
  const responsive =
    origin.responsive || override.responsive
      ? {
          ...origin.responsive,
          ...override.responsive,
          ...(styles ? { styles } : {}),
          ...(visibility ? { visibility } : {}),
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

const AUTO_SIZE_VALUES = new Set([
  "",
  "auto",
  "fit-content",
  "min-content",
  "max-content",
]);

/** 크기 문자열이 내용 기반 (비었거나 auto · fit/min/max-content) 인가 — 명시 길이/% 가 아니다 */
export function isAutoSizeValue(value: string): boolean {
  return AUTO_SIZE_VALUES.has(value.trim());
}

/**
 * 노드가 그 축에 크기를 갖는가 — 명시 길이/% (auto·fit/min/max-content 제외) · 자기 Fill marker ·
 * legacy grow/stretch (부모 문맥이 있을 때) · body. 부모 Fill 의 `definite` 입력을 만드는 데 쓴다.
 */
export function hasDefiniteAxisSize(
  node: { type?: string } & FillSizingSource,
  style: Record<string, unknown>,
  axis: SizeAxis,
  breakpoint: BreakpointName = "desktop",
  grandparent?: FillParentContext,
): boolean {
  if (isBodyType(node.type)) return true;
  const value = style[axis];
  if (typeof value === "number") return true;
  if (typeof value === "string" && !isAutoSizeValue(value)) return true;
  const fill = resolveEffectiveFill(node, breakpoint)?.[axis];
  if (fill && isValidFillFactor(fill.factor)) return true;
  if (grandparent) {
    const behavior = getFillBehavior(axis, style, grandparent);
    const grow = Number(style.flexGrow);
    if (behavior === "fraction" && Number.isFinite(grow) && grow > 0)
      return true;
    if (
      (behavior === "stretch" || behavior === "grid-stretch") &&
      (style.alignSelf === "stretch" || style.justifySelf === "stretch")
    )
      return true;
  }
  return false;
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
      // hug 부모 (그 축 크기 없음) 에서는 나눌 공간이 없다 — 콘텐츠 basis 로 hug 처럼 놓이고, 부모가
      // 크기를 얻으면 남은 공간을 factor 로 나눈다 (Figma: hug 부모 안의 fill = hug).
      projected.flexBasis = parent.definite?.[axis] === false ? "auto" : "0px";
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

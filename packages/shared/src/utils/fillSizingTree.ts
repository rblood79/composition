import { resolveComponentRule } from "../catalog/resolvers/resolveComponentRule";
import {
  getResponsiveValueWithCascade,
  isResponsiveEligibleStyleProp,
} from "../types/responsive.types";
import type { BreakpointName } from "../types/responsive.types";
import type { CompositionDocument } from "../types/composition-document.types";
import { resolveEffectiveFill, resolveFillProjection } from "./fillSizing";
import type { FillSizingSource, FillParentContext } from "./fillSizing";

export interface FillTreeNode extends FillSizingSource {
  id: string;
  type?: string;
  parent_id?: string | null;
  props?: Record<string, unknown>;
}

/** catalog 선언 유무를 보존한다. 토큰은 CSS/엔진의 기존 해석기가 해석한다. */
export function getSizingEffectiveStyle(
  node: FillTreeNode,
  breakpoint: BreakpointName,
  document?: CompositionDocument,
): Record<string, unknown> {
  const rule = node.type
    ? resolveComponentRule(node.type, document)
    : undefined;
  const structure = rule?.structure;
  const size = rule?.sizes[String(node.props?.size ?? rule.defaultSize)];
  const style: Record<string, unknown> = {
    ...(structure?.containerStyles ?? {}),
    ...(structure?.composition?.layout
      ? { display: structure.composition.layout }
      : {}),
    ...(structure?.composition?.containerStyles ?? {}),
    ...(size?.minWidth != null ? { minWidth: size.minWidth } : {}),
    ...(size?.minHeight != null ? { minHeight: size.minHeight } : {}),
    ...((node.props?.style as Record<string, unknown>) ?? {}),
  };
  if (breakpoint !== "desktop") {
    for (const [key, value] of Object.entries(node.responsive?.styles ?? {})) {
      if (value && isResponsiveEligibleStyleProp(key))
        style[key] = getResponsiveValueWithCascade(
          value,
          breakpoint,
          style[key],
        );
    }
  }
  return style;
}

/** 1회 수집의 부모 스타일 캐시. display:contents는 실제 layout parent까지 건너뛴다. */
export function createFillTreeResolver(
  nodes: ReadonlyMap<string, FillTreeNode>,
  document?: CompositionDocument,
) {
  const cache = new Map<string, Record<string, unknown>>();
  const styleOf = (node: FillTreeNode, breakpoint: BreakpointName) => {
    const key = `${breakpoint}:${node.id}`;
    let style = cache.get(key);
    if (!style) {
      style = getSizingEffectiveStyle(node, breakpoint, document);
      cache.set(key, style);
    }
    return style;
  };
  return (node: FillTreeNode, breakpoint: BreakpointName) => {
    let parent = node.parent_id ? nodes.get(node.parent_id) : undefined;
    const visited = new Set<string>([node.id]);
    let parentStyle: Record<string, unknown> = {};
    while (parent && !visited.has(parent.id)) {
      visited.add(parent.id);
      parentStyle = styleOf(parent, breakpoint);
      if (parentStyle.display !== "contents") break;
      parent = parent.parent_id ? nodes.get(parent.parent_id) : undefined;
    }
    const context: FillParentContext = {
      display: String(parentStyle.display ?? "block"),
      flexDirection: String(parentStyle.flexDirection ?? "row"),
      writingMode: String(parentStyle.writingMode ?? "horizontal-tb"),
    };
    const style = styleOf(node, breakpoint);
    const fill = resolveEffectiveFill(node, breakpoint);
    return {
      style,
      fill,
      context,
      projection: resolveFillProjection(fill, style, context),
    };
  };
}

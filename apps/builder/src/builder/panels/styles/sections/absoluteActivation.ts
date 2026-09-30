import type { BreakpointName } from "@composition/shared";
import { parsePadding4Way } from "@composition/specs";
import { useStore } from "../../../stores";
import { resolveBorderGeometry } from "../../../workspace/canvas/styleConversion/borderGeometry";
import { getSceneBounds } from "../../../workspace/canvas/skia/renderCommands";
import type { BoundingBox } from "../../../workspace/canvas/selection/types";
import { resolveResponsiveStyleMap } from "../../../workspace/canvas/layout/resolveResponsive";
import { resolveContainerStylesFallback } from "../../../workspace/canvas/layout/engines/implicitStyles";
import type { CanvasLayoutNode } from "../../../workspace/canvas/layout/layoutNode";
import { resolveAbsolutePositionActivationStyles } from "./transformUtils";

function resolveAbsoluteContainingBlockBounds(
  parent: CanvasLayoutNode,
  parentBounds: BoundingBox,
  activeBreakpoint: BreakpointName,
): BoundingBox {
  const rawStyle = (parent.props?.style ?? {}) as Record<string, unknown>;
  const responsiveStyle = resolveResponsiveStyleMap(
    rawStyle,
    parent.responsive,
    activeBreakpoint,
  );
  const type = parent.type.toLowerCase();
  const style = {
    ...resolveContainerStylesFallback(type, responsiveStyle),
    ...responsiveStyle,
  };
  const padding = parsePadding4Way(style);
  // ADR-219 — 변별 폭은 helper 하나로 (longhand ?? shorthand ?? border 단축)
  const { widths } = resolveBorderGeometry(style as Record<string, unknown>);
  const borderTop = widths[0];
  const borderLeft = widths[3];

  // Skia absolute layout은 부모 border-box가 아닌 border+padding 이후의 콘텐츠
  // 원점을 left/top 0으로 사용한다. 토글 전환도 동일 원점을 써야 시각 좌표가 보존된다.
  return {
    ...parentBounds,
    x: parentBounds.x + borderLeft + padding.left,
    y: parentBounds.y + borderTop + padding.top,
  };
}

/**
 * The old store's Flow→Absolute styles of one element (ADR-224 §6.1): under a flex parent its
 * scene box becomes left/top from the parent's content origin; otherwise `position` only. Each
 * element of a multi-selection uses its own parent and bounds (live 2026-09-18).
 */
export function storeAbsoluteActivationStyles(
  elementId: string,
): Record<string, string> {
        const state = useStore.getState();
        const element = state.elementsMap.get(elementId);
        const parentId = element?.parent_id;
        const parent = parentId ? state.elementsMap.get(parentId) : undefined;
        if (!parent || !parentId) return { position: "absolute" };
        const parentStyle = resolveResponsiveStyleMap(
          (parent.props?.style ?? {}) as Record<string, unknown>,
          parent.responsive,
          state.activeBreakpoint,
        );
        const display = String(
          parentStyle.display ??
            resolveContainerStylesFallback(
              parent.type.toLowerCase(),
              parentStyle,
            ).display ??
            "",
        );
        if (display !== "flex" && display !== "inline-flex") {
          return { position: "absolute" };
        }
        const parentBounds = getSceneBounds(parentId);
        return (
          resolveAbsolutePositionActivationStyles(
            getSceneBounds(elementId),
            parentBounds
              ? resolveAbsoluteContainingBlockBounds(
                  parent,
                  parentBounds,
                  state.activeBreakpoint,
                )
              : parentBounds,
          ) ?? { position: "absolute" }
        );
}

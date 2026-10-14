import { OverlayArrow } from "react-aria-components/Popover";
import {
  Tooltip as AriaTooltip,
  TooltipProps as AriaTooltipProps,
} from "react-aria-components/Tooltip";
import { composeRenderProps } from "react-aria-components/composeRenderProps";
import { createContext, useContext } from "react";
import type { ComponentSize } from "../types";

/**
 * The tooltip's placement, handed down by the shared `TooltipTrigger` (S2 1.8 `TooltipTrigger`
 * owns `placement` · `offset` · `crossOffset` · `shouldFlip` · `containerPadding` — 2026-10-14 D2
 * 정렬). A Tooltip's own props win over the context's; undefined keeps RAC's default.
 */
export const TooltipPlacementContext = createContext<
  Pick<
    AriaTooltipProps,
    "placement" | "offset" | "crossOffset" | "shouldFlip" | "containerPadding"
  >
>({});


export type TooltipProps = AriaTooltipProps & {
  /**
   * Size variant
   * @default 'M'
   */
  size?: ComponentSize;
  /**
   * 화살표 숨김 여부 — catalog DOM 은 화살표를 `OverlayArrow` 자식 노드로 그린다 (ADR-256 Phase 8a)
   * @default false
   */
  hideArrow?: boolean;
};

/**
 * Tooltip Component with Material Design 3 support
 *
 * 🚀 Phase 4: data-* 패턴 전환
 * - tailwind-variants 제거
 * - data-variant, data-size 속성 사용
 *
 * M3 Features:
 * - 5 variants: primary, secondary, tertiary, error, filled
 * - 3 sizes: sm, md, lg
 * - M3 color tokens for consistent theming
 *
 * Features:
 * - Automatic positioning
 * - Arrow indicator
 * - Smooth animations
 * - Keyboard accessible
 *
 * @example
 * <TooltipTrigger>
 *   <Button>Hover me</Button>
 *   <Tooltip variant="primary" size="M">
 *     This is a tooltip
 *   </Tooltip>
 * </TooltipTrigger>
 */
export function Tooltip({
  size = "M",
  hideArrow = false,
  children,
  ...props
}: TooltipProps) {
  const tooltipClassName = composeRenderProps(props.className, (className) =>
    className ? `react-aria-Tooltip ${className}` : "react-aria-Tooltip",
  );
  const fromTrigger = useContext(TooltipPlacementContext);
  const placement: typeof fromTrigger = {};
  for (const key of [
    "placement",
    "offset",
    "crossOffset",
    "shouldFlip",
    "containerPadding",
  ] as const)
    if (fromTrigger[key] !== undefined)
      (placement as Record<string, unknown>)[key] = fromTrigger[key];

  return (
    <AriaTooltip
      {...placement}
      {...props}
      className={tooltipClassName}
      data-size={size}
    >
      {!hideArrow && (
        <OverlayArrow>
          <svg width={8} height={8} viewBox="0 0 8 8">
            <path d="M0 0 L4 4 L8 0" />
          </svg>
        </OverlayArrow>
      )}
      {children as React.ReactNode}
    </AriaTooltip>
  );
}

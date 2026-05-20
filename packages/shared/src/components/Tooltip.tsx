import {
  Button as AriaButton,
  OverlayArrow,
  Tooltip as AriaTooltip,
  TooltipProps as AriaTooltipProps,
  TooltipTrigger,
  TooltipTriggerStateContext,
  composeRenderProps,
} from "react-aria-components";
import { useContext } from "react";
import type { ComponentSize } from "../types";
import {
  toTooltipRacProps,
  type TooltipCanonicalProps,
} from "../catalog/outputs/toRacProps";

import "./styles/generated/Tooltip.css";
import "./styles/Tooltip.runtime.css";

export type TooltipProps = AriaTooltipProps & {
  /**
   * Size variant
   * @default 'md'
   */
  size?: ComponentSize;
  variant?: "neutral" | "info" | "positive" | "negative";
  showArrow?: boolean;
  text?: string;
  "data-canonical-id"?: string;
  "data-element-id"?: string;
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
 *   <Tooltip variant="primary" size="md">
 *     This is a tooltip
 *   </Tooltip>
 * </TooltipTrigger>
 */
export function Tooltip({
  children,
  size: _size,
  variant: _variant,
  showArrow: _showArrow,
  text: _text,
  isOpen,
  defaultOpen,
  onOpenChange,
  ...props
}: TooltipProps) {
  const triggerState = useContext(TooltipTriggerStateContext);
  const projectedProps = toTooltipRacProps({
    ...props,
    children: children ?? _text,
    size: _size,
    variant: _variant,
    showArrow: _showArrow,
  } as TooltipCanonicalProps);
  const {
    children: projectedChildren,
    variant,
    size,
    showArrow,
    ...tooltipProps
  } = projectedProps;
  const tooltipClassName = composeRenderProps(props.className, (className) =>
    className ? `react-aria-Tooltip ${className}` : "react-aria-Tooltip",
  );

  const tooltipNode = (
    <AriaTooltip
      {...props}
      {...tooltipProps}
      className={tooltipClassName}
      data-size={size}
      data-variant={variant}
      data-placement={tooltipProps.placement}
    >
      {showArrow && (
        <OverlayArrow>
          <svg width={8} height={8} viewBox="0 0 8 8">
            <path d="M0 0 L4 4 L8 0" />
          </svg>
        </OverlayArrow>
      )}
      {(children ?? projectedChildren) as React.ReactNode}
    </AriaTooltip>
  );

  if (triggerState) {
    return tooltipNode;
  }

  const standaloneOpenProps =
    isOpen !== undefined
      ? { isOpen, onOpenChange }
      : defaultOpen !== undefined
        ? { defaultOpen, onOpenChange }
        : { isOpen: true, onOpenChange };

  return (
    <TooltipTrigger delay={0} closeDelay={0} {...standaloneOpenProps}>
      <AriaButton
        aria-hidden="true"
        className="react-aria-TooltipAnchor"
        isDisabled
        type="button"
      />
      {tooltipNode}
    </TooltipTrigger>
  );
}

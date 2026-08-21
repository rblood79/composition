import React from "react";
import type { BadgeVariant, ComponentSize } from "../types";
import { Skeleton } from "./Skeleton";
import "./styles/Badge.css";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /**
   * S2 variant
   * @default 'accent'
   */
  variant?: BadgeVariant;
  /**
   * Size variant
   * @default 'sm'
   */
  size?: ComponentSize;
  /**
   * Badge content (text or number)
   */
  children?: React.ReactNode;
  /**
   * Whether badge is a dot indicator (no content)
   * @default false
   */
  isDot?: boolean;
  /**
   * Whether badge should pulse (for notifications)
   * @default false
   */
  isPulsing?: boolean;
  /**
   * Fill style of the badge
   * @default 'bold'
   */
  fillStyle?: "bold" | "subtle" | "outline";
  /**
   * Show loading skeleton instead of content
   * @default false
   */
  isLoading?: boolean;
  /**
   * Disabled dim (generated CSS `[data-disabled]` — catalog states.disabled 0.38)
   * @default false
   */
  isDisabled?: boolean;
}

/**
 * Badge Component — Spectrum S2
 *
 * S2 Variants: accent, informative, neutral, positive, notice, negative
 * Fill Styles: bold (default), subtle, outline
 * Sizes: sm, md, lg
 *
 * @example
 * <Badge variant="accent" size="sm">New</Badge>
 * <Badge variant="negative" size="md">5</Badge>
 * <Badge variant="positive" fillStyle="subtle">Active</Badge>
 * <Badge variant="informative" isDot isPulsing />
 */
export function Badge({
  variant = "accent",
  size = "sm",
  isDot = false,
  isPulsing = false,
  fillStyle,
  isLoading = false,
  isDisabled = false,
  className,
  children,
  ...props
}: BadgeProps) {
  if (isLoading) {
    return (
      <Skeleton
        componentVariant="badge"
        size={size}
        className={className}
        aria-label="Loading badge..."
      />
    );
  }

  return (
    <span
      {...props}
      className={
        className ? `react-aria-Badge ${className}` : "react-aria-Badge"
      }
      data-badge
      data-variant={variant}
      data-size={size}
      data-dot={isDot || undefined}
      data-pulsing={isPulsing || undefined}
      data-fill-style={fillStyle || undefined}
      data-disabled={isDisabled || undefined}
    >
      {!isDot && children}
    </span>
  );
}

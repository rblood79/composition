/**
 * Skeleton Component - Universal Loading Placeholder
 *
 * A flexible skeleton loading component that supports various shapes,
 * animations, and component-specific variants.
 *
 * @example
 * // Basic usage
 * <Skeleton variant="text" />
 * <Skeleton variant="circular" width={48} height={48} />
 * <Skeleton variant="rectangular" width={200} height={100} />
 *
 * // Component-specific variants
 * <Skeleton componentVariant="button" size="md" />
 * <Skeleton componentVariant="input" />
 * <Skeleton componentVariant="card" />
 *
 * // Multi-line text
 * <Skeleton variant="text" lines={3} lastLineWidth="60%" />
 *
 * // Animation types
 * <Skeleton animation="shimmer" />  // Default - Claude AI style
 * <Skeleton animation="pulse" />
 * <Skeleton animation="wave" />
 */

import React from "react";
import type { ComponentSize } from "../types";
import "./styles/Skeleton.css";

// Base shape variants
export type SkeletonVariant = "text" | "circular" | "rectangular" | "rounded";

// Animation types
export type SkeletonAnimation = "shimmer" | "pulse" | "wave" | "none";

// Component-specific variants
export type ComponentSkeletonVariant =
  | "button"
  | "badge"
  | "link"
  | "input"
  | "checkbox"
  | "radio"
  | "switch"
  | "slider"
  | "list-item"
  | "grid-item"
  | "table-row"
  | "table-cell"
  | "tree-node"
  | "card"
  | "card-gallery"
  | "card-horizontal"
  | "tabs"
  | "tab"
  | "calendar"
  | "calendar-cell"
  | "progress"
  | "meter"
  | "avatar"
  | "nav"
  | "breadcrumb"
  | "pagination"
  | "color-swatch"
  | "color-area"
  | "type"
  | "menu-item"
  | "disclosure";

export interface SkeletonProps {
  /** Base shape variant */
  variant?: SkeletonVariant;

  /** Animation type */
  animation?: SkeletonAnimation;

  /** Width - number (px) or string (any CSS unit) */
  width?: string | number;

  /** Height - number (px) or string (any CSS unit) */
  height?: string | number;

  /** Number of text lines (only for variant="text") */
  lines?: number;

  /** Line height for multi-line text */
  lineHeight?: string | number;

  /** Last line width percentage (default: "60%") */
  lastLineWidth?: string;

  /** Gap between lines */
  lineGap?: string | number;

  /** Component-specific variant (overrides base variant) */
  componentVariant?: ComponentSkeletonVariant;

  /** Size for component variants */
  size?: ComponentSize;

  /** Additional CSS class */
  className?: string;

  /** Inline styles */
  style?: React.CSSProperties;

  /** Skeleton index for staggered animations */
  index?: number;

  /** Accessible label */
  "aria-label"?: string;

  /** Test ID */
  "data-testid"?: string;

  /**
   * ADR-151 후속 (2026-07-17): cutover 경로(CanonicalNodeRenderer)가 marker
   * (data-element-id/data-canonical-id) 및 data-* 를 props 로 주입한다 — root 에
   * passthrough 하지 않으면 preview 측정/클릭 선택이 이 요소를 못 찾는다
   * (IllustratedMessage 동형 결함, StatusLight 패턴).
   */
  [dataAttr: `data-${string}`]: string | undefined;
}

/**
 * 🚀 Phase 4: data-* 패턴 전환
 * - tailwind-variants 제거
 * - data-variant, data-animation, data-component-variant, data-size 속성 사용
 */

/**
 * Single skeleton line component
 */
function SkeletonLine({
  width,
  height,
  isLast,
  lastLineWidth,
  animation = "shimmer",
  className,
  style,
}: {
  width?: string | number;
  height?: string | number;
  isLast?: boolean;
  lastLineWidth?: string;
  animation?: SkeletonAnimation;
  className?: string;
  style?: React.CSSProperties;
}) {
  const lineWidth = isLast && lastLineWidth ? lastLineWidth : width;

  return (
    <div
      className={
        className ? `react-aria-Skeleton ${className}` : "react-aria-Skeleton"
      }
      data-variant="text"
      data-animation={animation !== "none" ? animation : undefined}
      style={{
        width: typeof lineWidth === "number" ? `${lineWidth}px` : lineWidth,
        height: typeof height === "number" ? `${height}px` : height,
        ...style,
      }}
      aria-hidden="true"
    />
  );
}

/**
 * Skeleton Component
 */
export function Skeleton({
  variant = "text",
  animation = "shimmer",
  width,
  height,
  lines = 1,
  lineHeight,
  lastLineWidth = "60%",
  lineGap,
  componentVariant,
  size = "md",
  className,
  style,
  index,
  "aria-label": ariaLabel = "Loading...",
  "data-testid": testId = "skeleton",
  ...rest
}: SkeletonProps) {
  // Component-specific variants render their own structure
  if (componentVariant) {
    return (
      <div
        {...rest}
        className={
          className ? `react-aria-Skeleton ${className}` : "react-aria-Skeleton"
        }
        data-component-variant={componentVariant}
        data-size={size}
        data-animation={animation !== "none" ? animation : undefined}
        style={
          {
            "--skeleton-index": index,
            ...style,
          } as React.CSSProperties
        }
        role="status"
        aria-label={ariaLabel}
        aria-busy="true"
        data-testid={testId}
      >
        {renderComponentVariant(componentVariant)}
      </div>
    );
  }

  // Multi-line text skeleton
  if (variant === "text" && lines > 1) {
    return (
      <div
        {...rest}
        className="react-aria-Skeleton-group"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: typeof lineGap === "number" ? `${lineGap}px` : lineGap || "8px",
          ...style,
        }}
        role="status"
        aria-label={ariaLabel}
        aria-busy="true"
        data-testid={testId}
      >
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonLine
            key={i}
            width={width || "100%"}
            height={lineHeight || height || 14}
            isLast={i === lines - 1}
            lastLineWidth={lastLineWidth}
            animation={animation}
          />
        ))}
      </div>
    );
  }

  // Base skeleton
  return (
    <div
      {...rest}
      className={
        className ? `react-aria-Skeleton ${className}` : "react-aria-Skeleton"
      }
      data-variant={variant}
      data-animation={animation !== "none" ? animation : undefined}
      style={
        {
          width: typeof width === "number" ? `${width}px` : width,
          height: typeof height === "number" ? `${height}px` : height,
          "--skeleton-index": index,
          ...style,
        } as React.CSSProperties
      }
      role="status"
      aria-label={ariaLabel}
      aria-busy="true"
      data-testid={testId}
    />
  );
}

/**
 * Render component-specific skeleton content
 */
function renderComponentVariant(componentVariant: ComponentSkeletonVariant) {
  switch (componentVariant) {
    case "button":
      return <span className="skeleton-content" />;

    case "badge":
      return <span className="skeleton-content" />;

    case "input":
      return (
        <>
          <span className="skeleton-label" />
          <span className="skeleton-input" />
        </>
      );

    case "checkbox":
    case "radio":
      return (
        <>
          <span className="skeleton-box" />
          <span className="skeleton-label" />
        </>
      );

    case "switch":
      return (
        <>
          <span className="skeleton-track" />
          <span className="skeleton-label" />
        </>
      );

    case "slider":
      return (
        <>
          <span className="skeleton-track" />
          <span className="skeleton-thumb" />
        </>
      );

    case "list-item":
    case "menu-item":
      return (
        <>
          <span className="skeleton-line title" />
          <span className="skeleton-line desc" />
        </>
      );

    case "grid-item":
      return (
        <>
          <span className="skeleton-image" />
          <span className="skeleton-line title" />
          <span className="skeleton-line desc" />
        </>
      );

    case "table-row":
      return (
        <>
          {[1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="skeleton-cell"
              style={{ width: `${20 + i * 5}%` }}
            />
          ))}
        </>
      );

    case "table-cell":
      return <span className="skeleton-content" />;

    case "tree-node":
      return (
        <>
          <span className="skeleton-icon" />
          <span className="skeleton-line title" />
        </>
      );

    case "card":
      return (
        <>
          <div className="skeleton-header">
            <span className="skeleton-line title" />
            <span className="skeleton-line subtitle" />
          </div>
          <div className="skeleton-body">
            <span className="skeleton-line" />
            <span className="skeleton-line" />
            <span className="skeleton-line short" />
          </div>
        </>
      );

    case "card-gallery":
      return (
        <>
          <span className="skeleton-image" />
          <div className="skeleton-content">
            <span className="skeleton-line title" />
            <span className="skeleton-line desc" />
          </div>
        </>
      );

    case "card-horizontal":
      return (
        <>
          <span className="skeleton-image" />
          <div className="skeleton-content">
            <span className="skeleton-line title" />
            <span className="skeleton-line desc" />
            <span className="skeleton-line short" />
          </div>
        </>
      );

    case "tabs":
      return (
        <>
          <div className="skeleton-tab-list">
            {[1, 2, 3].map((i) => (
              <span key={i} className="skeleton-tab" />
            ))}
          </div>
          <div className="skeleton-tab-panel">
            <span className="skeleton-line" />
            <span className="skeleton-line" />
            <span className="skeleton-line short" />
          </div>
        </>
      );

    case "tab":
      return <span className="skeleton-content" />;

    case "calendar":
      return (
        <>
          <div className="skeleton-calendar-header">
            <span className="skeleton-nav" />
            <span className="skeleton-title" />
            <span className="skeleton-nav" />
          </div>
          <div className="skeleton-calendar-grid">
            {Array.from({ length: 35 }).map((_, i) => (
              <span key={i} className="skeleton-day" />
            ))}
          </div>
        </>
      );

    case "calendar-cell":
      return <span className="skeleton-content" />;

    case "progress":
    case "meter":
      return (
        <>
          <span className="skeleton-label" />
          <span className="skeleton-bar" />
        </>
      );

    case "avatar":
      return <span className="skeleton-circle" />;

    case "breadcrumb":
      return (
        <>
          <span className="skeleton-item" />
          <span className="skeleton-separator" />
          <span className="skeleton-item" />
          <span className="skeleton-separator" />
          <span className="skeleton-item current" />
        </>
      );

    case "pagination":
      return (
        <>
          <span className="skeleton-button" />
          {[1, 2, 3].map((i) => (
            <span key={i} className="skeleton-page" />
          ))}
          <span className="skeleton-button" />
        </>
      );

    case "color-swatch":
      return <span className="skeleton-swatch" />;

    case "color-area":
      return <span className="skeleton-area" />;

    case "type":
      return (
        <>
          <span className="skeleton-content" />
          <span className="skeleton-remove" />
        </>
      );

    case "disclosure":
      return (
        <>
          <span className="skeleton-icon" />
          <span className="skeleton-title" />
        </>
      );

    default:
      return <span className="skeleton-content" />;
  }
}

/**
 * Skeleton.Text - Convenience component for text skeletons
 */
Skeleton.Text = function SkeletonText({
  lines = 1,
  ...props
}: Omit<SkeletonProps, "variant"> & { lines?: number }) {
  return <Skeleton variant="text" lines={lines} {...props} />;
};

/**
 * Skeleton.Circle - Convenience component for circular skeletons
 */
Skeleton.Circle = function SkeletonCircle({
  size: circleSize = 48,
  ...props
}: Omit<SkeletonProps, "variant" | "width" | "height" | "size"> & {
  size?: number;
}) {
  return (
    <Skeleton
      variant="circular"
      width={circleSize}
      height={circleSize}
      {...props}
    />
  );
};

/**
 * Skeleton.Rect - Convenience component for rectangular skeletons
 */
Skeleton.Rect = function SkeletonRect(props: Omit<SkeletonProps, "variant">) {
  return <Skeleton variant="rectangular" {...props} />;
};

export default Skeleton;

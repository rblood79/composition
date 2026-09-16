import React from "react";
import type { CardVariant, ComponentSizeSubset } from "../types";
import { normalizeCardVariant } from "../types";
import { Skeleton } from "./Skeleton";

export type CardAssetType = "file" | "folder" | "image" | "video" | "audio";
export type CardOrientation = "horizontal" | "vertical";

export interface CardProps {
  id?: string;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;

  // Variants & Styling
  variant?: CardVariant | "gallery" | string;
  cardType?: "default" | "asset" | "user" | "product";
  size?: ComponentSizeSubset;
  orientation?: CardOrientation;
  isQuiet?: boolean;
  isDisabled?: boolean;

  // Selection
  isSelectable?: boolean;
  isSelected?: boolean;
  isFocused?: boolean;
  onSelectionChange?: (isSelected: boolean) => void;

  // Content
  heading?: string;
  subheading?: string;
  title?: string;
  description?: string;
  footer?: string | React.ReactNode;

  // Asset
  asset?: CardAssetType;
  assetSrc?: string;
  preview?: string; // Image preview URL

  // Actions
  actions?: React.ReactNode;

  // Interactions
  onClick?: () => void;
  onPress?: () => void;
  href?: string;
  target?: "_blank" | "_self";

  // Accessibility
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  role?: string;

  // Loading
  /** Show loading skeleton instead of content */
  isLoading?: boolean;
  /** Skeleton layout variant */
  skeletonLayout?: "default" | "gallery" | "horizontal";

  // Structural children mode
  /** 구조적 자식(CardHeader/CardContent)을 사용하는 모드 — 내부 card-header/card-content 래핑을 건너뜀 */
  structuralChildren?: boolean;
}

// Asset Icon Component
function AssetIcon({ type }: { type: CardAssetType }) {
  const icons = {
    file: "📄",
    folder: "📁",
    image: "🖼️",
    video: "🎥",
    audio: "🎵",
  };

  return <span className="card-asset-icon">{icons[type]}</span>;
}

export function Card({
  id,
  children,
  className,
  style,
  variant: rawVariant = "primary",
  cardType = "default",
  size = "md",
  orientation = "vertical",
  isQuiet = false,
  isDisabled = false,
  isSelectable = false,
  isSelected = false,
  isFocused = false,
  onSelectionChange,
  heading,
  subheading,
  title,
  description,
  footer,
  asset,
  assetSrc,
  preview,
  actions,
  onClick,
  onPress,
  href,
  target,
  role,
  isLoading = false,
  skeletonLayout,
  structuralChildren = false,
  ...props
}: CardProps) {
  // Normalize legacy variant values (default/filled/outlined/elevated → S2 naming)
  const variant =
    rawVariant === "gallery" ? "gallery" : normalizeCardVariant(rawVariant);

  // Determine skeleton variant based on orientation or explicit layout
  const getSkeletonVariant = () => {
    if (skeletonLayout)
      return skeletonLayout === "default" ? "card" : `card-${skeletonLayout}`;
    if (variant === "gallery") return "card-gallery";
    if (orientation === "horizontal") return "card-horizontal";
    return "card";
  };

  if (isLoading) {
    return (
      <Skeleton
        componentVariant={
          getSkeletonVariant() as "card" | "card-gallery" | "card-horizontal"
        }
        size={size}
        className={className}
        aria-label="Loading card..."
      />
    );
  }

  const handleClick = () => {
    if (isDisabled) return;

    if (isSelectable && onSelectionChange) {
      onSelectionChange(!isSelected);
    }

    onClick?.();
    onPress?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isDisabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  const CardElement = href ? "a" : "div";

  const elementProps = {
    id,
    className: className ? `react-aria-Card ${className}` : "react-aria-Card",
    style,
    onClick: handleClick,
    onKeyDown: handleKeyDown,
    role: role || (isSelectable ? "button" : href ? "link" : undefined),
    tabIndex: isDisabled ? -1 : isSelectable || onClick || href ? 0 : undefined,
    "aria-disabled": isDisabled,
    "aria-selected": isSelectable ? isSelected : undefined,
    "data-variant": variant,
    "data-card-type": cardType !== "default" ? cardType : undefined,
    "data-size": size,
    "data-orientation": orientation,
    "data-quiet": isQuiet || undefined,
    "data-disabled": isDisabled || undefined,
    "data-selectable": isSelectable || undefined,
    "data-selected": isSelected || undefined,
    "data-focused": isFocused || undefined,
    ...(href ? { href, target } : {}),
    ...props,
  };

  return (
    <CardElement {...elementProps}>
      {/* Asset Section (for gallery/file variants) */}
      {asset && (
        <div className="card-asset">
          {assetSrc ? (
            <img
              src={assetSrc}
              alt={title || heading || ""}
              className="card-asset-image"
            />
          ) : (
            <AssetIcon type={asset} />
          )}
        </div>
      )}

      {/* Preview Image (for gallery variant) */}
      {preview && variant === "gallery" && (
        <div className="card-preview">
          <img
            src={preview}
            alt={title || heading || ""}
            className="card-preview-image"
          />
        </div>
      )}

      {/* Header Section — structuralChildren 모드에서는 CardHeader가 직접 렌더링 */}
      {!structuralChildren && (heading || subheading || title) && (
        <div className="card-header">
          {heading && <div className="card-heading">{heading}</div>}
          {subheading && <div className="card-subheading">{subheading}</div>}
          {title && !heading && <div className="card-title">{title}</div>}

          {/* Actions Menu (top-right) */}
          {actions && <div className="card-actions">{actions}</div>}
        </div>
      )}

      {/* Content Section — structuralChildren 모드에서는 children을 직접 렌더링 */}
      {structuralChildren ? (
        children
      ) : (
        <div className="card-content">
          {description && <div className="card-description">{description}</div>}
          {children}
        </div>
      )}

      {/* Footer Section */}
      {footer && (
        <div className="card-footer">
          {typeof footer === "string" ? <span>{footer}</span> : footer}
        </div>
      )}

      {/* Selection Indicator */}
      {isSelectable && isSelected && (
        <div className="card-selection-indicator" aria-hidden="true">
          <span className="selection-checkmark">✓</span>
        </div>
      )}
    </CardElement>
  );
}

export { Card as MyCard };

import React from "react";
import { Link } from "react-aria-components";
import type { CardVariant, ComponentSizeSubset } from "../types";
import { normalizeCardVariant } from "../types";

/**
 * The S2 Card box (`@react-spectrum/s2/src/Card.tsx` — a standalone Card; in a CardView the catalog
 * draws a RAC GridListItem instead, `delegatedDom.tsx` `card`). Its content is its child nodes in
 * order — `CardPreview + Content (Text[slot=title] + Text[slot=description]) + Footer` (ADR-256
 * Phase 10). The old prop-drawn header · description · footer · asset · preview path was removed
 * (사용자 승인 2026-10-11 — S2 Card has no such props).
 */
export interface CardProps {
  id?: string;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  variant?: CardVariant | string;
  size?: ComponentSizeSubset;
  isDisabled?: boolean;
  isSelected?: boolean;
  href?: string;
  target?: "_blank" | "_self";
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
}

export function Card({
  id,
  children,
  className,
  style,
  variant: rawVariant = "primary",
  size = "M",
  isDisabled = false,
  isSelected = false,
  href,
  target,
  ...props
}: CardProps) {
  // Normalize legacy variant values (default/filled/outlined/elevated → S2 naming)
  const variant = normalizeCardVariant(rawVariant);
  const dataProps = {
    "data-variant": variant,
    "data-size": size,
    "data-selected": isSelected || undefined,
  };
  const classes = className
    ? `react-aria-Card ${className}`
    : "react-aria-Card";

  // S2: a standalone Card with an `href` is a RAC `Link` — RAC gives it the link's focus · keyboard ·
  // press (no hand-written role / tabIndex here).
  if (href)
    return (
      <Link
        id={id}
        className={classes}
        style={style}
        href={href}
        target={target}
        isDisabled={isDisabled}
        {...dataProps}
        {...props}
      >
        {children}
      </Link>
    );

  return (
    <div
      id={id}
      className={classes}
      style={style}
      aria-disabled={isDisabled}
      {...dataProps}
      data-disabled={isDisabled || undefined}
      {...props}
    >
      {children}
    </div>
  );
}

import {
  composeRenderProps,
  Link as RACLink,
  LinkProps as RACLinkProps,
} from "react-aria-components";
import { useFocusRing } from "@react-aria/focus";
import { mergeProps } from "@react-aria/utils";
import type { LinkVariant, ComponentSize, StaticColor } from "../types";
import { Skeleton } from "./Skeleton";
import "./styles/Link.css";

export interface LinkProps extends RACLinkProps {
  /**
   * M3 variant
   * @default 'primary'
   */
  variant?: LinkVariant;
  /**
   * Size variant
   * @default 'md'
   */
  size?: ComponentSize;
  isQuiet?: boolean;
  staticColor?: StaticColor;
  /**
   * Whether the link is external (opens in new tab)
   * Automatically adds rel="noopener noreferrer" for security
   */
  isExternal?: boolean;
  /**
   * Whether to show external link icon
   * @default true (when isExternal is true)
   */
  showExternalIcon?: boolean;
  /**
   * Show loading skeleton instead of content
   * @default false
   */
  isLoading?: boolean;
}

/**
 * Link Component with Material Design 3 support
 *
 * 🚀 Phase 4: data-* 패턴 전환
 * - tailwind-variants 제거
 * - data-variant, data-size 속성 사용
 *
 * M3 Features:
 * - 2 variants: primary, secondary
 * - 3 sizes: sm, md, lg
 * - M3 color tokens for consistent theming
 *
 * Features:
 * - External link support with security (rel="noopener noreferrer")
 * - Optional external icon indicator
 * - Keyboard accessible with focus ring
 * - Hover and pressed states
 *
 * @example
 * <Link variant="primary" size="md" href="/about">About</Link>
 * <Link variant="secondary" isExternal href="https://example.com">External Link</Link>
 */
export function Link(props: LinkProps) {
  const { focusProps, isFocusVisible } = useFocusRing();
  const {
    variant = "primary",
    size = "md",
    isQuiet = false,
    staticColor = "auto",
    isExternal,
    showExternalIcon = true,
    isLoading,
    ...restProps
  } = props;

  // Show skeleton when loading
  if (isLoading) {
    return (
      <Skeleton
        componentVariant="link"
        className={props.className as string}
        aria-label="Loading link..."
      />
    );
  }

  // External link security: automatically add rel="noopener noreferrer"
  const externalProps = isExternal
    ? {
        target: "_blank",
        rel: "noopener noreferrer",
      }
    : {};

  const allProps = mergeProps(restProps as object, focusProps as object, externalProps);

  return (
    <RACLink
      {...(allProps as RACLinkProps)}
      data-variant={variant}
      data-size={size}
      data-quiet={isQuiet || undefined}
      data-static-color={staticColor}
      data-focus-visible={isFocusVisible || undefined}
      data-external={isExternal || undefined}
      className={composeRenderProps(
        props.className,
        (cls) => cls ? `react-aria-Link ${cls}` : "react-aria-Link"
      )}
    >
      {composeRenderProps(props.children, (children) => (
        <>
          {children}
          {isExternal && showExternalIcon && (
            <svg
              className="link-external-icon"
              width="1em"
              height="1em"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          )}
        </>
      ))}
    </RACLink>
  );
}

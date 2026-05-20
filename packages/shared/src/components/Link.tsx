import {
  composeRenderProps,
  Link as RACLink,
  LinkProps as RACLinkProps,
} from "react-aria-components";
import type { ReactElement, ReactNode } from "react";
import { useFocusRing } from "@react-aria/focus";
import { mergeProps } from "@react-aria/utils";
import {
  toLinkRacProps,
  type LinkCanonicalProps,
} from "../catalog/outputs/toRacProps";
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
  const projectedProps = toLinkRacProps(props as LinkCanonicalProps);
  const { focusProps, isFocusVisible } = useFocusRing();
  const {
    variant: _variant,
    size: _size,
    isQuiet: _isQuiet,
    staticColor: _staticColor,
    isExternal: _isExternal,
    showExternalIcon: _showExternalIcon,
    isLoading: inputIsLoading,
    href: _href,
    target: _target,
    rel: _rel,
    children,
    ...restProps
  } = props;
  const {
    href,
    isExternal,
    isLoading: projectedIsLoading,
    isQuiet,
    rel,
    showExternalIcon,
    size,
    staticColor,
    target,
    variant,
  } = projectedProps;
  const isLoading = inputIsLoading ?? projectedIsLoading ?? false;

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
    : {
        ...(target ? { target } : {}),
        ...(rel ? { rel } : {}),
      };

  const allProps = mergeProps(
    restProps as object,
    focusProps as object,
    externalProps,
  );
  const inputChildren = props.children;
  const renderedChildren: RACLinkProps["children"] =
    typeof inputChildren === "function"
      ? (values) =>
          renderLinkContent(
            inputChildren(values) ?? null,
            isExternal,
            showExternalIcon,
          )
      : renderLinkContent(
          inputChildren ?? projectedProps.children,
          isExternal,
          showExternalIcon,
        );

  return (
    <RACLink
      {...(allProps as RACLinkProps)}
      href={href}
      data-variant={variant}
      data-size={size}
      data-quiet={isQuiet || undefined}
      data-static-color={staticColor}
      data-focus-visible={isFocusVisible || undefined}
      data-external={isExternal || undefined}
      className={composeRenderProps(props.className, (cls) =>
        cls ? `react-aria-Link ${cls}` : "react-aria-Link",
      )}
    >
      {renderedChildren}
    </RACLink>
  );
}

function renderLinkContent(
  children: ReactNode,
  isExternal: boolean | undefined,
  showExternalIcon: boolean,
): ReactElement {
  return (
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
  );
}

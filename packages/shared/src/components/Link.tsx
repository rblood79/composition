import { composeRenderProps } from "react-aria-components/composeRenderProps";
import type { LinkProps as RACLinkProps } from "react-aria-components/Link";
import { LinkPrimitive as RACLink } from "./LinkPrimitive";
import { useFocusRing } from "@react-aria/focus";
import { mergeProps } from "@react-aria/utils";
import type { LinkVariant, ComponentSize, StaticColor } from "../types";

export interface LinkProps extends RACLinkProps {
  /**
   * M3 variant
   * @default 'primary'
   */
  variant?: LinkVariant;
  /**
   * Size variant
   * @default 'M'
   */
  size?: ComponentSize;
  isQuiet?: boolean;
  staticColor?: StaticColor;
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
 * - Keyboard accessible with focus ring
 * - Hover and pressed states
 *
 * @example
 * <Link variant="primary" size="M" href="/about">About</Link>
 * (S2 Link has no external icon — `isExternal` · `showExternalIcon` removed 2026-11-18; the catalog
 *  binding dropped them 2026-09-10.)
 */
export function Link(props: LinkProps) {
  const { focusProps, isFocusVisible } = useFocusRing();
  const {
    variant = "primary",
    size = "M",
    isQuiet = false,
    staticColor,
    ...restProps
  } = props;

  // Show skeleton when loading

  const allProps = mergeProps(restProps as object, focusProps as object);

  // 빈 문자열 href 는 React 경고("empty string passed to href") 유발 + RAC 가 빈 <a href="">
  // 렌더 → 모든 href 진입 경로(renderLink / Breadcrumb / collection item)의 최종 수렴점에서
  // undefined 로 정규화하는 단일 방어선.
  const normalizedHref =
    typeof restProps.href === "string" && restProps.href
      ? restProps.href
      : undefined;

  return (
    <RACLink
      {...(allProps as RACLinkProps)}
      href={normalizedHref}
      data-variant={variant}
      data-size={size}
      data-quiet={isQuiet || undefined}
      data-static-color={staticColor}
      data-focus-visible={isFocusVisible || undefined}
      className={composeRenderProps(props.className, (cls) =>
        cls ? `react-aria-Link ${cls}` : "react-aria-Link",
      )}
    >
      {props.children}
    </RACLink>
  );
}

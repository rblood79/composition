import { Button } from "react-aria-components/Button";
import {
  Disclosure as AriaDisclosure,
  DisclosurePanel,
  DisclosureProps as AriaDisclosureProps,
} from "react-aria-components/Disclosure";
import { Heading } from "react-aria-components/Heading";
import { composeRenderProps } from "react-aria-components/composeRenderProps";
import type { ComponentSize } from "../types";

import "./styles/generated/Disclosure.css";

export interface DisclosureProps extends Omit<AriaDisclosureProps, "children"> {
  /**
   * Size variant
   * @default 'md'
   */
  size?: ComponentSize;
  /**
   * Disclosure title/trigger text
   */
  title?: string;
  /**
   * Content to show when expanded
   */
  children?: React.ReactNode;
}

/**
 * Disclosure Component with Material Design 3 support
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
 * - Expandable/collapsible content
 * - Animated chevron indicator
 * - Keyboard accessible (Enter, Space to toggle)
 * - ARIA attributes for screen readers
 *
 * @example
 * <Disclosure variant="primary" size="md" title="Show Details">
 *   <p>This content is hidden by default and shown when expanded.</p>
 * </Disclosure>
 */
export function Disclosure({
  size = "md",
  title,
  children,
  ...props
}: DisclosureProps) {
  const disclosureClassName = composeRenderProps(
    props.className,
    (className) =>
      className
        ? `react-aria-Disclosure ${className}`
        : "react-aria-Disclosure",
  );

  return (
    <AriaDisclosure {...props} className={disclosureClassName} data-size={size}>
      <Heading>
        <Button slot="trigger">
          <svg viewBox="0 0 24 24" className="disclosure-chevron">
            <path d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
          {title}
        </Button>
      </Heading>
      <DisclosurePanel>{children}</DisclosurePanel>
    </AriaDisclosure>
  );
}

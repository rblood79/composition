import {
  Button as AriaButton,
  Dialog,
  DialogTrigger,
  OverlayArrow,
  OverlayTriggerStateContext,
  Popover as AriaPopover,
  PopoverProps as AriaPopoverProps,
  composeRenderProps,
} from "react-aria-components";
import { FocusScope } from "@react-aria/focus";
import { useContext, type ReactNode } from "react";
import type { ComponentSize } from "../types";
import {
  toPopoverRacProps,
  type PopoverCanonicalProps,
} from "../catalog/outputs/toRacProps";

import "./styles/generated/Popover.css";
import "./styles/Popover.css";

export interface PopoverProps extends Omit<AriaPopoverProps, "children"> {
  children?: ReactNode;
  /**
   * Size variant
   * @default 'md'
   */
  size?: ComponentSize;
  variant?: "accent" | "neutral" | "surface";
  text?: string;
  showArrow?: boolean;
  /**
   * 화살표 숨김 여부
   * @default false
   */
  hideArrow?: boolean;
  /**
   * 포커스 제약
   * Popover 내부에서만 포커스 이동 가능
   * @default false
   */
  containFocus?: boolean;
  /**
   * 자동 포커스
   * Popover가 열릴 때 첫 번째 요소로 자동 이동
   * @default true
   */
  autoFocus?: boolean;
  /**
   * 포커스 복원
   * Popover가 닫힐 때 이전 포커스 위치로 복원
   * @default true
   */
  restoreFocus?: boolean;
  "data-canonical-id"?: string;
  "data-element-id"?: string;
}

/**
 * Popover Component with Material Design 3 support
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
 * - Automatic focus management
 * - Optional focus containment
 * - Focus restoration on close
 * - Keyboard navigation (Tab, Shift+Tab, Escape)
 * - Customizable arrow indicator
 *
 * @example
 * <DialogTrigger>
 *   <Button>Open Popover</Button>
 *   <Popover variant="primary" size="md">
 *     <p>Popover content</p>
 *   </Popover>
 * </DialogTrigger>
 */
export function Popover({
  children,
  size: _size,
  variant: _variant,
  text: _text,
  showArrow: _showArrow,
  hideArrow: _hideArrow,
  containFocus: _containFocus,
  autoFocus: _autoFocus,
  restoreFocus: _restoreFocus,
  isOpen,
  defaultOpen,
  onOpenChange,
  ...props
}: PopoverProps) {
  const triggerState = useContext(OverlayTriggerStateContext);
  const projectedProps = toPopoverRacProps({
    ...props,
    children: children ?? _text,
    size: _size,
    variant: _variant,
    showArrow: _showArrow ?? (_hideArrow === true ? false : undefined),
    containFocus: _containFocus,
    autoFocus: _autoFocus,
    restoreFocus: _restoreFocus,
    isOpen,
    defaultOpen,
  } as PopoverCanonicalProps);
  const {
    children: projectedChildren,
    variant,
    size,
    showArrow,
    containFocus,
    autoFocus,
    restoreFocus,
    isOpen: _projectedIsOpen,
    defaultOpen: _projectedDefaultOpen,
    ...popoverProps
  } = projectedProps;
  const popoverClassName = composeRenderProps(props.className, (className) =>
    className ? `react-aria-Popover ${className}` : "react-aria-Popover",
  );

  const popoverNode = (
    <AriaPopover
      {...props}
      {...popoverProps}
      className={popoverClassName}
      data-size={size}
      data-variant={variant}
      data-placement={popoverProps.placement}
    >
      {showArrow && (
        <OverlayArrow>
          <svg width={12} height={12} viewBox="0 0 12 12">
            <path d="M0 0 L6 6 L12 0" />
          </svg>
        </OverlayArrow>
      )}
      <Dialog>
        <FocusScope
          contain={containFocus}
          autoFocus={autoFocus}
          restoreFocus={restoreFocus}
        >
          {(children ?? projectedChildren) as ReactNode}
        </FocusScope>
      </Dialog>
    </AriaPopover>
  );

  if (triggerState) {
    return popoverNode;
  }

  const standaloneOpenProps =
    isOpen !== undefined
      ? { isOpen, onOpenChange }
      : defaultOpen !== undefined
        ? { defaultOpen, onOpenChange }
        : { isOpen: true, onOpenChange };

  return (
    <DialogTrigger {...standaloneOpenProps}>
      <AriaButton
        aria-hidden="true"
        className="react-aria-PopoverAnchor"
        isDisabled
        type="button"
      />
      {popoverNode}
    </DialogTrigger>
  );
}

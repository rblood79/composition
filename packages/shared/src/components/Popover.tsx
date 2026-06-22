import {
  OverlayArrow,
  Popover as AriaPopover,
  PopoverProps as AriaPopoverProps,
  composeRenderProps,
} from "react-aria-components";
import { FocusScope } from "@react-aria/focus";
import type { ComponentSize } from "../types";

import "./styles/Popover.css";

export interface PopoverProps extends Omit<AriaPopoverProps, "children"> {
  children: React.ReactNode;
  /**
   * Size variant
   * @default 'md'
   */
  size?: ComponentSize;
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
  size = "md",
  hideArrow = false,
  containFocus = false,
  autoFocus = true,
  restoreFocus = true,
  ...props
}: PopoverProps) {
  const popoverClassName = composeRenderProps(props.className, (className) =>
    className ? `react-aria-Popover ${className}` : "react-aria-Popover",
  );

  return (
    <AriaPopover {...props} className={popoverClassName} data-size={size}>
      {!hideArrow && (
        <OverlayArrow>
          <svg width={12} height={12} viewBox="0 0 12 12">
            <path d="M0 0 L6 6 L12 0" />
          </svg>
        </OverlayArrow>
      )}
      {/* reference(react-aria-starter Popover.tsx)는 popover 안에 Dialog 를 두지 않고
          children 을 직접 둔다 — RAC Popover 가 non-modal overlay 위치/포커스/Escape 닫기를
          자체 처리하고, focus 제약/복원은 FocusScope 가 Dialog 독립으로 담당한다.
          기존 <Dialog> 래핑은 모달용 Dialog 스타일(padding 등)이 popover dropdown 에 새는
          회귀 원인이었다(ComboBox/Select/Calendar dropdown 에 40px padding 누출).
          Dialog role="dialog" 의존 사용처 0건 확인 — FocusScope 만 직접 자식으로 유지. */}
      <FocusScope
        contain={containFocus}
        autoFocus={autoFocus}
        restoreFocus={restoreFocus}
      >
        {children}
      </FocusScope>
    </AriaPopover>
  );
}

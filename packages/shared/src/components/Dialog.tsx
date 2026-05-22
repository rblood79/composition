import { Dialog as RACDialog, DialogProps } from "react-aria-components";
import type { ComponentSize } from "../types";
import "./styles/generated/Dialog.css";

/**
 * Dialog Component with Material Design 3 support
 *
 * 🚀 Phase 4: data-* 패턴 전환
 * - tailwind-variants 제거
 * - data-variant, data-size 속성 사용
 *
 * A dialog component that should be used within a Modal overlay.
 * The Modal component handles focus management, so this component
 * focuses on content structure and accessibility.
 *
 * M3 Features:
 * - 5 variants: primary, secondary, tertiary, error, filled
 * - 3 sizes: sm, md, lg
 * - M3 color tokens for consistent theming
 *
 * Features:
 * - Semantic HTML structure
 * - Proper ARIA attributes (role="dialog")
 * - Keyboard accessibility (inherited from Modal)
 *
 * @example
 * <Modal>
 *   <Dialog variant="primary" size="md">
 *     <Heading>Dialog Title</Heading>
 *     <p>Dialog content goes here</p>
 *     <Button onPress={close}>Close</Button>
 *   </Dialog>
 * </Modal>
 */

export interface DialogExtendedProps extends DialogProps {
  size?: ComponentSize;
  isDismissable?: boolean;
}

export function Dialog({
  size = "md",
  isDismissable,
  ...props
}: DialogExtendedProps) {
  // 🚀 ClassNameOrFunction 타입 지원 - 문자열로 단순화
  const baseClassName =
    typeof props.className === "string" ? props.className : undefined;
  const dialogClassName = baseClassName
    ? `react-aria-Dialog ${baseClassName}`
    : "react-aria-Dialog";

  return (
    <RACDialog
      {...props}
      className={dialogClassName}
      data-size={size}
      data-dismissible={isDismissable || undefined}
    />
  );
}

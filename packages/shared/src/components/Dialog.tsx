import { useContext } from "react";
import { Modal, ModalOverlay } from "react-aria-components/Modal";
import { DialogTriggerScope } from "./DialogTrigger";
import { Dialog as RACDialog, DialogProps } from "react-aria-components/Dialog";
import type { ComponentSize } from "../types";

/**
 * Dialog 본문. DialogTrigger 안에서는 RAC ModalOverlay/Modal로 열고,
 * 단독 사용 시에는 기존 RAC Dialog 콘텐츠 계약을 유지한다.
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
  const hasTrigger = useContext(DialogTriggerScope);
  // 🚀 ClassNameOrFunction 타입 지원 - 문자열로 단순화
  const baseClassName =
    typeof props.className === "string" ? props.className : undefined;
  const dialogClassName = baseClassName
    ? `react-aria-Dialog ${baseClassName}`
    : "react-aria-Dialog";

  const content = (
    <RACDialog
      {...props}
      aria-label={
        props["aria-label"] ?? (props["aria-labelledby"] ? undefined : "Dialog")
      }
      className={dialogClassName}
      data-size={size}
      data-dismissible={isDismissable || undefined}
    />
  );
  if (!hasTrigger) return content;
  return (
    <ModalOverlay
      className="react-aria-ModalOverlay"
      isDismissable={isDismissable}
    >
      <Modal
        className="react-aria-Modal"
        data-size={size}
        data-dialog-trigger=""
      >
        <DialogTriggerScope.Provider value={false}>
          {content}
        </DialogTriggerScope.Provider>
      </Modal>
    </ModalOverlay>
  );
}

import { useContext } from "react";
import { Modal, ModalOverlay } from "react-aria-components/Modal";
import { DialogTriggerScope } from "./DialogTrigger";
import { Dialog as RACDialog, DialogProps } from "react-aria-components/Dialog";
import type { ComponentSize } from "../types";

/**
 * Dialog 본문. Modal · Popover 안에서는 그 overlay 에서 열린다 (catalog Dialog origin 은 레퍼런스
 * `DialogTrigger > Button + Modal > Dialog` — ADR-256 Phase 8b). overlay 없이 DialogTrigger 바로
 * 아래 놓인 Dialog 만 RAC ModalOverlay/Modal 로 감싸 열고, 단독 사용 시에는 RAC Dialog 콘텐츠
 * 계약을 유지한다.
 *
 * 접근성 이름은 RAC 가 정한다 — `Heading slot="title"` 이 있으면 `aria-labelledby` (ADR-254).
 * 이름 폴백 (`aria-label`) 은 제목 유무를 아는 쪽 (catalog binding) 이 넘긴다: 여기서 기본값을
 * 넣으면 RAC `useDialog` 가 제목 연결을 버린다.
 */

export interface DialogExtendedProps extends DialogProps {
  size?: ComponentSize;
  isDismissable?: boolean;
}

export function Dialog({
  size = "M",
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

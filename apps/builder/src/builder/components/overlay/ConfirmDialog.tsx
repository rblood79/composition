/**
 * ConfirmDialog — 되돌리기 힘든 액션 (삭제 등) 의 확인 다이얼로그.
 *
 * `window.confirm` 대체. RAC Modal/Dialog 라 열릴 때 확인 버튼에 포커스가 가고 닫히면
 * 호출 요소로 돌아온다 (리서치 §4-5). 열림 상태는 호출자가 가진다 (controlled).
 */
import { Button } from "react-aria-components/Button";
import { Dialog } from "react-aria-components/Dialog";
import { Heading } from "react-aria-components/Heading";
import { Modal, ModalOverlay } from "react-aria-components/Modal";
import { TriangleAlert } from "lucide-react";
import { useI18n } from "@/i18n";
import "./ConfirmDialog.css";

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  /** 기본값: common.delete (danger) */
  confirmLabel?: string;
  /** 기본값: common.cancel */
  cancelLabel?: string;
  /** 기본 danger — 확인 버튼이 negative 색 */
  tone?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useI18n();
  return (
    <ModalOverlay
      className="confirm-dialog-overlay"
      isOpen={isOpen}
      isDismissable
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <Modal className="confirm-dialog-modal">
        <Dialog role="alertdialog" aria-label={title}>
          <div className="confirm-dialog-header">
            {tone === "danger" ? <TriangleAlert size={18} /> : null}
            <Heading className="confirm-dialog-title" slot="title">
              {title}
            </Heading>
          </div>
          <div className="confirm-dialog-body">
            <p>{message}</p>
          </div>
          <div className="confirm-dialog-actions">
            <Button className="control-button" onPress={onCancel}>
              {cancelLabel ?? t("common.cancel")}
            </Button>
            <Button
              className="control-button"
              data-variant={tone === "danger" ? "danger" : "primary"}
              autoFocus
              onPress={onConfirm}
            >
              {confirmLabel ?? t("common.delete")}
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

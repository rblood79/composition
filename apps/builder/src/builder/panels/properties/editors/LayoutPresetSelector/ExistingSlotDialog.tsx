/**
 * ExistingSlotDialog - 기존 Slot 처리 확인 다이얼로그
 *
 * Phase 6: 프리셋 적용 시 기존 Slot 처리 선택
 *
 * 프리셋 적용 시 기존 Slot이 있으면:
 * - 덮어쓰기: 기존 Slot 삭제 후 새로 생성
 * - 병합: 기존 Slot 유지, 없는 Slot만 추가
 * - 취소: 프리셋 적용 취소
 */

import { memo, useCallback } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "react-aria-components/Button";
import { Dialog } from "react-aria-components/Dialog";
import { Modal, ModalOverlay } from "react-aria-components/Modal";
import { Heading } from "react-aria-components/Heading";
import type { ExistingSlotInfo, PresetApplyMode } from "./types";
import { useI18n } from "@/i18n";
import "../../../../components/overlay/ConfirmDialog.css";

interface ExistingSlotDialogProps {
  /** 다이얼로그 열림 상태 */
  isOpen: boolean;
  /** 기존 Slot 목록 */
  existingSlots: ExistingSlotInfo[];
  /** 적용할 프리셋 이름 */
  presetName: string;
  /** 모드 선택 콜백 */
  onConfirm: (mode: PresetApplyMode) => void;
  /** 닫기 콜백 */
  onClose: () => void;
}

/**
 * ConfirmDialog 와 같은 8 격자 (헤더 48 · 본문 12/18 · 푸터 44 · 버튼 `.control-button` 28).
 * 종전엔 pad 14 18 · shared Button 32 · 문장 두 줄이었다 — 슬롯은 행 28 (이름 mono ·
 * 놓인 요소 수 · Merge 면 keep) 으로 보여 "무엇이 남고 무엇이 바뀌는지" 가 읽힌다
 * (panel-ui 18, 2026-09-14).
 */
export const ExistingSlotDialog = memo(function ExistingSlotDialog({
  isOpen,
  existingSlots,
  presetName,
  onConfirm,
  onClose,
}: ExistingSlotDialogProps) {
  const { t } = useI18n();
  const hasChildrenSlots = existingSlots.some((slot) => slot.hasChildren);

  const handleReplace = useCallback(() => {
    onConfirm("replace");
  }, [onConfirm]);

  const handleMerge = useCallback(() => {
    onConfirm("merge");
  }, [onConfirm]);

  const handleCancel = useCallback(() => {
    onConfirm("cancel");
    onClose();
  }, [onConfirm, onClose]);

  const title = t("propertiesPanel.slotExisting");

  return (
    <ModalOverlay
      className="confirm-dialog-overlay"
      isOpen={isOpen}
      isDismissable
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      // portal 로 body 밑에 붙어 builder 토큰 스코프 밖 — 직접 붙인다 (구 주석 참조)
      data-context="builder"
    >
      <Modal className="confirm-dialog-modal existing-slot-dialog">
        {/* className 을 줘야 RAC 기본 `react-aria-Dialog` 가 안 붙는다 — 생성 Dialog.css
            (overlay archetype, position fixed · pad 30) 가 전역이라 400 상자 밖으로 떠 버린다 */}
        <Dialog
          className="confirm-dialog"
          role="alertdialog"
          aria-label={title}
        >
          <div className="confirm-dialog-header">
            <AlertTriangle size={18} className="existing-slot-dialog__icon" />
            <Heading className="confirm-dialog-title" slot="title">
              {title}
            </Heading>
          </div>
          <div className="confirm-dialog-body">
            <p>{t("propertiesPanel.slotExistingBody", { preset: presetName })}</p>
            <div className="existing-slot-dialog__list" role="list">
              {existingSlots.map((slot) => (
                <div
                  key={slot.elementId}
                  className="existing-slot-dialog__row"
                  role="listitem"
                >
                  <span className="existing-slot-dialog__name">
                    {slot.slotName}
                  </span>
                  <span className="existing-slot-dialog__meta">
                    {t("propertiesPanel.slotChildCount", {
                      count: slot.childCount,
                    })}
                  </span>
                </div>
              ))}
            </div>
            <p className="existing-slot-dialog__hint">
              {hasChildrenSlots
                ? t("propertiesPanel.slotContentWarning")
                : t("propertiesPanel.slotModeHint")}
            </p>
          </div>
          <div className="confirm-dialog-actions">
            <span className="existing-slot-dialog__summary">
              {t("propertiesPanel.slotFooterCount", {
                count: existingSlots.length,
              })}
            </span>
            <Button className="control-button" onPress={handleCancel}>
              {t("common.cancel")}
            </Button>
            <Button className="control-button" onPress={handleMerge}>
              {t("propertiesPanel.slotMerge")}
            </Button>
            <Button
              className="control-button"
              data-variant="primary"
              onPress={handleReplace}
            >
              {t("propertiesPanel.slotReplace")}
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
});

export default ExistingSlotDialog;

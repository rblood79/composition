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
import { AlertTriangle, Merge, X } from "lucide-react";
import { Button } from "@composition/shared/components";
import { Dialog, DialogTrigger, Modal, Heading } from "react-aria-components";
import type { ExistingSlotInfo, PresetApplyMode } from "./types";
import { iconProps } from "../../../../../utils/ui/uiConstants";
import { ACTION_ICONS } from "../../../../config/actionIcons";
import { useI18n } from "@/i18n";

/** 컨텍스트 메뉴·다중 선택 툴바와 같은 삭제 아이콘 정본 (`config/actionIcons.ts`). */
const DeleteIcon = ACTION_ICONS.delete;

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

  if (!isOpen) return null;

  return (
    <DialogTrigger isOpen={isOpen}>
      {/*
        `data-context="builder"` 가 필요하다 — 이 Modal 은 portal 로 `body` 밑에 붙고,
        RAC 가 `.react-aria-ModalOverlay` 로 한 겹 감싸기 때문에 builder-system.css 의
        portal fallback (`body > .react-aria-Modal`) 이 매칭되지 않는다. 그러면 semantic
        토큰(`--notice` 등)이 전부 미정의가 되어 선언이 통째로 무효화된다 (실측: 경고
        아이콘이 주황을 잃고 본문 색을 상속). 같은 파일의 첫 분기 `[data-context="builder"]`
        는 구조 조건이 없어 여기에 붙이면 light/dark 토큰 세트가 그대로 적용된다.
      */}
      <Modal
        isDismissable
        onOpenChange={(open) => !open && onClose()}
        className="react-aria-Modal"
        data-context="builder"
      >
        <Dialog className="react-aria-Dialog existing-slot-dialog">
          <Heading slot="title" className="dialog-title">
            <AlertTriangle className="icon-warning" size={iconProps.size} />
            {t("propertiesPanel.slotExisting")}
          </Heading>

          <div className="dialog-content">
            <p className="dialog-description">
              {t("propertiesPanel.slotExistingBody", { preset: presetName })}
            </p>

            <div className="existing-slots-list">
              <p className="list-title">
                {t("propertiesPanel.slotCurrent", {
                  count: existingSlots.length,
                })}
              </p>
              <ul>
                {existingSlots.map((slot) => (
                  <li key={slot.elementId}>
                    <span className="slot-name">{slot.slotName}</span>
                    {slot.hasChildren && (
                      <span className="slot-warning">
                        {t("propertiesPanel.slotHasContent")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {hasChildrenSlots && (
              <div className="warning-box">
                <AlertTriangle size={iconProps.size} />
                <span>{t("propertiesPanel.slotContentWarning")}</span>
              </div>
            )}
          </div>

          <div className="dialog-actions">
            <Button variant="secondary" onPress={handleCancel}>
              <X size={iconProps.size} />
              {t("common.cancel")}
            </Button>
            <Button variant="secondary" onPress={handleMerge}>
              <Merge size={iconProps.size} />
              {t("propertiesPanel.slotMerge")}
            </Button>
            <Button variant="primary" onPress={handleReplace}>
              <DeleteIcon size={iconProps.size} />
              {t("propertiesPanel.slotReplace")}
            </Button>
          </div>
        </Dialog>
      </Modal>
    </DialogTrigger>
  );
});

export default ExistingSlotDialog;

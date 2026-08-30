/**
 * FontManagerDialog - 폰트 관리 모달
 *
 * Font Family 피커 안의 "폰트 추가·관리" 진입점이 여는 모달. 본문은 도킹 패널과
 * 같은 `FontManagerBody`.
 *
 * **Why 모달인가**: 폰트 등록은 저빈도 작업이라 인스펙터 레일 한 칸을 상주로
 * 차지할 이유가 없다 (Figma 는 Admin → Resources → Fonts, Pen 은 피커 안
 * "Add/Manage" → Custom Fonts 모달 — 둘 다 인스펙터에 관리 UI 를 두지 않는다).
 * 반대로 폰트 "선택" 은 고빈도라 Typography 섹션에 그대로 남는다.
 */

import {
  Button,
  Dialog,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import { X } from "lucide-react";
import { FONT_LIMITS } from "@composition/shared";
import { iconProps } from "../../../utils/ui/uiConstants";
import { FontManagerBody } from "./components/FontManagerBody";
import { useFontRegistry } from "./useFontRegistry";
import { useI18n } from "@/i18n";

interface FontManagerDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function FontManagerDialog({
  isOpen,
  onOpenChange,
}: FontManagerDialogProps) {
  return (
    <ModalOverlay
      className="font-manager-overlay"
      isDismissable
      isOpen={isOpen}
      onOpenChange={onOpenChange}
    >
      <Modal className="font-manager-modal">
        <Dialog className="font-manager-dialog">
          {({ close }) => <FontManagerDialogContent close={close} />}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

function FontManagerDialogContent({ close }: { close: () => void }) {
  const { t } = useI18n();
  const { faceCount } = useFontRegistry();

  return (
    <>
      <div className="font-manager-dialog-header">
        <Heading slot="title" className="font-manager-dialog-title">
          {t("fonts.manageFonts")}
        </Heading>
        <span className="font-count-badge">
          {faceCount}/{FONT_LIMITS.MAX_FACES}
        </span>
        <Button
          className="font-manager-dialog-close"
          aria-label={t("common.close")}
          onPress={close}
        >
          <X size={iconProps.size} strokeWidth={iconProps.strokeWidth} />
        </Button>
      </div>

      <div className="font-manager-dialog-body">
        <FontManagerBody />
      </div>
    </>
  );
}

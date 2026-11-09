/**
 * FontUploadZone - 드래그 앤 드롭 + 파일 선택 업로드 영역
 *
 * RAC `DropZone` (끌어 놓기 · 키보드 붙여넣기 놓기) + `FileTrigger` (파일 선택 창) + `Button` (영역 전체가
 * 누르는 버튼 — Enter · Space 로도 열린다). 옛 구현은 `div role="button" tabIndex=0` 에 클릭만 받아
 * 키보드로 열 수 없었다.
 */

import { Upload } from "lucide-react";
import { Button } from "react-aria-components/Button";
import { DropZone } from "react-aria-components/DropZone";
import { FileTrigger } from "react-aria-components/FileTrigger";
import { isFileDropItem } from "react-aria-components/useDrop";
import { iconProps } from "../../../../utils/ui/uiConstants";
import { useI18n } from "@/i18n";

interface FontUploadZoneProps {
  onUpload: (files: FileList | readonly File[]) => void;
  disabled?: boolean;
}

const ACCEPTED = [".woff2", ".woff", ".ttf", ".otf"];

export function FontUploadZone({ onUpload, disabled }: FontUploadZoneProps) {
  const { t } = useI18n();
  return (
    <DropZone
      className="font-upload-zone"
      isDisabled={disabled}
      aria-label={t("fonts.uploadLabel")}
      // 파일 형식 검사는 upload (validateFontFile) 가 한다 — 놓기는 파일이면 받는다
      getDropOperation={() => "copy"}
      onDrop={async (event) => {
        const files = await Promise.all(
          event.items.filter(isFileDropItem).map((item) => item.getFile()),
        );
        if (files.length) onUpload(files);
      }}
    >
      <FileTrigger
        acceptedFileTypes={ACCEPTED}
        allowsMultiple
        onSelect={(files) => {
          if (files?.length) onUpload(files);
        }}
      >
        <Button className="font-upload-trigger" isDisabled={disabled}>
          <Upload
            size={iconProps.size}
            color={iconProps.color}
            strokeWidth={iconProps.strokeWidth}
          />
          <span className="font-upload-label">
            {disabled ? t("fonts.uploadFull") : t("fonts.uploadPrompt")}
          </span>
          <span className="font-upload-hint">{t("fonts.uploadFormats")}</span>
        </Button>
      </FileTrigger>
    </DropZone>
  );
}

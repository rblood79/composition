/**
 * FontUploadZone - 드래그 앤 드롭 + 파일 선택 업로드 영역
 */

import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { Upload } from "lucide-react";
import { iconProps } from "../../../../utils/ui/uiConstants";
import { useI18n } from "@/i18n";

interface FontUploadZoneProps {
  onUpload: (files: FileList) => void;
  disabled?: boolean;
}

const ACCEPTED = ".woff2,.woff,.ttf,.otf";

export function FontUploadZone({ onUpload, disabled }: FontUploadZoneProps) {
  const { t } = useI18n();
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) setIsDragOver(true);
    },
    [disabled],
  );

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      if (disabled || !e.dataTransfer.files.length) return;
      onUpload(e.dataTransfer.files);
    },
    [disabled, onUpload],
  );

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files?.length) return;
      onUpload(e.target.files);
      e.target.value = "";
    },
    [onUpload],
  );

  const handleClick = useCallback(() => {
    if (!disabled) inputRef.current?.click();
  }, [disabled]);

  return (
    <div
      className="font-upload-zone"
      data-drag-over={isDragOver}
      data-disabled={disabled}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={t("fonts.uploadLabel")}
    >
      <Upload
        size={iconProps.size}
        color={iconProps.color}
        strokeWidth={iconProps.strokeWidth}
      />
      <span className="font-upload-label">
        {disabled ? t("fonts.uploadFull") : t("fonts.uploadPrompt")}
      </span>
      <span className="font-upload-hint">{t("fonts.uploadFormats")}</span>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        multiple
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
    </div>
  );
}

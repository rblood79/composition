/**
 * ADR-235 Phase 5 — 브라우저 저장소 보호 상태 (헤더). persist 거부 · 미지원이면 경고 아이콘을
 * 상시 표시하고, 툴팁에 사용량과 권유 (파일로 내보내기) 를 둔다.
 */
import { HardDrive, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { iconProps } from "../../utils/ui/uiConstants";
import { ActionIconButton } from "../components/ui/ActionIconButton";
import { useI18n } from "../../i18n";
import {
  getStorageStatus,
  refreshStorageEstimate,
  STORAGE_STATUS_EVENT,
  type StorageStatus,
} from "../../lib/storage/storageProtection";

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "–";
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

export function StorageStatusButton({ onExport }: { onExport: () => void }) {
  const { t } = useI18n();
  const [status, setStatus] = useState<StorageStatus>(getStorageStatus);
  useEffect(() => {
    const onStatus = (event: Event) =>
      setStatus((event as CustomEvent<StorageStatus>).detail);
    window.addEventListener(STORAGE_STATUS_EVENT, onStatus);
    void refreshStorageEstimate();
    return () => window.removeEventListener(STORAGE_STATUS_EVENT, onStatus);
  }, []);

  const atRisk =
    status.persist === "denied" || status.persist === "unsupported";
  const usage = t("header.storageUsage", {
    used: formatBytes(status.usage),
    quota: formatBytes(status.quota),
  });
  const label = atRisk
    ? `${t("header.storageAtRisk")} · ${usage}`
    : `${t("header.storageProtected")} · ${usage}`;
  const Icon = atRisk ? ShieldAlert : HardDrive;
  return (
    <ActionIconButton
      aria-label={label}
      tooltip={label}
      onPress={atRisk ? onExport : undefined}
      className={
        atRisk ? "storage-status storage-status--at-risk" : "storage-status"
      }
    >
      <Icon strokeWidth={iconProps.strokeWidth} size={iconProps.size} />
    </ActionIconButton>
  );
}

/**
 * 헤더 저장 상태 — 아이콘 + 우측 상단 dot. 상태 설명은 tooltip · aria-label 이, 스크린리더 안내는 버튼
 * 밖 live region 이 맡는다 (버튼의 aria-label 변경은 안내되지 않는다). 자동 저장이 멈춘 상태는 색과
 * 별개로 아이콘 모양이 바뀐다. tooltip 이 떠야 하므로 누를 일이 없는 상태도 disabled 로 두지 않는다.
 */
import { Cloud, CloudOff } from "lucide-react";
import { VisuallyHidden } from "react-aria";
import { iconProps } from "../../utils/ui/uiConstants";
import { ActionIconButton } from "../components/ui/ActionIconButton";
import { useI18n } from "../../i18n";
import type { CatalogSaveState } from "../catalogRuntime/autosave";
import "./SaveStatusButton.css";

export function SaveStatusButton({
  state,
  onRetry,
}: {
  state: CatalogSaveState;
  onRetry: () => void;
}) {
  const { t } = useI18n();
  const label = {
    saved: t("catalogProject.saveSaved"),
    unsaved: t("catalogProject.saveUnsaved"),
    saving: t("catalogProject.saveSaving"),
    failed: t("catalogProject.saveFailed"),
    conflict: t("catalogProject.saveConflict"),
    unsupported: t("catalogProject.saveUnsupported"),
  }[state];
  const stopped =
    state === "failed" || state === "conflict" || state === "unsupported";
  const Icon = stopped ? CloudOff : Cloud;
  return (
    <>
      <ActionIconButton
        aria-label={label}
        tooltip={label}
        onPress={state === "failed" ? onRetry : undefined}
        className="catalog-save-status"
        data-save-state={state}
      >
        <Icon strokeWidth={iconProps.strokeWidth} size={iconProps.size} />
        {state !== "saved" && (
          <span className="catalog-save-status-dot" aria-hidden="true" />
        )}
      </ActionIconButton>
      <VisuallyHidden aria-live="polite">{label}</VisuallyHidden>
    </>
  );
}

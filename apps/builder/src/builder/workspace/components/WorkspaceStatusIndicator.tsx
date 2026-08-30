import { useI18n } from "@/i18n";

interface WorkspaceStatusIndicatorProps {
  isCanvasReady: boolean;
  isContextLost: boolean;
}

export function WorkspaceStatusIndicator({
  isCanvasReady,
  isContextLost,
}: WorkspaceStatusIndicatorProps) {
  const { t } = useI18n();
  if (!isContextLost && isCanvasReady) {
    return null;
  }

  return (
    <div className="workspace-status-indicator">
      {isContextLost
        ? t("workspace.canvasRecovering")
        : t("workspace.canvasInitializing")}
    </div>
  );
}

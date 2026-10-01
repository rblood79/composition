import { useLayoutEffect, useRef } from "react";
import { useI18n } from "@/i18n";
import { measureCanvasViewportInset } from "./canvasViewportInset";
import { RULER_SIZE_PX } from "./rulerMetrics";

interface WorkspaceStatusIndicatorProps {
  isCanvasReady: boolean;
  isContextLost: boolean;
}

/** Gap between the pill and the ruler strip under the floating header. */
const PILL_GAP_PX = 8;

export function WorkspaceStatusIndicator({
  isCanvasReady,
  isContextLost,
}: WorkspaceStatusIndicatorProps) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement | null>(null);
  const visible = isContextLost || !isCanvasReady;

  // The canvas is full-bleed under the floating header, whose centre toolbar sits where the
  // pill's CSS `top` would put it (2026-10-01: header y 4–44 covered the pill at y 16). Read
  // the header's bottom (`canvasViewportInset`, as the rulers do) and clear the ruler strip.
  useLayoutEffect(() => {
    if (!visible || !ref.current) return;
    ref.current.style.top = `${measureCanvasViewportInset().top + RULER_SIZE_PX + PILL_GAP_PX}px`;
  }, [visible]);

  if (!visible) {
    return null;
  }

  return (
    <div ref={ref} className="workspace-status-indicator">
      {isContextLost
        ? t("workspace.canvasRecovering")
        : t("workspace.canvasInitializing")}
    </div>
  );
}

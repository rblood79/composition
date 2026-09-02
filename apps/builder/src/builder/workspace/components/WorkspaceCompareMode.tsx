import type { CSSProperties, ReactNode } from "react";
import { BuilderCanvas } from "../canvas/BuilderCanvas";
import { PanelSplitter } from "../../layout/PanelSplitter";
import type { CompareSplitterRange } from "../hooks/useWorkspaceCompareSplit";
import { useOptionalI18n } from "../../../i18n";
import { WorkspaceStatusIndicator } from "./WorkspaceStatusIndicator";

const COMPARE_CSS_PANE_ID = "workspace-compare-panel-css";
const RESIZE_LABEL_FALLBACK = "Resize the CSS / Canvas compare split";

interface WorkspaceCompareModeProps {
  /** Skia canvas 가 차지하는 우측 pane — viewport containerSize 측정 기준 */
  canvasAreaRef: React.RefObject<HTMLDivElement | null>;
  compareSplit: number;
  /** PanelSplitter 의 px 계약 (왼쪽 pane 너비) */
  splitter: CompareSplitterRange;
  fallbackCanvas: ReactNode;
  pageWidth: number;
  pageHeight: number;
  isCanvasReady: boolean;
  isContextLost: boolean;
  onResizeStart: () => void;
  onResize: (deltaX: number, deltaY: number) => void;
  onResizeEnd: () => void;
}

export function WorkspaceCompareMode({
  canvasAreaRef,
  compareSplit,
  splitter,
  fallbackCanvas,
  pageWidth,
  pageHeight,
  isCanvasReady,
  isContextLost,
  onResizeStart,
  onResize,
  onResizeEnd,
}: WorkspaceCompareModeProps) {
  const i18n = useOptionalI18n();
  const resizeLabel = i18n
    ? i18n.t("workspace.resizeCompare")
    : RESIZE_LABEL_FALLBACK;

  return (
    <div
      className="workspace-mode-content workspace--compare-mode"
      style={
        {
          "--compare-split": `${compareSplit}%`,
        } as CSSProperties
      }
    >
      <div
        id={COMPARE_CSS_PANE_ID}
        className="workspace-compare-panel workspace-compare-panel--left"
      >
        <div className="workspace-compare-label">CSS</div>
        <div className="workspace-compare-content">{fallbackCanvas}</div>
      </div>

      {/* 다른 resize 손잡이와 같은 PanelSplitter — 왼쪽 pane 의 오른쪽 edge 를 끈다 */}
      <div className="workspace-compare-resizer">
        <PanelSplitter
          edge="right"
          label={resizeLabel}
          controls={COMPARE_CSS_PANE_ID}
          value={splitter.value}
          minValue={splitter.minValue}
          maxValue={splitter.maxValue}
          className="workspace-compare-splitter"
          onResizeStart={onResizeStart}
          onResize={onResize}
          onResizeEnd={onResizeEnd}
        />
      </div>

      <div className="workspace-compare-panel workspace-compare-panel--right">
        <div className="workspace-compare-label">Canvas</div>
        <div ref={canvasAreaRef} className="workspace-compare-content">
          <BuilderCanvas pageWidth={pageWidth} pageHeight={pageHeight} />
        </div>
      </div>

      <WorkspaceStatusIndicator
        isCanvasReady={isCanvasReady}
        isContextLost={isContextLost}
      />
    </div>
  );
}

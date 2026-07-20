import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
import { BuilderCanvas } from "../canvas/BuilderCanvas";
import { WorkspaceStatusIndicator } from "./WorkspaceStatusIndicator";

interface WorkspaceCompareModeProps {
  /** Skia canvas 가 차지하는 우측 pane — viewport containerSize 측정 기준 */
  canvasAreaRef: React.RefObject<HTMLDivElement | null>;
  compareSplit: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  fallbackCanvas: ReactNode;
  pageWidth: number;
  pageHeight: number;
  isCanvasReady: boolean;
  isContextLost: boolean;
  onResizeStart: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onResizeMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onResizeEnd: () => void;
}

export function WorkspaceCompareMode({
  canvasAreaRef,
  compareSplit,
  containerRef,
  fallbackCanvas,
  pageWidth,
  pageHeight,
  isCanvasReady,
  isContextLost,
  onResizeStart,
  onResizeMove,
  onResizeEnd,
}: WorkspaceCompareModeProps) {
  return (
    <div
      ref={containerRef}
      className="workspace workspace--compare-mode"
      style={
        {
          "--compare-split": `${compareSplit}%`,
        } as CSSProperties
      }
    >
      <div className="workspace-compare-panel workspace-compare-panel--left">
        <div className="workspace-compare-label">CSS</div>
        <div className="workspace-compare-content">{fallbackCanvas}</div>
      </div>

      <div
        className="workspace-compare-resizer"
        onPointerDown={onResizeStart}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeEnd}
        onPointerCancel={onResizeEnd}
      />

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

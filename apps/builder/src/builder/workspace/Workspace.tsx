/**
 * Workspace Shell (ADR-035 Layer 1)
 *
 * Shell orchestration만 담당하며 canvas runtime 세부 구현을 모른다.
 *
 * 책임:
 * - Feature flag 기반 렌더 경로 선택 (WebGL / fallback / compare)
 * - Breakpoint → canvas size 계산 위임 (useWorkspaceCanvasSizing)
 * - Compare mode split 관리 위임 (useWorkspaceCompareSplit)
 * - Canvas ready/context lost 상태 구독 (UI 표시용)
 *
 * 위임 대상:
 * - BuilderCanvas — viewport, render, interaction runtime
 * - CanvasScrollbar — scroll UI
 * - WorkflowCanvasToggles — workflow overlay 토글
 * - WorkspaceCompareMode — 비교 모드 레이아웃
 * - WorkspaceStatusIndicator — 상태 표시
 */

import { useRef } from "react";
import { BuilderCanvas } from "./canvas/BuilderCanvas";
import { useCanvasLifecycleStore, useCompareModeStore } from "./canvas/stores";
import { isWebGLCanvas } from "../../utils/featureFlags";
import { CanvasScrollbar } from "./scrollbar";
import { ContextualActionBar } from "../components/overlay/actionBar";
import { WorkflowCanvasToggles } from "./components/WorkflowCanvasToggles";
import { WorkspaceCompareMode } from "./components/WorkspaceCompareMode";
import { WorkspaceStatusIndicator } from "./components/WorkspaceStatusIndicator";
import { useWorkspaceCanvasSizing } from "./hooks/useWorkspaceCanvasSizing";
import { useWorkspaceCompareSplit } from "./hooks/useWorkspaceCompareSplit";
import type { WorkspaceProps } from "./types";
import "./Workspace.css";

export function Workspace({
  breakpoint,
  breakpoints,
  fallbackCanvas,
}: WorkspaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // compare 모드에서 Skia canvas 가 차지하는 우측 pane — viewport containerSize 기준
  const canvasAreaRef = useRef<HTMLDivElement>(null);

  // Feature flags
  const useWebGL = isWebGLCanvas();
  const compareMode = useCompareModeStore((state) => state.isCompareMode);

  const {
    compareSplit,
    splitter,
    handleResizeEnd,
    handleResize,
    handleResizeStart,
  } = useWorkspaceCompareSplit({
    containerRef,
  });
  const { canvasSize } = useWorkspaceCanvasSizing({
    breakpoint,
    breakpoints,
    canvasAreaRef,
    compareMode,
    containerRef,
  });

  // Canvas sync store
  const isCanvasReady = useCanvasLifecycleStore((state) => state.isCanvasReady);
  const isContextLost = useCanvasLifecycleStore((state) => state.isContextLost);

  return (
    <main ref={containerRef} className="workspace">
      {compareMode && fallbackCanvas ? (
        <WorkspaceCompareMode
          canvasAreaRef={canvasAreaRef}
          compareSplit={compareSplit}
          splitter={splitter}
          fallbackCanvas={fallbackCanvas}
          pageWidth={canvasSize.width}
          pageHeight={canvasSize.height}
          isCanvasReady={isCanvasReady}
          isContextLost={isContextLost}
          onResizeStart={handleResizeStart}
          onResize={handleResize}
          onResizeEnd={handleResizeEnd}
        />
      ) : !useWebGL && fallbackCanvas ? (
        fallbackCanvas
      ) : (
        <>
          {/* WebGL Canvas (DOM depth 최소화: .workspace → .builder-canvas-container → canvas) */}
          <BuilderCanvas
            pageWidth={canvasSize.width}
            pageHeight={canvasSize.height}
          />

          {/* DOM Overlay Layer (B1.5에서 구현) */}
          <div className="workspace-overlay">
            {/* ADR-192 — 선택 컨텍스트 액션 바 (Photoshop 모델, 하단 중앙) */}
            <ContextualActionBar />
          </div>

          {/* Workflow Sub-Toggles + Legend (캔버스 상단 통합) */}
          <WorkflowCanvasToggles />

          {/* Figma-style Canvas Scrollbars */}
          <CanvasScrollbar direction="horizontal" />
          <CanvasScrollbar direction="vertical" />

          <WorkspaceStatusIndicator
            isCanvasReady={isCanvasReady}
            isContextLost={isContextLost}
          />
        </>
      )}
    </main>
  );
}

export default Workspace;

/**
 * NodesPanel - 페이지 노드 트리 패널
 *
 * PanelProps 인터페이스를 구현하여 패널 시스템과 통합
 * 🚀 Performance: PagesSection/LayersSection 분리로 리렌더링 범위 최소화
 */

import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useState,
} from "react";
import { useParams } from "react-router-dom";
import "./NodesPanel.css";
import { useStore } from "../../stores";
import { useEditModeStore } from "../../stores/editMode";
import { usePageManager, useIframeMessenger } from "@/builder/hooks";
import { NodesPanelTabs, type NodesPanelTabType } from "./NodesPanelTabs";
import { FramesTab } from "./FramesTab/FramesTab";
// 🚀 Performance: 분리된 섹션 컴포넌트
import { PagesSection } from "./PagesSection";
import { LayersSection } from "./LayersSection";
import {
  scheduleCancelableBackgroundTask,
  scheduleNextFrame,
} from "../../utils/scheduleTask";

// 비활성 gating 은 PanelContainer 의 <Activity mode="hidden"> 이 담당 (ADR-155)
export function NodesPanel() {
  // URL params
  const { projectId } = useParams<{ projectId: string }>();

  // Edit Mode state
  const editMode = useEditModeStore((state) => state.mode);

  // Hooks
  const { requestAutoSelectAfterUpdate } = useIframeMessenger();

  // 프로젝트 초기화 - pages가 비어있으면 초기화
  // 🚀 Performance: 탭 관련 상태만 구독
  const setEditMode = useEditModeStore((state) => state.setMode);
  const setEditModeCurrentPageId = useEditModeStore(
    (state) => state.setCurrentPageId,
  );
  const setEditModeCurrentLayoutId = useEditModeStore(
    (state) => state.setCurrentLayoutId,
  );

  // 현재 활성 탭 (Edit Mode에서 파생)
  const activeTab: NodesPanelTabType =
    editMode === "layout" ? "layouts" : "pages";

  // 탭 변경 핸들러
  const handleTabChange = useCallback(
    (tab: NodesPanelTabType) => {
      if (tab === "pages") {
        setEditMode("page");
        setEditModeCurrentLayoutId(null);
      } else {
        setEditMode("layout");
        setEditModeCurrentPageId(null);
      }
    },
    [setEditMode, setEditModeCurrentPageId, setEditModeCurrentLayoutId],
  );

  return (
    <div className="nodes-panel nodes-panel--new-tree">
      <NodesPanelTabs activeTab={activeTab} onTabChange={handleTabChange} />

      <div className="nodes-panel-content">
        {activeTab === "pages" ? (
          <PagesTabContent projectId={projectId} />
        ) : (
          <FramesTabContent
            projectId={projectId}
            requestAutoSelectAfterUpdate={requestAutoSelectAfterUpdate}
          />
        )}
      </div>
    </div>
  );
}

const PagesTabContent = memo(function PagesTabContent({
  projectId,
}: {
  projectId: string | undefined;
}) {
  const pageCount = useStore((state) => state.pages.length);
  const currentPageId = useStore((state) => state.currentPageId);
  const deferredCurrentPageId = useDeferredValue(currentPageId);
  const { requestAutoSelectAfterUpdate } = useIframeMessenger();
  const { initializeProject } = usePageManager({
    requestAutoSelectAfterUpdate,
  });
  const [visibleLayerPageId, setVisibleLayerPageId] = useState<string | null>(
    deferredCurrentPageId,
  );
  // 삭제된 페이지 감지 → currentPageId fallback (LayersSection unmount 방지)
  const activeLayerPageId = useStore(
    useCallback(
      (state) => {
        const pageId =
          visibleLayerPageId && visibleLayerPageId in state.pageElementsSnapshot
            ? visibleLayerPageId
            : state.currentPageId;
        if (!pageId) return null;
        const snapshot = state.pageElementsSnapshot[pageId];
        return snapshot && snapshot.length > 0 ? pageId : null;
      },
      [visibleLayerPageId],
    ),
  );

  useEffect(() => {
    if (projectId && pageCount === 0) {
      initializeProject(projectId);
    }
  }, [initializeProject, pageCount, projectId]);

  useEffect(() => {
    if (!deferredCurrentPageId) {
      return;
    }

    let cancelBackgroundTask: (() => void) | undefined;
    const taskId = scheduleNextFrame(() => {
      cancelBackgroundTask = scheduleCancelableBackgroundTask(() => {
        setVisibleLayerPageId(deferredCurrentPageId);
      });
    });

    return () => {
      cancelBackgroundTask?.();
      if (typeof cancelAnimationFrame !== "undefined") {
        cancelAnimationFrame(taskId);
      } else {
        clearTimeout(taskId);
      }
    };
  }, [deferredCurrentPageId]);

  if (!currentPageId && pageCount === 0) {
    return (
      <div className="panel-empty-state">
        <p className="empty-message">페이지를 선택하세요</p>
      </div>
    );
  }

  return (
    <>
      <PagesSection projectId={projectId} />
      {activeLayerPageId ? (
        <LayersSection currentPageId={activeLayerPageId} />
      ) : (
        <div className="section" aria-hidden="true" style={{ minHeight: 72 }} />
      )}
    </>
  );
});

const FramesTabContent = memo(function FramesTabContent({
  projectId,
  requestAutoSelectAfterUpdate,
}: {
  projectId: string | undefined;
  requestAutoSelectAfterUpdate?: (elementId: string) => void;
}) {
  const selectedElementId = useStore((state) => state.selectedElementId);
  const setSelectedElement = useStore((state) => state.setSelectedElement);
  const { sendElementSelectedMessage } = useIframeMessenger();

  return (
    <FramesTab
      selectedElementId={selectedElementId}
      setSelectedElement={setSelectedElement}
      sendElementSelectedMessage={sendElementSelectedMessage}
      requestAutoSelectAfterUpdate={requestAutoSelectAfterUpdate!}
      projectId={projectId}
    />
  );
});

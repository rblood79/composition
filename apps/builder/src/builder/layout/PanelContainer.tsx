/**
 * PanelContainer - 패널 콘텐츠 컨테이너
 *
 * ✅ 성능 최적화: 모든 패널을 항상 렌더링하고 CSS transform으로 표시/숨김 제어
 * - React remount 비용 제거
 * - 상태 보존 (스크롤, 입력값 등)
 * - 부드러운 애니메이션 가능
 * - 동일한 패널 toggle 시 위치만 재조정
 *
 * 🚀 성능 최적화 (2024-12): React.memo로 불필요한 리렌더링 방지
 */

import { Activity, memo, useMemo } from "react";
import type { PanelSide, PanelId } from "../panels/core/types";
import { PanelRegistry } from "../panels/core/PanelRegistry";

/**
 * ADR-155 Phase 2: 전 패널 Activity gating.
 * 비활성 패널을 <Activity mode="hidden"> 으로 감싸 store 구독·effect 를 내리고
 * 갱신을 클릭 task 밖으로 지연 (상태·DOM 은 보존, 재활성 시 최신화).
 * data-active CSS (슬라이드 애니메이션) 는 그대로 유지 — 속성축 분리 (design §5.5 (c)).
 * 숨김 중에도 필요한 부수효과 (캔버스 전역 단축키 등) 는 CanvasSelectionShortcuts
 * host / BuilderCore 부트스트랩으로 이전 완료 (design §5 inventory).
 */

export interface PanelContainerProps {
  /** 현재 사이드 (left/right) */
  side: PanelSide;

  /** 이 사이드에 배치된 모든 패널 ID 목록 */
  panelIds: PanelId[];

  /** 현재 활성 패널 ID 배열 (Multi toggle 지원) */
  activePanels: PanelId[];

  /** 사이드 표시 여부 */
  show: boolean;
}

/**
 * 🚀 개별 패널 래퍼 - memo로 불필요한 리렌더링 방지
 */
interface PanelWrapperProps {
  panelId: PanelId;
  side: PanelSide;
  isActive: boolean;
  panelWidth: number;
}

/**
 * 🚀 패널 콘텐츠 - memo로 side/panelId 변경 시에만 리렌더링
 */
interface PanelContentProps {
  panelId: PanelId;
  side: PanelSide;
}

const PanelContent = memo(function PanelContent({
  panelId,
  side,
}: PanelContentProps) {
  const panelConfig = PanelRegistry.getPanel(panelId);
  if (!panelConfig) {
    console.warn(`[PanelContainer] Panel "${panelId}" not found in registry`);
    return null;
  }
  const PanelComponent = panelConfig.component;
  return <PanelComponent isActive={true} side={side} onClose={undefined} />;
});

/**
 * 🚀 패널 래퍼 - isActive 변경 시에도 PanelContent는 리렌더링 안 함
 */
function PanelWrapper({
  panelId,
  side,
  isActive,
  panelWidth,
}: PanelWrapperProps) {
  const content = <PanelContent panelId={panelId} side={side} />;
  return (
    <div
      className="panel-wrapper"
      data-panel={panelId}
      data-active={isActive}
      style={{
        ["--panel-width" as string]: `${panelWidth}px`,
        width: `${panelWidth}px`,
        minWidth: `${panelWidth}px`,
      }}
    >
      <Activity mode={isActive ? "visible" : "hidden"}>{content}</Activity>
    </div>
  );
}

export const PanelContainer = memo(function PanelContainer({
  side,
  panelIds,
  activePanels,
  show,
}: PanelContainerProps) {
  // ✅ 최적화: 모든 패널을 항상 렌더링하고 CSS로 표시/숨김 제어
  // - activePanels에 있으면 보이고, 없으면 transform으로 숨김
  // - 패널 컴포넌트는 isActive prop으로 실제 활성 상태를 받음

  // 🚀 패널별 width 메모이제이션 (PanelRegistry 조회 최소화)
  // Note: React Hooks 규칙 준수를 위해 조건문 이전에 호출
  const panelWidths = useMemo(() => {
    const widths: Record<string, number> = {};
    for (const panelId of panelIds) {
      const config = PanelRegistry.getPanel(panelId);
      widths[panelId] = config?.minWidth || 233;
    }
    return widths;
  }, [panelIds]);

  // 활성 패널이 없고 show가 false인 경우 빈 상태 표시
  if (activePanels.length === 0 && !show) {
    return (
      <div
        className="panel-container"
        data-show={false}
        data-side={side}
        aria-hidden={true}
      >
        <div className="panel-empty-state">
          <p className="empty-message">패널을 선택하세요</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="panel-container"
      data-show={show}
      data-side={side}
      aria-hidden={!show}
    >
      <div className="panel-content">
        {panelIds.map((panelId) => (
          <PanelWrapper
            key={panelId}
            panelId={panelId}
            side={side}
            isActive={activePanels.includes(panelId)}
            panelWidth={panelWidths[panelId]}
          />
        ))}
      </div>
    </div>
  );
});

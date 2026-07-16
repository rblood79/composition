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

import {
  Activity,
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const scrollMemoryRef = useRef(
    new Map<Element, { top: number; left: number }>(),
  );
  const isActiveRef = useRef(isActive);
  const restoringRef = useRef(false);

  // ADR-155 G4: Activity hidden 은 display:none 이라 자손의 DOM 스크롤 offset 이
  // 소실된다 (이전 content-visibility:auto 숨김은 box 유지로 보존). scroll 을
  // capture 로 기록해 두고 재활성 commit 시점에 복원한다. hidden 중에는 scroll
  // 이벤트가 발생하지 않으므로 기록은 visible 구간의 최종값이다.
  useEffect(() => {
    const node = wrapperRef.current;
    if (!node) return;
    const onScroll = (e: Event) => {
      // 숨김 전환·복원 중 브라우저 clamp 가 쏘는 scroll(0) 이 기록을 덮지 않게 차단
      if (!isActiveRef.current || restoringRef.current) return;
      const t = e.target;
      if (t instanceof Element) {
        scrollMemoryRef.current.set(t, {
          top: t.scrollTop,
          left: t.scrollLeft,
        });
      }
    };
    node.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () =>
      node.removeEventListener("scroll", onScroll, { capture: true });
  }, []);

  // Activity 의 visible 전환은 부모 commit 과 별개 pass 로 display 를 복구할 수
  // 있어, 동기 layout effect 시점에는 box 부재로 scrollTop 대입이 0 으로 clamp
  // 될 수 있다 — 적용 확인될 때까지 rAF 로 수 프레임 재시도.
  useLayoutEffect(() => {
    isActiveRef.current = isActive;
    if (!isActive) return;
    restoringRef.current = true;
    let raf = 0;
    let attempts = 0;
    const restore = () => {
      let pending = false;
      for (const [el, pos] of scrollMemoryRef.current) {
        if (!el.isConnected) {
          scrollMemoryRef.current.delete(el);
          continue;
        }
        if (el.scrollTop !== pos.top) el.scrollTop = pos.top;
        if (el.scrollLeft !== pos.left) el.scrollLeft = pos.left;
        if (el.scrollTop !== pos.top || el.scrollLeft !== pos.left) {
          pending = true;
        }
      }
      if (pending && attempts++ < 10) {
        raf = requestAnimationFrame(restore);
      } else {
        restoringRef.current = false;
      }
    };
    restore();
    return () => {
      cancelAnimationFrame(raf);
      restoringRef.current = false;
    };
  }, [isActive]);

  const content = <PanelContent panelId={panelId} side={side} />;
  return (
    <div
      ref={wrapperRef}
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

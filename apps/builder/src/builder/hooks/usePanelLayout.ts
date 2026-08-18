/**
 * usePanelLayout Hook
 *
 * 패널 레이아웃 상태 관리 및 액션 제공
 * Zustand store와 연동
 * @since Phase 2 - 승격 from layout/ (2025-12-30)
 */

import { useCallback } from "react";
import { useStore } from "../stores";
import type {
  PanelId,
  PanelSide,
  PanelLayoutState,
  ModalPanelState,
  PanelSize,
} from "../panels/core/types";
import { PanelRegistry } from "../panels/core/PanelRegistry";
import type { UsePanelLayoutReturn } from "../layout/types";

/** stale closure 방지: callback 내부에서 최신 panelLayout 읽기 */
const getLayout = () => useStore.getState().panelLayout;
const WORKSPACE_TOP = 48;

function getPanelSide(
  layout: PanelLayoutState,
  panelId: PanelId,
): PanelSide | null {
  if (layout.leftPanels.includes(panelId)) return "left";
  if (layout.rightPanels.includes(panelId)) return "right";
  if (layout.bottomPanels.includes(panelId)) return "bottom";
  return null;
}

function removePanelFromDockLists(
  layout: PanelLayoutState,
  panelId: PanelId,
): PanelLayoutState {
  return {
    ...layout,
    leftPanels: layout.leftPanels.filter((id) => id !== panelId),
    rightPanels: layout.rightPanels.filter((id) => id !== panelId),
    bottomPanels: layout.bottomPanels.filter((id) => id !== panelId),
    activeLeftPanels: layout.activeLeftPanels.filter((id) => id !== panelId),
    activeRightPanels: layout.activeRightPanels.filter((id) => id !== panelId),
    activeBottomPanels: layout.activeBottomPanels.filter(
      (id) => id !== panelId,
    ),
  };
}

function addPanelToDock(
  layout: PanelLayoutState,
  panelId: PanelId,
  side: PanelSide,
): PanelLayoutState {
  const withoutPanel = removePanelFromDockLists(layout, panelId);
  const modalPanels = withoutPanel.modalPanels.filter(
    (panel) => panel.panelId !== panelId,
  );

  if (side === "left") {
    return {
      ...withoutPanel,
      leftPanels: [...withoutPanel.leftPanels, panelId],
      activeLeftPanels: [...withoutPanel.activeLeftPanels, panelId],
      showLeft: true,
      modalPanels,
    };
  }
  if (side === "right") {
    return {
      ...withoutPanel,
      rightPanels: [...withoutPanel.rightPanels, panelId],
      activeRightPanels: [...withoutPanel.activeRightPanels, panelId],
      showRight: true,
      modalPanels,
    };
  }
  return {
    ...withoutPanel,
    bottomPanels: [...withoutPanel.bottomPanels, panelId],
    activeBottomPanels: [panelId],
    showBottom: true,
    modalPanels,
  };
}

/**
 * 패널 레이아웃 관리 훅
 *
 * panelLayout 최상위 필드(showLeft, activeLeftPanels 등)를 shallow 비교하여
 * 변경되지 않은 필드만 사용하는 소비자의 불필요한 리렌더를 방지한다.
 *
 * @returns 레이아웃 상태 및 액션
 */
export function usePanelLayout(): UsePanelLayoutReturn {
  const layout = useStore((state) => state.panelLayout);
  const setPanelLayout = useStore((state) => state.setPanelLayout);

  /**
   * 패널을 다른 사이드로 이동
   */
  const movePanel = useCallback(
    (panelId: PanelId, from: PanelSide, to: PanelSide) => {
      if (from === to) return;

      const currentLayout = getLayout();
      if (getPanelSide(currentLayout, panelId) !== from) {
        console.warn(
          `[usePanelLayout] Panel "${panelId}" not found in ${from} side`,
        );
        return;
      }
      setPanelLayout(addPanelToDock(currentLayout, panelId, to));
    },
    [setPanelLayout],
  );

  const dockPanel = useCallback(
    (panelId: PanelId, side: PanelSide) => {
      setPanelLayout(addPanelToDock(getLayout(), panelId, side));
    },
    [setPanelLayout],
  );

  /**
   * 패널 토글 (활성화/비활성화) - Multi toggle 지원
   *
   * ✅ 성능 최적화: 패널을 DOM에서 제거하지 않고 CSS transform으로만 숨김
   * - 패널을 열면 사이드바도 자동으로 열림 (showLeft/showRight = true)
   * - 패널을 닫아도 사이드바는 열려있음 (다른 패널이 열려있을 수 있으므로)
   * - 패널은 activePanels 배열에서 제거되지만 DOM에는 유지됨
   */
  const togglePanel = useCallback(
    (side: PanelSide, panelId: PanelId) => {
      const currentLayout = getLayout();
      const actualSide = getPanelSide(currentLayout, panelId) ?? side;
      if (actualSide === "left") {
        const isActive = currentLayout.activeLeftPanels.includes(panelId);
        setPanelLayout({
          ...currentLayout,
          leftPanels: currentLayout.leftPanels.includes(panelId)
            ? currentLayout.leftPanels
            : [...currentLayout.leftPanels, panelId],
          activeLeftPanels: isActive
            ? currentLayout.activeLeftPanels.filter((id) => id !== panelId)
            : [...currentLayout.activeLeftPanels, panelId],
          showLeft: true,
        });
        return;
      }
      if (actualSide === "right") {
        const isActive = currentLayout.activeRightPanels.includes(panelId);
        setPanelLayout({
          ...currentLayout,
          rightPanels: currentLayout.rightPanels.includes(panelId)
            ? currentLayout.rightPanels
            : [...currentLayout.rightPanels, panelId],
          activeRightPanels: isActive
            ? currentLayout.activeRightPanels.filter((id) => id !== panelId)
            : [...currentLayout.activeRightPanels, panelId],
          showRight: true,
        });
        return;
      }

      const isActive = currentLayout.activeBottomPanels.includes(panelId);
      setPanelLayout({
        ...currentLayout,
        bottomPanels: currentLayout.bottomPanels.includes(panelId)
          ? currentLayout.bottomPanels
          : [...currentLayout.bottomPanels, panelId],
        activeBottomPanels: isActive ? [] : [panelId],
        showBottom: !isActive,
      });
    },
    [setPanelLayout],
  );

  /**
   * 레이아웃 초기화
   */
  const resetLayout = useCallback(() => {
    const resetLayoutAction = useStore.getState().resetPanelLayout;
    if (resetLayoutAction) {
      resetLayoutAction();
    }
  }, []);

  /**
   * 레이아웃 전체 설정
   */
  const setLayout = useCallback(
    (newLayout: PanelLayoutState) => {
      setPanelLayout(newLayout);
    },
    [setPanelLayout],
  );

  /**
   * 하단 패널 토글 (활성화/비활성화)
   */
  const toggleBottomPanel = useCallback(
    (panelId: PanelId) => {
      const currentLayout = getLayout();

      // 패널이 bottom에 없으면 무시
      if (!currentLayout.bottomPanels.includes(panelId)) {
        console.warn(
          `[usePanelLayout] Panel "${panelId}" not available on bottom`,
        );
        return;
      }

      const isActive = currentLayout.activeBottomPanels.includes(panelId);

      setPanelLayout({
        ...currentLayout,
        activeBottomPanels: isActive ? [] : [panelId],
        showBottom: !isActive,
      });
    },
    [setPanelLayout],
  );

  /**
   * 하단 패널 높이 설정 (150px ~ 600px)
   */
  const setBottomHeight = useCallback(
    (height: number) => {
      const clampedHeight = Math.max(150, Math.min(600, height));
      const currentLayout = getLayout();
      setPanelLayout({
        ...currentLayout,
        bottomHeight: clampedHeight,
      });
    },
    [setPanelLayout],
  );

  /**
   * 하단 패널 닫기
   */
  const closeBottomPanel = useCallback(() => {
    const currentLayout = getLayout();
    setPanelLayout({
      ...currentLayout,
      activeBottomPanels: [],
      showBottom: false,
    });
  }, [setPanelLayout]);

  /**
   * 위치 경계 검사 (화면 밖으로 나가지 않도록 clamp)
   */
  const clampPosition = useCallback(
    (x: number, y: number, width: number, height: number) => ({
      x: Math.max(0, Math.min(x, window.innerWidth - width)),
      y: Math.max(0, Math.min(y, window.innerHeight - WORKSPACE_TOP - height)),
    }),
    [],
  );

  const updatePanelSize = useCallback(
    (panelId: PanelId, size: PanelSize) => {
      const currentLayout = getLayout();
      const panelConfig = PanelRegistry.getPanel(panelId);
      const minWidth = panelConfig?.minWidth ?? 200;
      const maxWidth = panelConfig?.maxWidth ?? 800;
      const minHeight = panelConfig?.minHeight ?? 160;
      const maxHeight = panelConfig?.maxHeight ?? 800;
      const clampedSize = {
        width: Math.max(minWidth, Math.min(maxWidth, size.width)),
        height: Math.max(minHeight, Math.min(maxHeight, size.height)),
      };

      setPanelLayout({
        ...currentLayout,
        panelSizes: {
          ...currentLayout.panelSizes,
          [panelId]: clampedSize,
        },
        modalPanels: currentLayout.modalPanels.map((panel) =>
          panel.panelId === panelId ? { ...panel, size: clampedSize } : panel,
        ),
      });
    },
    [setPanelLayout],
  );

  const floatPanel = useCallback(
    (panelId: PanelId, position?: { x: number; y: number }) => {
      const currentLayout = getLayout();
      const existing = currentLayout.modalPanels.find(
        (panel) => panel.panelId === panelId,
      );
      if (existing) {
        const nextPosition = position
          ? clampPosition(
              position.x,
              position.y,
              existing.size.width,
              existing.size.height,
            )
          : existing.position;
        setPanelLayout({
          ...currentLayout,
          modalPanels: currentLayout.modalPanels.map((panel) =>
            panel.panelId === panelId
              ? {
                  ...panel,
                  position: nextPosition,
                  zIndex: currentLayout.nextModalZIndex,
                }
              : panel,
          ),
          nextModalZIndex: currentLayout.nextModalZIndex + 1,
        });
        return;
      }

      const panelConfig = PanelRegistry.getPanel(panelId);
      if (!panelConfig) return;
      const side =
        getPanelSide(currentLayout, panelId) ?? panelConfig.defaultPosition;
      const dockedLayout = addPanelToDock(currentLayout, panelId, side);
      const size = currentLayout.panelSizes[panelId] ?? {
        width: panelConfig.defaultWidth ?? panelConfig.minWidth ?? 320,
        height: panelConfig.defaultHeight ?? panelConfig.minHeight ?? 420,
      };
      const initial = position ?? {
        x: Math.max(24, (window.innerWidth - size.width) / 2),
        y: Math.max(24, (window.innerHeight - WORKSPACE_TOP - size.height) / 2),
      };
      const clamped = clampPosition(
        initial.x,
        initial.y,
        size.width,
        size.height,
      );
      const floatingPanel: ModalPanelState = {
        panelId,
        mode: "floating",
        position: clamped,
        size,
        zIndex: dockedLayout.nextModalZIndex,
      };

      setPanelLayout({
        ...dockedLayout,
        panelSizes: { ...dockedLayout.panelSizes, [panelId]: size },
        modalPanels: [...dockedLayout.modalPanels, floatingPanel],
        nextModalZIndex: dockedLayout.nextModalZIndex + 1,
      });
    },
    [clampPosition, setPanelLayout],
  );

  const placePanel = useCallback(
    (panelId: PanelId, position: { x: number; y: number }) => {
      floatPanel(panelId, position);
    },
    [floatPanel],
  );

  /** 기존 호출부 호환 alias — 실제 표시는 non-modal floating frame이다. */
  const openPanelAsModal = floatPanel;

  const hidePanel = useCallback(
    (panelId: PanelId) => {
      const currentLayout = getLayout();
      setPanelLayout({
        ...currentLayout,
        activeLeftPanels: currentLayout.activeLeftPanels.filter(
          (id) => id !== panelId,
        ),
        activeRightPanels: currentLayout.activeRightPanels.filter(
          (id) => id !== panelId,
        ),
        activeBottomPanels: currentLayout.activeBottomPanels.filter(
          (id) => id !== panelId,
        ),
        modalPanels: currentLayout.modalPanels.filter(
          (panel) => panel.panelId !== panelId,
        ),
      });
    },
    [setPanelLayout],
  );

  /**
   * Modal 패널 닫기
   */
  const closeModalPanel = useCallback(
    (panelId: PanelId) => {
      const currentLayout = getLayout();
      setPanelLayout({
        ...currentLayout,
        modalPanels: currentLayout.modalPanels.filter(
          (p) => p.panelId !== panelId,
        ),
      });
    },
    [setPanelLayout],
  );

  /**
   * Modal 패널 포커스 (z-index 업데이트)
   */
  const focusModalPanel = useCallback(
    (panelId: PanelId) => {
      const currentLayout = getLayout();
      const panel = currentLayout.modalPanels.find(
        (p) => p.panelId === panelId,
      );
      if (!panel) return;

      // 이미 최상위면 무시
      const maxZIndex = Math.max(
        ...currentLayout.modalPanels.map((p) => p.zIndex),
      );
      if (panel.zIndex === maxZIndex) return;

      setPanelLayout({
        ...currentLayout,
        modalPanels: currentLayout.modalPanels.map((p) =>
          p.panelId === panelId
            ? { ...p, zIndex: currentLayout.nextModalZIndex }
            : p,
        ),
        nextModalZIndex: currentLayout.nextModalZIndex + 1,
      });
    },
    [setPanelLayout],
  );

  /**
   * Modal 패널 위치 업데이트
   */
  const updateModalPanelPosition = useCallback(
    (panelId: PanelId, position: { x: number; y: number }) => {
      const currentLayout = getLayout();
      const panel = currentLayout.modalPanels.find(
        (p) => p.panelId === panelId,
      );
      if (!panel) return;

      // 위치 경계 검사
      const clamped = clampPosition(
        position.x,
        position.y,
        panel.size.width,
        panel.size.height,
      );

      setPanelLayout({
        ...currentLayout,
        modalPanels: currentLayout.modalPanels.map((p) =>
          p.panelId === panelId ? { ...p, position: clamped } : p,
        ),
      });
    },
    [setPanelLayout, clampPosition],
  );

  /**
   * Modal 패널 크기 업데이트
   */
  const updateModalPanelSize = updatePanelSize;

  /**
   * 모든 Modal 패널 닫기
   */
  const closeAllModalPanels = useCallback(() => {
    const currentLayout = getLayout();
    setPanelLayout({
      ...currentLayout,
      modalPanels: [],
    });
  }, [setPanelLayout]);

  return {
    layout,
    isLoading: false, // 나중에 비동기 로딩 추가 시 사용
    isLoaded: true,
    movePanel,
    dockPanel,
    floatPanel,
    placePanel,
    hidePanel,
    updatePanelSize,
    togglePanel,
    resetLayout,
    setLayout,
    toggleBottomPanel,
    setBottomHeight,
    closeBottomPanel,
    // Modal 패널 액션
    openPanelAsModal,
    closeModalPanel,
    focusModalPanel,
    updateModalPanelPosition,
    updateModalPanelSize,
    closeAllModalPanels,
  };
}

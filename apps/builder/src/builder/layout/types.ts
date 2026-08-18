/**
 * Layout Types
 *
 * 레이아웃 시스템에서 사용하는 타입 정의
 */

import type {
  PanelId,
  PanelLayoutState,
  PanelLayoutActions,
} from "../panels/core/types";
import type {
  PanelWorkspaceLayoutV2,
  PanelWorkspaceRegistryEntry,
} from "./panelWorkspaceLayoutV2";

// `PanelAreaProps` 는 여기 두지 않는다 — 정본은 `PanelArea.tsx` 의 선언이고
// `layout/index.ts` 가 그것을 재수출한다. 종전에 이 파일에도 동명 선언이
// 있었는데 `availablePanels` / `activePanel` / `onSelectPanel` / `isVisible`
// 4필드를 요구하는 **구 API** 를 서술하고 있었다 (현행 컴포넌트는 `side`
// 하나만 받고 나머지는 `usePanelLayout()` 으로 직접 읽는다). 소비처 0건이라
// 컴파일러가 잡지 못한 채 잘못된 계약을 광고하고 있었다.

/**
 * usePanelLayout 반환 타입
 */
export interface UsePanelLayoutReturn extends PanelLayoutActions {
  /** 현재 레이아웃 상태 */
  layout: PanelLayoutState;

  /** ADR-922 production placement/visibility SSOT. */
  workspaceLayout: PanelWorkspaceLayoutV2 | null;

  initializeWorkspaceLayout: (
    registry: readonly PanelWorkspaceRegistryEntry[],
  ) => boolean;

  setWorkspaceLayout: (layout: PanelWorkspaceLayoutV2) => boolean;

  /** 로딩 상태 */
  isLoading: boolean;

  /** 레이아웃이 로컬스토리지에서 로드되었는지 */
  isLoaded: boolean;

  /** 패널을 Modal로 열기 */
  openPanelAsModal: (panelId: PanelId) => void;

  /** Modal 패널 닫기 */
  closeModalPanel: (panelId: PanelId) => void;

  /** Modal 패널 포커스 (z-index 업데이트) */
  focusModalPanel: (panelId: PanelId) => void;

  /** Modal 패널 위치 업데이트 */
  updateModalPanelPosition: (
    panelId: PanelId,
    position: { x: number; y: number },
  ) => void;

  /** Modal 패널 크기 업데이트 */
  updateModalPanelSize: (
    panelId: PanelId,
    size: { width: number; height: number },
  ) => void;

  /** 모든 Modal 패널 닫기 */
  closeAllModalPanels: () => void;
}

/**
 * 레이아웃 저장 키
 */
export const PANEL_LAYOUT_STORAGE_KEY = "composition-panel-layout";

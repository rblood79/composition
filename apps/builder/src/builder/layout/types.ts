/**
 * Layout Types
 *
 * 레이아웃 시스템에서 사용하는 타입 정의
 */

import type { PanelId } from "../panels/core/types";
import type {
  PanelWorkspaceLayoutV2,
  PanelWorkspaceRegistryEntry,
} from "./panelWorkspaceLayoutV2";

/**
 * usePanelLayout 반환 타입
 */
export interface UsePanelLayoutReturn {
  /** ADR-922 production placement/visibility SSOT. */
  workspaceLayout: PanelWorkspaceLayoutV2 | null;

  initializeWorkspaceLayout: (
    registry: readonly PanelWorkspaceRegistryEntry[],
  ) => boolean;

  setWorkspaceLayout: (layout: PanelWorkspaceLayoutV2) => boolean;

  /** rail/placement와 무관하게 visibility를 전환한다. */
  togglePanel: (panelId: PanelId) => void;

  /** 패널을 floating cluster로 분리한다. */
  floatPanel: (panelId: PanelId, position?: { x: number; y: number }) => void;

  /** floating cluster의 focus order를 갱신한다. */
  focusFloatingPanel: (panelId: PanelId) => void;
}

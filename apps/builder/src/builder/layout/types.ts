/**
 * Layout Types
 *
 * 레이아웃 시스템에서 사용하는 타입 정의
 */

import type { PanelId } from "../panels/core/types";
import type {
  PanelWorkspaceRect,
  PanelWorkspaceRegistryEntry,
} from "./panelWorkspaceLayoutV2";
import type { PanelWorkspaceLayoutV4 } from "./panelWorkspaceLayoutV4";

/**
 * usePanelLayout 반환 타입
 */
export interface UsePanelLayoutReturn {
  /** ADR-922 production placement/visibility SSOT. */
  workspaceLayout: PanelWorkspaceLayoutV4 | null;

  initializeWorkspaceLayout: (
    registry: readonly PanelWorkspaceRegistryEntry[],
    surfaceRect: PanelWorkspaceRect,
  ) => boolean;

  setWorkspaceLayout: (layout: PanelWorkspaceLayoutV4) => boolean;

  /** rail/placement와 무관하게 visibility를 전환한다. */
  togglePanel: (panelId: PanelId) => void;

  /** zone-owned cluster의 focus order를 갱신한다. */
  focusPanel: (panelId: PanelId) => void;

  /** registry default rail과 zone placement로 명시적으로 복원한다. */
  resetWorkspaceLayout: () => boolean;
}

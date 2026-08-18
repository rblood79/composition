/**
 * Panel Layout Slice
 *
 * 패널 레이아웃 상태를 관리하는 Zustand slice
 */

import type { StateCreator } from "zustand";
import type { PanelLayoutState } from "../panels/core/types";
import { DEFAULT_PANEL_LAYOUT } from "../panels/core/types";
import { PANEL_LAYOUT_STORAGE_KEY } from "../layout/types";

/**
 * Panel Layout State
 */
export interface PanelLayoutSliceState {
  panelLayout: PanelLayoutState;
}

/**
 * Panel Layout Actions
 */
export interface PanelLayoutSliceActions {
  setPanelLayout: (layout: PanelLayoutState) => void;
  resetPanelLayout: () => void;
  savePanelLayoutToStorage: () => void;
  loadPanelLayoutFromStorage: () => void;
}

/**
 * Panel Layout Slice 전체 타입
 */
export type PanelLayoutSlice = PanelLayoutSliceState & PanelLayoutSliceActions;

/**
 * LocalStorage에서 레이아웃 로드
 */
function loadLayoutFromStorage():
  | import("../panels/core/types").PanelLayoutState
  | null {
  try {
    const stored = localStorage.getItem(PANEL_LAYOUT_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);

      // 마이그레이션: 구 형식(activeLeftPanel/activeRightPanel) → 신 형식(배열)
      const migrated = { ...parsed };

      // activeLeftPanel(구) → activeLeftPanels(신)
      if (
        "activeLeftPanel" in parsed &&
        !Array.isArray(parsed.activeLeftPanels)
      ) {
        migrated.activeLeftPanels = parsed.activeLeftPanel
          ? [parsed.activeLeftPanel]
          : [];
        delete migrated.activeLeftPanel;
      }

      // activeRightPanel(구) → activeRightPanels(신)
      if (
        "activeRightPanel" in parsed &&
        !Array.isArray(parsed.activeRightPanels)
      ) {
        migrated.activeRightPanels = parsed.activeRightPanel
          ? [parsed.activeRightPanel]
          : [];
        delete migrated.activeRightPanel;
      }

      // 기본값과 병합하여 누락된 필드 방지
      const result = {
        ...DEFAULT_PANEL_LAYOUT,
        ...migrated,
      };

      // 배열 유효성 검증
      if (!Array.isArray(result.activeLeftPanels)) {
        result.activeLeftPanels = DEFAULT_PANEL_LAYOUT.activeLeftPanels;
      }
      if (!Array.isArray(result.activeRightPanels)) {
        result.activeRightPanels = DEFAULT_PANEL_LAYOUT.activeRightPanels;
      }

      // Bottom panel 마이그레이션 (Phase 2에서 추가)
      if (!Array.isArray(result.bottomPanels)) {
        result.bottomPanels = DEFAULT_PANEL_LAYOUT.bottomPanels;
      }
      if (!Array.isArray(result.activeBottomPanels)) {
        result.activeBottomPanels = DEFAULT_PANEL_LAYOUT.activeBottomPanels;
      }
      if (typeof result.showBottom !== "boolean") {
        result.showBottom = DEFAULT_PANEL_LAYOUT.showBottom;
      }
      if (typeof result.bottomHeight !== "number") {
        result.bottomHeight = DEFAULT_PANEL_LAYOUT.bottomHeight;
      }
      if (
        typeof result.panelSizes !== "object" ||
        result.panelSizes === null ||
        Array.isArray(result.panelSizes)
      ) {
        result.panelSizes = DEFAULT_PANEL_LAYOUT.panelSizes;
      }
      // datatableEditor가 leftPanels에 없으면 추가
      if (
        Array.isArray(result.leftPanels) &&
        !result.leftPanels.includes("datatableEditor")
      ) {
        const datatableIndex = result.leftPanels.indexOf("datatable");
        if (datatableIndex >= 0) {
          // datatable 바로 뒤에 삽입
          result.leftPanels.splice(datatableIndex + 1, 0, "datatableEditor");
        } else {
          // datatable이 없으면 맨 뒤에 추가
          result.leftPanels.push("datatableEditor");
        }
      }

      // 모든 panel registry 항목은 activity rail에서 다시 열 수 있어야 한다.
      if (
        Array.isArray(result.leftPanels) &&
        !result.leftPanels.includes("settings")
      ) {
        result.leftPanels.push("settings");
      }

      // 마이그레이션: 제거된 'data' 패널 제거
      if (Array.isArray(result.rightPanels)) {
        result.rightPanels = result.rightPanels.filter(
          (id: string) => id !== "data",
        );
      }
      if (Array.isArray(result.activeRightPanels)) {
        result.activeRightPanels = result.activeRightPanels.filter(
          (id: string) => id !== "data",
        );
      }
      if (Array.isArray(result.leftPanels)) {
        result.leftPanels = result.leftPanels.filter(
          (id: string) => id !== "data",
        );
      }
      if (Array.isArray(result.activeLeftPanels)) {
        result.activeLeftPanels = result.activeLeftPanels.filter(
          (id: string) => id !== "data",
        );
      }
      if (Array.isArray(result.bottomPanels)) {
        result.bottomPanels = result.bottomPanels.filter(
          (id: string) => id !== "data",
        );
      }
      if (Array.isArray(result.activeBottomPanels)) {
        result.activeBottomPanels = result.activeBottomPanels.filter(
          (id: string) => id !== "data",
        );
      }

      // history 패널 추가 (신규 패널 마이그레이션)
      if (
        Array.isArray(result.rightPanels) &&
        !result.rightPanels.includes("history")
      ) {
        const eventsIndex = result.rightPanels.indexOf("events");
        if (eventsIndex >= 0) {
          result.rightPanels.splice(eventsIndex + 1, 0, "history");
        } else {
          result.rightPanels.push("history");
        }
      }

      // 구 Modal 상태는 Photoshop식 non-modal floating frame으로 승격한다.
      if (Array.isArray(result.modalPanels)) {
        result.modalPanels = result.modalPanels.map(
          (panel: import("../panels/core/types").ModalPanelState) => ({
            ...panel,
            mode: "floating" as const,
          }),
        );
      }

      return result;
    }
  } catch (error) {
    console.error("[PanelLayout] Failed to load from localStorage:", error);
  }
  return null;
}

/**
 * LocalStorage에 레이아웃 저장 (디바운스 300ms)
 * 패널 드래그/리사이즈 등 고빈도 호출 시 마지막 상태만 저장
 */
let _saveTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedSaveLayoutToStorage(
  layout: import("../panels/core/types").PanelLayoutState,
): void {
  if (_saveTimer !== null) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    try {
      localStorage.setItem(PANEL_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
    } catch (error) {
      console.error("[PanelLayout] Failed to save to localStorage:", error);
    }
  }, 300);
}

/**
 * Panel Layout Slice 생성
 */
export const createPanelLayoutSlice: StateCreator<
  PanelLayoutSlice,
  [],
  [],
  PanelLayoutSlice
> = (set, _get, _store) => ({
  // 초기 상태: localStorage에서 로드하거나 기본값 사용
  panelLayout: loadLayoutFromStorage() || DEFAULT_PANEL_LAYOUT,

  /**
   * 레이아웃 설정 및 자동 저장
   */
  setPanelLayout: (layout: import("../panels/core/types").PanelLayoutState) => {
    set({ panelLayout: layout });
    debouncedSaveLayoutToStorage(layout);
  },

  /**
   * 레이아웃 초기화
   */
  resetPanelLayout: () => {
    set({ panelLayout: DEFAULT_PANEL_LAYOUT });
    debouncedSaveLayoutToStorage(DEFAULT_PANEL_LAYOUT);
  },

  /**
   * 현재 레이아웃을 localStorage에 저장 (즉시)
   */
  savePanelLayoutToStorage: () => {
    const { panelLayout } = _get();
    // 명시적 호출은 즉시 저장 (디바운스 타이머 취소)
    if (_saveTimer !== null) {
      clearTimeout(_saveTimer);
      _saveTimer = null;
    }
    try {
      localStorage.setItem(
        PANEL_LAYOUT_STORAGE_KEY,
        JSON.stringify(panelLayout),
      );
    } catch (error) {
      console.error("[PanelLayout] Failed to save to localStorage:", error);
    }
  },

  /**
   * localStorage에서 레이아웃 로드
   */
  loadPanelLayoutFromStorage: () => {
    const loaded = loadLayoutFromStorage();
    if (loaded) {
      set({ panelLayout: loaded });
    }
  },
});

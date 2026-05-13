/**
 * DataTableEditorPanel Store
 *
 * 에디터 모드 상태 관리 및 패널 자동 활성화/비활성화
 */

import { create } from "zustand";
import type { DataTableEditorStore, ApiEditorTab } from "../types/editorTypes";
import { useStore } from "../../../stores";

/**
 * 패널 활성화 헬퍼
 */
function activateEditorPanel() {
  const { panelLayout, setPanelLayout } = useStore.getState();
  if (!panelLayout.activeLeftPanels.includes("datatableEditor")) {
    setPanelLayout({
      ...panelLayout,
      activeLeftPanels: [...panelLayout.activeLeftPanels, "datatableEditor"],
    });
  }
}

/**
 * 패널 비활성화 헬퍼
 */
function deactivateEditorPanel() {
  const { panelLayout, setPanelLayout } = useStore.getState();
  if (panelLayout.activeLeftPanels.includes("datatableEditor")) {
    setPanelLayout({
      ...panelLayout,
      activeLeftPanels: panelLayout.activeLeftPanels.filter(
        (id) => id !== "datatableEditor",
      ),
    });
  }
}

/**
 * DataTableEditorStore
 */
export const useDataTableEditorStore = create<DataTableEditorStore>((set) => ({
  // State
  mode: null,

  // Table Actions
  openTableCreator: (projectId: string) => {
    set({ mode: { type: "table-create", projectId } });
    activateEditorPanel();
  },

  openTableEditor: (tableId: string) => {
    set({ mode: { type: "table-edit", tableId } });
    activateEditorPanel();
  },

  // API Actions
  openApiCreator: (projectId: string) => {
    set({ mode: { type: "api-create", projectId } });
    activateEditorPanel();
  },

  openApiEditor: (endpointId: string, initialTab?: ApiEditorTab) => {
    set({ mode: { type: "api-edit", endpointId, initialTab } });
    activateEditorPanel();
  },

  // Variable Actions
  openVariableCreator: (projectId: string) => {
    set({ mode: { type: "variable-create", projectId } });
    activateEditorPanel();
  },

  openVariableEditor: (variableId: string) => {
    set({ mode: { type: "variable-edit", variableId } });
    activateEditorPanel();
  },

  // Close
  close: () => {
    set({ mode: null });
    deactivateEditorPanel();
  },
}));

/**
 * 선택자 훅들
 */
export const useDataTableEditorMode = () =>
  useDataTableEditorStore((state) => state.mode);

export const useDataTableEditorActions = () =>
  useDataTableEditorStore((state) => ({
    openTableCreator: state.openTableCreator,
    openTableEditor: state.openTableEditor,
    openApiCreator: state.openApiCreator,
    openApiEditor: state.openApiEditor,
    openVariableCreator: state.openVariableCreator,
    openVariableEditor: state.openVariableEditor,
    close: state.close,
  }));

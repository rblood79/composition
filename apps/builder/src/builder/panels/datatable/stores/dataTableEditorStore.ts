/**
 * DataTableEditorPanel Store
 *
 * 에디터 모드 상태 관리 및 패널 자동 활성화/비활성화
 */

import { create } from "zustand";
import type { DataTableEditorStore, ApiEditorTab } from "../types/editorTypes";
import { useStore } from "../../../stores";
import { PanelRegistry } from "../../core/PanelRegistry";
import { setPanelWorkspacePanelVisibility } from "../../../layout/panelWorkspaceLayoutInteraction";
import { createPanelWorkspaceRegistryEntry } from "../../../layout/panelWorkspaceLayoutV2";

/**
 * 패널 활성화 헬퍼
 */
function activateEditorPanel() {
  setEditorPanelVisibility(true);
}

/**
 * 패널 비활성화 헬퍼
 */
function deactivateEditorPanel() {
  setEditorPanelVisibility(false);
}

function setEditorPanelVisibility(visible: boolean) {
  const registry = PanelRegistry.getAllPanels().map(
    createPanelWorkspaceRegistryEntry,
  );
  if (registry.length === 0) return;
  let state = useStore.getState();
  if (!state.panelWorkspaceLayout) {
    state.initializePanelWorkspaceLayout(registry);
    state = useStore.getState();
  }
  const { panelWorkspaceLayout, setPanelWorkspaceLayout } = state;
  if (
    !panelWorkspaceLayout ||
    panelWorkspaceLayout.visibility.datatableEditor === visible
  ) {
    return;
  }
  const result = setPanelWorkspacePanelVisibility(
    panelWorkspaceLayout,
    registry,
    "datatableEditor",
    visible,
  );
  if (result.ok) setPanelWorkspaceLayout(result.value.layout);
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

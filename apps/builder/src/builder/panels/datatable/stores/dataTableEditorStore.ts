/**
 * DataTableEditorPanel Store — ADR-288: the Data panel is one surface. `mode` says what the
 * panel's body draws (a table's grid · an API form · the variable table · a creator); `open`
 * shows the `datatable` panel itself through `setPanelWorkspacePanelVisibility` (ADR-212 UI-8 —
 * the one activation path; the Quick Connect and CollectionBinding entry points go through here).
 * There is no editor or field panel any more — a column's editor is the header popover.
 */

import { create } from "zustand";
import type {
  DataTableEditorMode,
  DataTableEditorStore,
  ApiEditorTab,
  QuickConnectTarget,
} from "../types/editorTypes";
import { setPanelWorkspacePanelVisibility } from "../../../layout/panelWorkspaceVisibility";

export const useDataTableEditorStore = create<DataTableEditorStore>(
  (set, get) => ({
    mode: null,

    open: (mode: NonNullable<DataTableEditorMode>) => {
      set({ mode });
      setPanelWorkspacePanelVisibility("datatable", true);
    },

    openTableCreator: (projectId: string, connect?: QuickConnectTarget) =>
      get().open({
        type: "table-create",
        projectId,
        ...(connect ? { connect } : {}),
      }),
    openTableEditor: (tableId: string) =>
      get().open({ type: "table-edit", tableId }),
    openApiCreator: (projectId: string) =>
      get().open({ type: "api-create", projectId }),
    openApiEditor: (endpointId: string, initialTab?: ApiEditorTab) =>
      get().open({ type: "api-edit", endpointId, initialTab }),
    openVariableCreator: (projectId: string) =>
      get().open({ type: "variable-create", projectId }),
    openVariables: (projectId: string) =>
      get().open({ type: "variables", projectId }),

    /** Back to the list (the panel stays — the user closes it from its header). */
    close: () => {
      set({ mode: null });
    },
  }),
);

/**
 * 선택자 훅들
 */
export const useDataTableEditorMode = () =>
  useDataTableEditorStore((state) => state.mode);

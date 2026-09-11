/**
 * DataTableEditorPanel Store
 *
 * 에디터 모드 상태 + 편집 패널 (`datatableEditor`) · 필드 패널 (`datatableField`) 표시.
 * 패널 표시는 `setPanelWorkspacePanelVisibility` 한 경로 (ADR-212 UI-8) — layout store 의
 * visibility 를 여기서 직접 뒤집지 않는다.
 */

import { create } from "zustand";
import type {
  DataTableEditorMode,
  DataTableEditorStore,
  ApiEditorTab,
} from "../types/editorTypes";
import { setPanelWorkspacePanelVisibility } from "../../../layout/panelWorkspaceVisibility";

export const useDataTableEditorStore = create<DataTableEditorStore>(
  (set, get) => ({
    mode: null,
    fieldPanel: null,

    open: (mode: NonNullable<DataTableEditorMode>) => {
      const previous = get().mode;
      // 다른 테이블/모드로 바뀌면 필드 패널은 대상이 사라진 것 — 같이 닫는다.
      const keepField =
        previous?.type === "table-edit" &&
        mode.type === "table-edit" &&
        previous.tableId === mode.tableId;
      set({ mode, ...(keepField ? {} : { fieldPanel: null }) });
      setPanelWorkspacePanelVisibility("datatableEditor", true);
      if (!keepField) setPanelWorkspacePanelVisibility("datatableField", false);
    },

    openTableCreator: (projectId: string) =>
      get().open({ type: "table-create", projectId }),
    openTableEditor: (tableId: string) =>
      get().open({ type: "table-edit", tableId }),
    openApiCreator: (projectId: string) =>
      get().open({ type: "api-create", projectId }),
    openApiEditor: (endpointId: string, initialTab?: ApiEditorTab) =>
      get().open({ type: "api-edit", endpointId, initialTab }),
    openVariableCreator: (projectId: string) =>
      get().open({ type: "variable-create", projectId }),
    openVariableEditor: (variableId: string) =>
      get().open({ type: "variable-edit", variableId }),

    openFieldPanel: (collectionId, fieldId = null) => {
      const mode = get().mode;
      if (mode?.type !== "table-edit" || mode.tableId !== collectionId) {
        get().open({ type: "table-edit", tableId: collectionId });
      }
      set({ fieldPanel: { collectionId, fieldId } });
      setPanelWorkspacePanelVisibility("datatableField", true);
    },

    closeFieldPanel: () => {
      set({ fieldPanel: null });
      setPanelWorkspacePanelVisibility("datatableField", false);
    },

    close: () => {
      set({ mode: null, fieldPanel: null });
      setPanelWorkspacePanelVisibility("datatableField", false);
      setPanelWorkspacePanelVisibility("datatableEditor", false);
    },
  }),
);

/**
 * 선택자 훅들
 */
export const useDataTableEditorMode = () =>
  useDataTableEditorStore((state) => state.mode);

export const useDataTableFieldPanel = () =>
  useDataTableEditorStore((state) => state.fieldPanel);

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

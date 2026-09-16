/**
 * DataTableEditorPanel - 데이터테이블 에디터 패널
 *
 * DataTablePanel과 함께 사용되는 에디터 패널
 * - DataTable 생성/편집
 * - API Endpoint 편집
 * - Variable 편집
 *
 * Store 기반으로 모드에 따라 에디터 컴포넌트를 렌더링
 * 탭은 패널 레벨에서 관리 (DataTablePanel과 동일한 구조). table-edit 는 탭이 없다 —
 * 격자가 유일한 뷰이고 설정은 헤더 gear 토글로 같은 자리에 연다 (History 패널 어법;
 * Airtable/Notion/Webflow 도 설정을 이름 옆 아이콘·메뉴에 둔다, 뷰 탭 아님).
 *
 * ⚡ React 권장 패턴: key prop으로 모드 변경 시 EditorContent 전체 리마운트
 *    (useEffect에서 setState 호출하는 안티패턴 제거)
 */

import { useState, useMemo } from "react";
import { FileEdit, Globe, Settings, Table2, Variable } from "lucide-react";
import { useDataTableEditorStore } from "./stores/dataTableEditorStore";
import { useDataStore } from "../../stores/data";
import {
  DataTableCreator,
  DataTableEditor,
  ApiEndpointEditor,
  VariableEditor,
  ApiEndpointCreator,
  VariableCreator,
} from "./editors";
import { EmptyState, PanelHeader, PanelContents } from "../../components";
import { ActionIconToggleButton } from "../../components/ui";
import type { DataTableEditorMode } from "./types/editorTypes";
import "./DataTableEditorPanel.css";
import { iconProps } from "../../../utils/ui/uiConstants";
import { translateKey, useOptionalI18n } from "../../../i18n";

// ADR-214 — Variable 편집기는 기본 설정 한 절뿐 (Validation / Transform 절은 소비처 0 으로 삭제, 2026-09-14
// 승인). 탭이 없어 shell 은 비-탭 본문 (`PanelContents`) 이다.

// Creator 모드 타입

// 생성 방식은 다른 에디터의 뷰 탭과 같은 축이라 같은 탭 패턴으로 둔다

/**
 * EditorContent - 모드별 상태를 관리하는 내부 컴포넌트
 *
 * ⚡ key prop으로 mode 변경 시 리마운트되어 상태가 자동 초기화됨
 * (useEffect에서 setState 호출하는 안티패턴 제거)
 */
interface EditorContentProps {
  mode: NonNullable<DataTableEditorMode>;
  close: () => void;
}

function EditorContent({ mode, close }: EditorContentProps) {
  const i18n = useOptionalI18n();
  const localize = (key: string, fallback: string) =>
    i18n ? translateKey(i18n.t, `datatable.${key}`, fallback) : fallback;
  // table-edit: 헤더 gear 토글 — 격자 ↔ 설정 (같은 자리, 제목 유지)
  const [settingsOpen, setSettingsOpen] = useState(false);
  const updateCollection = useDataStore((state) => state.updateCollection);

  // 데이터 조회 - 개별 selector + useMemo로 리렌더링 최적화
  const dataTablesMap = useDataStore((state) => state.collections);
  const apiEndpointsMap = useDataStore((state) => state.apiEndpoints);
  const variablesMap = useDataStore((state) => state.variables);

  const collections = useMemo(
    () => Array.from(dataTablesMap.values()),
    [dataTablesMap],
  );
  const apiEndpoints = useMemo(
    () => Array.from(apiEndpointsMap.values()),
    [apiEndpointsMap],
  );
  const variables = useMemo(
    () => Array.from(variablesMap.values()),
    [variablesMap],
  );

  // 모드에 따른 헤더 제목 결정
  const getHeaderTitle = (): string => {
    switch (mode.type) {
      case "table-create":
        return localize("creatorTitle", "Data Table Creator");
      case "table-edit": {
        const dataTable = collections.find((t) => t.id === mode.tableId);
        return dataTable?.name || localize("tableEditor", "Table Editor");
      }
      case "api-create":
        return localize("newApi", "New API");
      case "api-edit": {
        const endpoint = apiEndpoints.find((e) => e.id === mode.endpointId);
        return endpoint?.name || localize("apiEditor", "API Editor");
      }
      case "variable-create":
        return localize("newVariable", "New Variable");
      case "variable-edit": {
        const variable = variables.find((v) => v.id === mode.variableId);
        return variable?.name || localize("variableEditor", "Variable Editor");
      }
      default:
        return localize("editor", "Editor");
    }
  };

  // table-edit 헤더 액션: 설정 토글 (aria-pressed) — close 왼쪽
  const headerActions =
    mode.type === "table-edit" ? (
      <ActionIconToggleButton
        className="datatable-editor-settings-toggle"
        isSelected={settingsOpen}
        onChange={setSettingsOpen}
        aria-label={localize("settings", "Settings")}
        tooltip={localize("settings", "Settings")}
      >
        <Settings {...iconProps} />
      </ActionIconToggleButton>
    ) : undefined;

  // table-edit 제목 더블클릭 rename (Airtable 탭 rename 어법) — 설정에도 이름 필드는 남는다
  const onTitleCommit =
    mode.type === "table-edit"
      ? (next: string) => {
          const name = next.trim();
          if (name === "") return;
          void updateCollection(mode.tableId, { name }).catch((error) => {
            console.error("이름 업데이트 실패:", error);
          });
        }
      : undefined;

  // 모드에 따른 에디터 컨텐츠 렌더링
  const renderEditorContent = () => {
    switch (mode.type) {
      case "table-create":
        return (
          <DataTableCreator
            projectId={mode.projectId}
            connect={mode.connect}
            onClose={close}
          />
        );

      case "table-edit": {
        const dataTable = collections.find((t) => t.id === mode.tableId);
        if (!dataTable) {
          return (
            <EmptyState
              icon={<Table2 size={32} />}
              message={localize("tableNotFound", "Table not found")}
            />
          );
        }
        return (
          <DataTableEditor
            dataTable={dataTable}
            onClose={close}
            view={settingsOpen ? "settings" : "grid"}
          />
        );
      }

      case "api-create":
        return (
          <ApiEndpointCreator projectId={mode.projectId} onClose={close} />
        );

      case "api-edit": {
        const endpoint = apiEndpoints.find((e) => e.id === mode.endpointId);
        if (!endpoint) {
          return (
            <EmptyState
              icon={<Globe size={32} />}
              message={localize("apiNotFound", "API not found")}
            />
          );
        }
        return (
          <ApiEndpointEditor
            endpoint={endpoint}
            onClose={close}
            initialTab={mode.initialTab}
          />
        );
      }

      case "variable-create":
        return <VariableCreator projectId={mode.projectId} onClose={close} />;

      case "variable-edit": {
        const variable = variables.find((v) => v.id === mode.variableId);
        if (!variable) {
          return (
            <EmptyState
              icon={<Variable size={32} />}
              message={localize("variableNotFound", "Variable not found")}
            />
          );
        }
        return <VariableEditor variable={variable} onClose={close} />;
      }

      default:
        return (
          <EmptyState
            icon={<FileEdit size={32} />}
            message={localize("selectEditorItem", "Select an item to edit")}
          />
        );
    }
  };

  return (
    <div className="panel datatable-editor-panel">
      <PanelHeader
        icon={<FileEdit {...iconProps} />}
        title={getHeaderTitle()}
        actions={headerActions}
        onTitleCommit={onTitleCommit}
        onClose={close}
      />
      <PanelContents>{renderEditorContent()}</PanelContents>
    </div>
  );
}

/**
 * 모드별 고유 키 생성
 *
 * mode.type + 관련 ID를 조합하여 고유 키 생성
 * - table-create: type + projectId
 * - table-edit: type + tableId
 * - api-edit: type + endpointId
 * - etc.
 */
function getModeKey(mode: NonNullable<DataTableEditorMode>): string {
  switch (mode.type) {
    case "table-create":
      // ADR-013 — 연결 대상이 바뀌면 (다른 요소의 Data 행에서 다시 열기) 입력 상태를 새로 시작
      return `table-create-${mode.projectId}-${mode.connect?.elementId ?? ""}`;
    case "table-edit":
      return `table-edit-${mode.tableId}`;
    case "api-create":
      return `api-create-${mode.projectId}`;
    case "api-edit":
      return `api-edit-${mode.endpointId}`;
    case "variable-create":
      return `variable-create-${mode.projectId}`;
    case "variable-edit":
      return `variable-edit-${mode.variableId}`;
    default:
      return `unknown-${Date.now()}`;
  }
}

// 비활성 gating 은 PanelWorkspace 의 <Activity mode="hidden"> 이 담당 (ADR-922)
export function DataTableEditorPanel() {
  const i18n = useOptionalI18n();
  const localize = (key: string, fallback: string) =>
    i18n ? translateKey(i18n.t, `datatable.${key}`, fallback) : fallback;
  const mode = useDataTableEditorStore((state) => state.mode);
  const close = useDataTableEditorStore((state) => state.close);

  // 에디터가 열리지 않은 상태
  if (!mode) {
    return (
      <div className="panel datatable-editor-panel">
        <PanelHeader
          icon={<FileEdit size={iconProps.size} />}
          title={localize("editor", "Editor")}
          onClose={close}
        />
        <PanelContents>
          <EmptyState
            icon={<FileEdit size={32} />}
            message={localize("selectEditorItem", "Select an item to edit")}
          />
        </PanelContents>
      </div>
    );
  }

  // ⚡ React 권장 패턴: key prop으로 mode 변경 시 EditorContent 전체 리마운트
  // 이렇게 하면 useEffect에서 setState 호출 없이 상태가 자동 초기화됨
  return <EditorContent key={getModeKey(mode)} mode={mode} close={close} />;
}
export default DataTableEditorPanel;

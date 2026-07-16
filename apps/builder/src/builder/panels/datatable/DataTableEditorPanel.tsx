/**
 * DataTableEditorPanel - 데이터테이블 에디터 패널
 *
 * DataTablePanel과 함께 사용되는 에디터 패널
 * - DataTable 생성/편집
 * - API Endpoint 편집
 * - Variable 편집
 *
 * Store 기반으로 모드에 따라 에디터 컴포넌트를 렌더링
 * 탭은 패널 레벨에서 관리 (DataTablePanel과 동일한 구조)
 *
 * ⚡ React 권장 패턴: key prop으로 모드 변경 시 EditorContent 전체 리마운트
 *    (useEffect에서 setState 호출하는 안티패턴 제거)
 */

import { useState, useMemo } from "react";
import {
  Database,
  Table2,
  Settings,
  Code,
  FileJson,
  FileEdit,
  Play,
  Shield,
  X,
} from "lucide-react";
import { useDataTableEditorStore } from "./stores/dataTableEditorStore";
import { useDataStore } from "../../stores/data";
import {
  DataTableCreator,
  DataTableEditor,
  ApiEndpointEditor,
  VariableEditor,
} from "./editors";
import { EmptyState, PanelHeader } from "../../components";
import type {
  TableEditorTab,
  ApiEditorTab,
  VariableEditorTab,
  DataTableEditorMode,
} from "./types/editorTypes";
import "./DataTableEditorPanel.css";
import { iconProps, iconEditProps } from "../../../utils/ui/uiConstants";

// 탭 설정 타입
interface TabConfig<T extends string> {
  id: T;
  label: string;
  icon: typeof Database;
}

// 각 에디터 타입별 탭 설정
const TABLE_TABS: TabConfig<TableEditorTab>[] = [
  { id: "schema", label: "Schema", icon: Database },
  { id: "data", label: "Table", icon: Table2 },
  { id: "settings", label: "Settings", icon: Settings },
];

const API_TABS: TabConfig<ApiEditorTab>[] = [
  { id: "basic", label: "Basic", icon: Settings },
  { id: "headers", label: "Headers", icon: Code },
  { id: "body", label: "Body", icon: FileJson },
  { id: "response", label: "Response", icon: FileJson },
  { id: "run", label: "Run", icon: Play },
];

const VARIABLE_TABS: TabConfig<VariableEditorTab>[] = [
  { id: "basic", label: "Basic", icon: Settings },
  { id: "validation", label: "Validation", icon: Shield },
  { id: "transform", label: "Transform", icon: Code },
];

// Creator 모드 타입
type CreatorMode = "empty" | "preset";

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
  // 탭 상태 관리 - mode 변경 시 key가 바뀌어 자동 초기화됨
  const [tableTab, setTableTab] = useState<TableEditorTab>("schema");
  // API 에디터 초기 탭: mode.initialTab이 있으면 사용 (useEffect 대신 초기값으로)
  const [apiTab, setApiTab] = useState<ApiEditorTab>(
    mode.type === "api-edit" && mode.initialTab ? mode.initialTab : "basic",
  );
  const [variableTab, setVariableTab] = useState<VariableEditorTab>("basic");

  // DataTableCreator 모드 상태 (empty/preset) - key로 자동 초기화
  const [creatorMode, setCreatorMode] = useState<CreatorMode>("preset");

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
        return "Data Table Creator";
      case "table-edit": {
        const dataTable = collections.find((t) => t.id === mode.tableId);
        return dataTable?.name || "Table Editor";
      }
      case "api-create":
        return "New API";
      case "api-edit": {
        const endpoint = apiEndpoints.find((e) => e.id === mode.endpointId);
        return endpoint?.name || "API Editor";
      }
      case "variable-create":
        return "New Variable";
      case "variable-edit": {
        const variable = variables.find((v) => v.id === mode.variableId);
        return variable?.name || "Variable Editor";
      }
      default:
        return "Editor";
    }
  };

  // 현재 모드에 따른 탭 렌더링
  // Note: table-create는 DataTableCreator가 자체 UI를 가지므로 탭 없음
  const renderTabs = () => {
    switch (mode.type) {
      case "table-edit":
        return (
          <div className="panel-tabs">
            {TABLE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`panel-tab ${tableTab === tab.id ? "active" : ""}`}
                onClick={() => setTableTab(tab.id)}
              >
                <tab.icon {...iconEditProps} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        );

      case "api-edit":
        return (
          <div className="panel-tabs">
            {API_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`panel-tab ${apiTab === tab.id ? "active" : ""}`}
                onClick={() => setApiTab(tab.id)}
              >
                <tab.icon {...iconEditProps} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        );

      case "variable-edit":
        return (
          <div className="panel-tabs">
            {VARIABLE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`panel-tab ${
                  variableTab === tab.id ? "active" : ""
                }`}
                onClick={() => setVariableTab(tab.id)}
              >
                <tab.icon {...iconEditProps} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        );

      case "table-create":
        return (
          <div className="panel-selection">
            <label className="panel-option">
              <input
                type="radio"
                name="creatorMode"
                checked={creatorMode === "empty"}
                onChange={() => setCreatorMode("empty")}
              />
              빈 테이블로 시작
            </label>
            <label className="panel-option">
              <input
                type="radio"
                name="creatorMode"
                checked={creatorMode === "preset"}
                onChange={() => setCreatorMode("preset")}
              />
              Preset에서 선택
            </label>
          </div>
        );

      // 다른 create 모드들은 TODO 상태이므로 탭 없음
      case "api-create":
      case "variable-create":
      default:
        return null;
    }
  };

  // 모드에 따른 에디터 컨텐츠 렌더링
  const renderEditorContent = () => {
    switch (mode.type) {
      case "table-create":
        return (
          <DataTableCreator
            projectId={mode.projectId}
            onClose={close}
            mode={creatorMode}
          />
        );

      case "table-edit": {
        const dataTable = collections.find((t) => t.id === mode.tableId);
        if (!dataTable) {
          return <EmptyState message="테이블을 찾을 수 없습니다" />;
        }
        return (
          <DataTableEditor
            dataTable={dataTable}
            onClose={close}
            activeTab={tableTab}
          />
        );
      }

      case "api-create":
        // TODO: ApiEndpointCreator 구현 필요
        return <EmptyState message="API 생성 기능 준비 중" />;

      case "api-edit": {
        const endpoint = apiEndpoints.find((e) => e.id === mode.endpointId);
        if (!endpoint) {
          return <EmptyState message="API를 찾을 수 없습니다" />;
        }
        return (
          <ApiEndpointEditor
            endpoint={endpoint}
            onClose={close}
            activeTab={apiTab}
          />
        );
      }

      case "variable-create":
        // TODO: VariableCreator 구현 필요
        return <EmptyState message="변수 생성 기능 준비 중" />;

      case "variable-edit": {
        const variable = variables.find((v) => v.id === mode.variableId);
        if (!variable) {
          return <EmptyState message="변수를 찾을 수 없습니다" />;
        }
        return (
          <VariableEditor
            variable={variable}
            onClose={close}
            activeTab={variableTab}
          />
        );
      }

      default:
        return <EmptyState message="편집할 항목을 선택하세요" />;
    }
  };

  return (
    <div className="datatable-editor-panel">
      <PanelHeader
        icon={<FileEdit {...iconProps} />}
        title={getHeaderTitle()}
        actions={
          <button
            type="button"
            className="iconButton"
            onClick={close}
            title="닫기"
          >
            <X {...iconProps} />
          </button>
        }
      />
      {renderTabs()}
      <div className="panel-contents">{renderEditorContent()}</div>
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
      return `table-create-${mode.projectId}`;
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

// 비활성 gating 은 PanelContainer 의 <Activity mode="hidden"> 이 담당 (ADR-155)
export function DataTableEditorPanel() {
  const mode = useDataTableEditorStore((state) => state.mode);
  const close = useDataTableEditorStore((state) => state.close);

  // 에디터가 열리지 않은 상태
  if (!mode) {
    return (
      <div className="datatable-editor-panel">
        <PanelHeader icon={<FileEdit size={iconProps.size} />} title="Editor" />
        <div className="panel-contents">
          <EmptyState message="편집할 항목을 선택하세요" />
        </div>
      </div>
    );
  }

  // ⚡ React 권장 패턴: key prop으로 mode 변경 시 EditorContent 전체 리마운트
  // 이렇게 하면 useEffect에서 setState 호출 없이 상태가 자동 초기화됨
  return <EditorContent key={getModeKey(mode)} mode={mode} close={close} />;
}

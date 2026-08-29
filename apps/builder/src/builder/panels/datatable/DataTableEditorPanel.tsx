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
import { Tab, TabList, Tabs } from "react-aria-components";
import {
  Code,
  Database,
  FileEdit,
  FileJson,
  FileOutput,
  FilePlus2,
  LayoutTemplate,
  Play,
  Settings,
  Shield,
  Table2,
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
import { iconProps } from "../../../utils/ui/uiConstants";
import { translateKey, useOptionalI18n } from "../../../i18n";

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
  { id: "response", label: "Response", icon: FileOutput },
  { id: "run", label: "Run", icon: Play },
];

const VARIABLE_TABS: TabConfig<VariableEditorTab>[] = [
  { id: "basic", label: "Basic", icon: Settings },
  { id: "validation", label: "Validation", icon: Shield },
  { id: "transform", label: "Transform", icon: Code },
];

// Creator 모드 타입
type CreatorMode = "empty" | "preset";

// 생성 방식은 다른 에디터의 뷰 탭과 같은 축이라 같은 탭 패턴으로 둔다
// (구 radio 바 `.datatable-creator-modes` 는 panel-header 크롬을 재정의하던 별도 계열).
const CREATOR_TABS: {
  id: CreatorMode;
  label: string;
  labelKey: string;
  icon: typeof Database;
}[] = [
  {
    id: "preset",
    label: "Preset",
    labelKey: "presetTab",
    icon: LayoutTemplate,
  },
  { id: "empty", label: "Empty", labelKey: "emptyTab", icon: FilePlus2 },
];

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

  // 현재 모드에 따른 탭 렌더링
  // Note: table-create는 DataTableCreator가 자체 UI를 가지므로 탭 없음
  const renderTabs = () => {
    switch (mode.type) {
      case "table-edit":
        return (
          <Tabs
            className="panel-tabs"
            selectedKey={tableTab}
            onSelectionChange={(key) => setTableTab(key as TableEditorTab)}
          >
            <div className="panel-header panel-tabrow">
              <TabList
                className="panel-tablist"
                aria-label={localize("tableTabs", "tableTabs")}
              >
                {TABLE_TABS.map((tab) => (
                  <Tab key={tab.id} id={tab.id} className="panel-tab">
                    <tab.icon
                      color="currentColor"
                      strokeWidth={iconProps.strokeWidth}
                      size={iconProps.size}
                    />
                    <span className="panel-tab-label">
                      {localize(
                        tab.id === "data" ? "table" : tab.id,
                        tab.label,
                      )}
                    </span>
                  </Tab>
                ))}
              </TabList>
            </div>
          </Tabs>
        );

      case "api-edit":
        return (
          <Tabs
            className="panel-tabs"
            selectedKey={apiTab}
            onSelectionChange={(key) => setApiTab(key as ApiEditorTab)}
          >
            <div className="panel-header panel-tabrow">
              <TabList
                className="panel-tablist"
                aria-label={localize("apiTabs", "apiTabs")}
              >
                {API_TABS.map((tab) => (
                  <Tab key={tab.id} id={tab.id} className="panel-tab">
                    <tab.icon
                      color="currentColor"
                      strokeWidth={iconProps.strokeWidth}
                      size={iconProps.size}
                    />
                    <span className="panel-tab-label">
                      {localize(tab.id, tab.label)}
                    </span>
                  </Tab>
                ))}
              </TabList>
            </div>
          </Tabs>
        );

      case "variable-edit":
        return (
          <Tabs
            className="panel-tabs"
            selectedKey={variableTab}
            onSelectionChange={(key) =>
              setVariableTab(key as VariableEditorTab)
            }
          >
            <div className="panel-header panel-tabrow">
              <TabList
                className="panel-tablist"
                aria-label={localize("variableTabs", "variableTabs")}
              >
                {VARIABLE_TABS.map((tab) => (
                  <Tab key={tab.id} id={tab.id} className="panel-tab">
                    <tab.icon
                      color="currentColor"
                      strokeWidth={iconProps.strokeWidth}
                      size={iconProps.size}
                    />
                    <span className="panel-tab-label">
                      {localize(tab.id, tab.label)}
                    </span>
                  </Tab>
                ))}
              </TabList>
            </div>
          </Tabs>
        );

      case "table-create":
        return (
          <Tabs
            className="panel-tabs"
            selectedKey={creatorMode}
            onSelectionChange={(key) => setCreatorMode(key as CreatorMode)}
          >
            <div className="panel-header panel-tabrow">
              <TabList
                className="panel-tablist"
                aria-label={localize("creatorTabs", "Creation mode")}
              >
                {CREATOR_TABS.map((tab) => (
                  <Tab key={tab.id} id={tab.id} className="panel-tab">
                    <tab.icon
                      color="currentColor"
                      strokeWidth={iconProps.strokeWidth}
                      size={iconProps.size}
                    />
                    <span className="panel-tab-label">
                      {localize(tab.labelKey, tab.label)}
                    </span>
                  </Tab>
                ))}
              </TabList>
            </div>
          </Tabs>
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
          return (
            <EmptyState
              message={localize("tableNotFound", "테이블을 찾을 수 없습니다")}
            />
          );
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
        return (
          <EmptyState
            message={localize("apiCreationPending", "API 생성 기능 준비 중")}
          />
        );

      case "api-edit": {
        const endpoint = apiEndpoints.find((e) => e.id === mode.endpointId);
        if (!endpoint) {
          return (
            <EmptyState
              message={localize("apiNotFound", "API를 찾을 수 없습니다")}
            />
          );
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
        return (
          <EmptyState
            message={localize(
              "variableCreationPending",
              "변수 생성 기능 준비 중",
            )}
          />
        );

      case "variable-edit": {
        const variable = variables.find((v) => v.id === mode.variableId);
        if (!variable) {
          return (
            <EmptyState
              message={localize("variableNotFound", "변수를 찾을 수 없습니다")}
            />
          );
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
        return (
          <EmptyState
            message={localize("selectEditorItem", "편집할 항목을 선택하세요")}
          />
        );
    }
  };

  return (
    <div className="panel datatable-editor-panel">
      <PanelHeader
        icon={<FileEdit {...iconProps} />}
        title={getHeaderTitle()}
        onClose={close}
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
        <div className="panel-contents">
          <EmptyState
            message={localize("selectEditorItem", "Select an item to edit")}
          />
        </div>
      </div>
    );
  }

  // ⚡ React 권장 패턴: key prop으로 mode 변경 시 EditorContent 전체 리마운트
  // 이렇게 하면 useEffect에서 setState 호출 없이 상태가 자동 초기화됨
  return <EditorContent key={getModeKey(mode)} mode={mode} close={close} />;
}

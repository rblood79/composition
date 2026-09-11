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
import { Tab, TabList, TabPanel, Tabs } from "react-aria-components/Tabs";
import {
  Code,
  Database,
  FileEdit,
  Globe,
  Settings,
  Shield,
  Table2,
  Variable,
} from "lucide-react";
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
import { panelContents } from "../../components/panel/panelContentsUtils";
import type {
  TableEditorTab,
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
  { id: "data", label: "Table", icon: Table2 },
  { id: "settings", label: "Settings", icon: Settings },
];

const VARIABLE_TABS: TabConfig<VariableEditorTab>[] = [
  { id: "basic", label: "Basic", icon: Settings },
  { id: "validation", label: "Validation", icon: Shield },
  { id: "transform", label: "Transform", icon: Code },
];

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
  // 탭 상태 관리 - mode 변경 시 key가 바뀌어 자동 초기화됨
  const [tableTab, setTableTab] = useState<TableEditorTab>("data");
  const [variableTab, setVariableTab] = useState<VariableEditorTab>("basic");

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

  // 탭 모드 3종은 같은 shell (TabList + TabPanel 본문) — TabPanel 이 곧 .panel-contents 라
  // 선택 탭의 aria-controls 가 실제 패널을 가리킨다 (RAC 는 선택 탭에만 aria-controls 를 단다).
  const tabbed:
    | {
        key: string;
        tabs: readonly TabConfig<string>[];
        aria: string;
        ariaFallback: string;
        labelKey: (id: string) => string;
        onChange: (key: string) => void;
      }
    | null =
    mode.type === "table-edit"
      ? {
          key: tableTab,
          tabs: TABLE_TABS,
          aria: "tableTabs",
          ariaFallback: "Table tabs",
          labelKey: (id) => (id === "data" ? "table" : id),
          onChange: (key) => setTableTab(key as TableEditorTab),
        }
      : mode.type === "variable-edit"
        ? {
            key: variableTab,
            tabs: VARIABLE_TABS,
            aria: "variableTabs",
            ariaFallback: "Variable tabs",
            labelKey: (id) => id,
            onChange: (key) => setVariableTab(key as VariableEditorTab),
          }
        : null;

  // 모드에 따른 에디터 컨텐츠 렌더링
  const renderEditorContent = () => {
    switch (mode.type) {
      case "table-create":
        return <DataTableCreator projectId={mode.projectId} onClose={close} />;

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
            activeTab={tableTab}
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
        onClose={close}
      />
      {tabbed ? (
        <Tabs
          className="panel-tabs"
          selectedKey={tabbed.key}
          onSelectionChange={(key) => tabbed.onChange(String(key))}
        >
          <div className="panel-header panel-tabrow">
            <TabList
              className="panel-tablist"
              aria-label={localize(tabbed.aria, tabbed.ariaFallback)}
            >
              {tabbed.tabs.map((tab) => (
                <Tab key={tab.id} id={tab.id} className="panel-tab">
                  <tab.icon
                    color="currentColor"
                    strokeWidth={iconProps.strokeWidth}
                    size={iconProps.size}
                  />
                  <span className="panel-tab-label">
                    {localize(tabbed.labelKey(tab.id), tab.label)}
                  </span>
                </Tab>
              ))}
            </TabList>
          </div>
          <TabPanel id={tabbed.key} className={panelContents()}>
            {renderEditorContent()}
          </TabPanel>
        </Tabs>
      ) : (
        <PanelContents>{renderEditorContent()}</PanelContents>
      )}
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

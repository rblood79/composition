/**
 * DataTablePanel - 프로젝트 레벨 데이터 관리 패널
 *
 * 3개 탭 구성:
 * - DataTables: 스키마 + Mock 데이터 관리
 * - API Endpoints: 외부 API 연결 설정
 * - Variables: 전역/페이지 상태 관리
 *
 * 편집 UI는 DataTableEditorPanel에서 처리. 목록은 `useDataStore` — 열린 catalog 문서의
 * 데이터 정의를 투영한 store 다 (ADR-286 — 패널이 따로 불러올 것이 없다).
 */

import { useState } from "react";
import { useParams } from "react-router";
import { Table2, Globe, Variable, Database } from "lucide-react";
import { Tab, TabList, TabPanel, Tabs } from "react-aria-components/Tabs";
import { iconProps } from "../../../utils/ui/uiConstants";
import { CatalogWorkspaceGate } from "../../catalogRuntime/react";
import { useDataStore } from "../../stores/data";
import { useDataTableEditorStore } from "./stores/dataTableEditorStore";
import { PanelHeader } from "../../components/panel/PanelHeader";
import { EmptyState } from "../../components/feedback/EmptyState";
import { LoadingSpinner } from "../../components/feedback/LoadingSpinner";
import { panelContents } from "../../components/panel/panelContentsUtils";
import { DataTableList } from "./components/DataTableList";
import { ApiEndpointList } from "./components/ApiEndpointList";
import { VariableList } from "./components/VariableList";
import { DataPanelStatusRegion } from "./components/DataPanelStatusRegion";
import "./DataTablePanel.css";
import { translateKey, useOptionalI18n } from "../../../i18n";

type DataTableTab = "tables" | "endpoints" | "variables";

interface TabConfig {
  id: DataTableTab;
  label: string;
  icon: typeof Table2;
}

const TABS: TabConfig[] = [
  { id: "tables", label: "Tables", icon: Table2 },
  { id: "endpoints", label: "APIs", icon: Globe },
  { id: "variables", label: "Variables", icon: Variable },
];

/** Panels mount before the workspace exists — the Data hosts are provided with it. */
export function DataTablePanel() {
  return (
    <CatalogWorkspaceGate>
      <DataTablePanelContent />
    </CatalogWorkspaceGate>
  );
}

function DataTablePanelContent() {
  const i18n = useOptionalI18n();
  const localize = (key: string, fallback: string) =>
    i18n ? translateKey(i18n.t, `datatable.${key}`, fallback) : fallback;
  const [activeTab, setActiveTab] = useState<DataTableTab>("tables");

  // Get projectId from URL params
  const { projectId: currentProjectId } = useParams<{ projectId: string }>();

  const isLoading = useDataStore((state) => state.isLoading);

  // Editor Store 액션
  const editorMode = useDataTableEditorStore((state) => state.mode);
  const openTableCreator = useDataTableEditorStore(
    (state) => state.openTableCreator,
  );
  const openTableEditor = useDataTableEditorStore(
    (state) => state.openTableEditor,
  );
  const closeEditor = useDataTableEditorStore((state) => state.close);

  // 현재 편집 중인 테이블 ID (하이라이트용)
  const editingTableId =
    editorMode?.type === "table-edit" ? editorMode.tableId : null;

  // 비활성 gating 은 PanelWorkspace 의 <Activity mode="hidden"> 이 담당 (ADR-922).

  // No project selected
  if (!currentProjectId) {
    return (
      <div className="panel datatable-panel">
        <PanelHeader
          icon={<Database size={iconProps.size} />}
          title={i18n ? i18n.t("panels.dataTable") : "Data"}
          panelId="datatable"
        />
        <EmptyState
          icon={<Database size={32} />}
          message={localize("noProject", "Select a project")}
        />
      </div>
    );
  }

  const tabLabel = (tab: TabConfig) =>
    localize(
      tab.id === "tables"
        ? "tables"
        : tab.id === "endpoints"
          ? "apis"
          : "variables",
      tab.label,
    );

  const handleCreateClick = () => {
    openTableCreator(currentProjectId);
  };

  const handleEditingChange = (id: string | null) => {
    if (id) {
      openTableEditor(id);
    }
  };

  return (
    <div className="panel datatable-panel">
      <PanelHeader
        icon={<Database size={iconProps.size} />}
        title={i18n ? i18n.t("panels.dataTable") : "Data"}
        panelId="datatable"
      />

      {/* 탭 = 공용 패턴 — `.panel-header.panel-tabrow` 래퍼(바 크롬: 32px + 배경 + 하단
          구분선) + `.panel-tablist`/`.panel-tab` (RAC Tabs). Navigator/Styles 와 동일 구조. */}
      <Tabs
        className="panel-tabs"
        selectedKey={activeTab}
        onSelectionChange={(key) => {
          const next = key as DataTableTab;
          if (next === activeTab) return;
          // 탭이 변경되면 에디터 닫기 (종전 onClick 동작 보존)
          if (editorMode) closeEditor();
          setActiveTab(next);
        }}
      >
        <div className="panel-header panel-tabrow">
          <TabList
            className="panel-tablist"
            aria-label={localize("tabs", "DataTable tabs")}
          >
            {TABS.map((tab) => (
              <Tab key={tab.id} id={tab.id} className="panel-tab">
                {/* 폭 < 360 아이콘 모드에서 tooltip (HC3) — 라벨은 시각만 숨겨 이름은 남는다 */}
                <span className="panel-tab-icon" title={tabLabel(tab)}>
                  <tab.icon
                    color="currentColor"
                    strokeWidth={iconProps.strokeWidth}
                    size={iconProps.size}
                  />
                </span>
                <span className="panel-tab-label">{tabLabel(tab)}</span>
              </Tab>
            ))}
          </TabList>
        </div>

        {/* Panel Contents */}
        {/* 로딩 중에도 리스트 유지 (에디터가 닫히는 것 방지) */}
        {isLoading && (
          <div className="datatable-loading-overlay">
            <LoadingSpinner />
          </div>
        )}
        <TabPanel id="tables" className={panelContents()}>
          <DataTableList
            projectId={currentProjectId}
            editingId={editingTableId}
            onEditingChange={handleEditingChange}
            onCreateClick={handleCreateClick}
          />
        </TabPanel>
        <TabPanel id="endpoints" className={panelContents()}>
          <ApiEndpointList projectId={currentProjectId} />
        </TabPanel>
        <TabPanel id="variables" className={panelContents()}>
          <VariableList projectId={currentProjectId} />
        </TabPanel>
      </Tabs>
      {/* ADR-212 HC4 — 저장 · 행 추가 · Run · import 결과의 `role=status` 영역 (항상 마운트) */}
      <DataPanelStatusRegion />
    </div>
  );
}

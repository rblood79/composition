/**
 * DataTableEditor - DataTable 상세 편집 컴포넌트
 *
 * 기능:
 * - 스키마 정의 (필드 추가/삭제/수정) — ADR-212 Phase 3 에서 격자 헤더 + 필드 패널로 이전
 * - 행 격자 (`grid/DataGrid` — RAC Table role=grid, ADR-212 Phase 2)
 * - useMockData 토글
 */

import { useState, useCallback, useMemo } from "react";
import type { TableEditorTab } from "../types/editorTypes";
import { useDataStore } from "../../../stores/data";
import type { DataTable } from "../../../../types/builder/data.types";
import { PropertySwitch } from "../../../components";
import { DataGrid } from "../grid/DataGrid";
import { findLinkedApi } from "../utils/collectionBadgeStatus";
import "./DataTableEditor.css";
import { translateKey, useOptionalI18n } from "../../../../i18n";

interface DataTableEditorProps {
  dataTable: DataTable;
  onClose: () => void;
  activeTab: TableEditorTab;
}

export function DataTableEditor({
  dataTable,
  onClose,
  activeTab,
}: DataTableEditorProps) {
  const updateCollection = useDataStore((state) => state.updateCollection);
  const shellI18n = useOptionalI18n();
  const rootI18nT = shellI18n ? (key: string) => shellI18n.t(key) : null;

  // useMockData 토글
  const handleUseMockDataToggle = useCallback(
    async (checked: boolean) => {
      try {
        await updateCollection(dataTable.id, { useMockData: checked });
      } catch (error) {
        console.error("useMockData 업데이트 실패:", error);
      }
    },
    [dataTable.id, updateCollection],
  );

  // 이름 변경
  const handleNameChange = useCallback(
    async (name: string) => {
      try {
        await updateCollection(dataTable.id, { name });
      } catch (error) {
        console.error("이름 업데이트 실패:", error);
      }
    },
    [dataTable.id, updateCollection],
  );

  // Note: onClose is handled by parent DataTableEditorPanel
  void onClose;

  const apiEndpointsMap = useDataStore((state) => state.apiEndpoints);
  const apiRuns = useDataStore((state) => state.apiRuns);
  const editorStatus = useMemo(() => {
    const rowCount = dataTable.useMockData
      ? dataTable.mockData.length
      : (dataTable.runtimeData?.length ?? dataTable.mockData.length);
    const linked = findLinkedApi(
      dataTable,
      Array.from(apiEndpointsMap.values()),
    );
    const run = linked ? apiRuns.get(linked.id) : undefined;
    if (
      run &&
      (run.ok === false || (run.response && run.response.status >= 400))
    )
      return { tone: "error" as const, key: "editorError" };
    if (rowCount === 0) return { tone: "empty" as const, key: "editorEmpty" };
    return null;
  }, [dataTable, apiEndpointsMap, apiRuns]);

  const localizeStatus = (key: string) =>
    rootI18nT ? rootI18nT(`datatable.${key}`) : key;

  return (
    <>
      {activeTab === "data" && (
        <>
          {editorStatus && (
            <div
              className="datatable-editor-status"
              data-tone={editorStatus.tone}
            >
              {localizeStatus(editorStatus.key)}
            </div>
          )}
          <DataGrid table={dataTable} />
        </>
      )}

      {activeTab === "settings" && (
        <SettingsEditor
          name={dataTable.name}
          useMockData={dataTable.useMockData}
          onNameChange={handleNameChange}
          onUseMockDataChange={handleUseMockDataToggle}
        />
      )}
    </>
  );
}

// ============================================
// Settings Editor
// ============================================

interface SettingsEditorProps {
  name: string;
  useMockData: boolean;
  onNameChange: (name: string) => void;
  onUseMockDataChange: (checked: boolean) => void;
}

function SettingsEditor({
  name,
  useMockData,
  onNameChange,
  onUseMockDataChange,
}: SettingsEditorProps) {
  const i18n = useOptionalI18n();
  const localize = (key: string, fallback: string) =>
    i18n ? translateKey(i18n.t, `datatable.${key}`, fallback) : fallback;
  // 로컬 상태로 관리하여 타이핑 중 불필요한 리렌더링 방지
  const [localName, setLocalName] = useState(name);

  return (
    <div className="settings-editor">
      <div className="settings-field">
        <label className="settings-label">
          {localize("tableName", "Table Name")}
        </label>
        <input
          type="text"
          className="settings-input"
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          onBlur={() => {
            if (localName !== name) {
              onNameChange(localName);
            }
          }}
        />
      </div>
      <PropertySwitch
        label="Use Table Data"
        isSelected={useMockData}
        onChange={onUseMockDataChange}
      />
      <p className="settings-description">
        {useMockData
          ? localize(
              "useTableDataHint",
              "Using table data instead of the API response.",
            )
          : localize("useApiDataHint", "Using the actual API response data.")}
      </p>
    </div>
  );
}

// ============================================
// Helpers

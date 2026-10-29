/**
 * DataTableEditor - DataTable 상세 편집 컴포넌트
 *
 * 기능:
 * - 스키마 정의 (필드 추가/삭제/수정) — ADR-212 Phase 3 에서 격자 헤더 + 필드 패널로 이전
 * - 행 격자 (`grid/DataGrid` — RAC Table role=grid, ADR-212 Phase 2)
 * - 표 설정 (Use table data · API endpoint · Execution policy) 은 ADR-288 G6 수정 9 로 목록 행의
 *   ⋮ → «Edit table…» 팝오버 (`components/TableSettingsPopover`) 로 옮겼다 — 본문은 격자 하나.
 */

import { useMemo } from "react";
import { useDataStore } from "../../../stores/data";
import type { DataTable } from "../../../../types/builder/data.types";
import { DataGrid } from "../grid/DataGrid";
import { findLinkedApi } from "../utils/collectionBadgeStatus";
import "./DataTableEditor.css";
import { useOptionalI18n } from "../../../../i18n";

interface DataTableEditorProps {
  dataTable: DataTable;
  onClose: () => void;
}

export function DataTableEditor({ dataTable, onClose }: DataTableEditorProps) {
  const shellI18n = useOptionalI18n();
  const rootI18nT = shellI18n ? (key: string) => shellI18n.t(key) : null;

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
      {editorStatus && (
        <div className="datatable-editor-status" data-tone={editorStatus.tone}>
          {localizeStatus(editorStatus.key)}
        </div>
      )}
      <DataGrid table={dataTable} />
    </>
  );
}

// ============================================
// Helpers

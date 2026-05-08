/**
 * DataTable Editor
 *
 * DataTable 컴포넌트의 속성 편집기
 * 데이터 소스 설정 및 새로고침 옵션을 관리
 *
 * @see docs/PLANNED_FEATURES.md - DataTable Component Architecture
 */

import { memo, useCallback, useMemo } from "react";
import {
  Database,
  FileText,
  RefreshCw,
  Clock,
  Eye,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import {
  PropertyInput,
  PropertySwitch,
  PropertyCustomId,
  PropertySection,
} from "../../../components";
import { PropertyEditorProps } from "../types/editorTypes";
import { useStore } from "../../../stores";
import { useCanonicalPropertyElement } from "../hooks/useCanonicalPropertyRead";
import { useDataTableStore } from "../../../stores/datatable";
import { iconEditProps } from "../../../../utils/ui/uiConstants";

export const DataTableEditor = memo(function DataTableEditor({
  elementId,
  currentProps,
  onUpdate,
}: PropertyEditorProps) {
  const element = useCanonicalPropertyElement(elementId);
  const customId = useMemo(() => element?.customId || "", [element?.customId]);

  // DataTable Store에서 현재 DataTable 상태 가져오기
  const dataTableId = String(currentProps.id || "");
  const dataTableState = useDataTableStore((state) =>
    dataTableId ? state.dataTableStates.get(dataTableId) : undefined,
  );
  const loadDataTable = useDataTableStore((state) => state.loadDataTable);
  const refreshDataTable = useDataTableStore((state) => state.refreshDataTable);

  // 변경된 key만 전달 — updateAndSave가 element.props와 merge하므로 stale props 전파 방지
  const updateProp = useCallback(
    (key: string, value: unknown) => {
      onUpdate({ [key]: value });
    },
    [onUpdate],
  );

  // Update customId helper
  const updateCustomId = useCallback(
    (newCustomId: string) => {
      const updateElement = useStore.getState().updateElement;
      if (updateElement && elementId) {
        updateElement(elementId, { customId: newCustomId });
      }
    },
    [elementId],
  );

  // Refresh handler
  const handleRefresh = useCallback(() => {
    if (dataTableId) {
      refreshDataTable(dataTableId);
    }
  }, [dataTableId, refreshDataTable]);

  // Load handler
  const handleLoad = useCallback(() => {
    if (dataTableId) {
      loadDataTable(dataTableId);
    }
  }, [dataTableId, loadDataTable]);

  // Status icon renderer
  const renderStatusIcon = () => {
    if (!dataTableState) return null;

    switch (dataTableState.status) {
      case "loading":
        return <Loader2 size={iconEditProps.size} className="spin" />;
      case "success":
        return (
          <CheckCircle2 size={iconEditProps.size} className="text-success" />
        );
      case "error":
        return <AlertCircle size={iconEditProps.size} className="text-error" />;
      default:
        return null;
    }
  };

  return (
    <>
      {/* DataTable Settings Section */}
      <PropertySection title="DataTable Settings" icon={Database}>
        <PropertyCustomId
          label="ID"
          value={customId}
          elementId={elementId}
          onChange={updateCustomId}
          placeholder="datatable_1"
        />

        <PropertyInput
          label="DataTable ID"
          value={String(currentProps.id || "")}
          onChange={(value) => updateProp("id", value || "")}
          placeholder="users-datatable"
          icon={Database}
          description="Unique identifier for this datatable"
        />

        <PropertyInput
          label="Name"
          value={String(currentProps.name || "")}
          onChange={(value) => updateProp("name", value || "")}
          placeholder="Users Data"
          icon={FileText}
          description="Display name for this datatable"
        />

        <PropertyInput
          label="Description"
          value={String(currentProps.description || "")}
          onChange={(value) => updateProp("description", value || undefined)}
          placeholder="User information from API"
          icon={FileText}
          description="Optional description"
        />
      </PropertySection>

      {/* Auto Refresh Section */}
      <PropertySection title="Auto Refresh" icon={RefreshCw}>
        <PropertySwitch
          label="Auto Load"
          isSelected={currentProps.autoLoad !== false}
          onChange={(checked) => updateProp("autoLoad", checked)}
          icon={Eye}
          description="Load data automatically on mount"
        />

        <PropertyInput
          label="Refresh Interval (ms)"
          value={String(currentProps.refreshInterval || "")}
          onChange={(value) => {
            const num = parseInt(value, 10);
            updateProp("refreshInterval", isNaN(num) ? undefined : num);
          }}
          placeholder="0 (disabled)"
          icon={Clock}
          description="Auto-refresh interval (0 = disabled)"
        />
      </PropertySection>

      {/* DataTable Status Section */}
      <PropertySection title="DataTable Status" icon={Eye}>
        <div className="datatable-status-preview">
          <div className="datatable-status-row">
            <span className="datatable-status-label">Status:</span>
            <span className="datatable-status-value">
              {renderStatusIcon()}
              {dataTableState?.status || "Not registered"}
            </span>
          </div>

          {dataTableState?.data && (
            <div className="datatable-status-row">
              <span className="datatable-status-label">Items:</span>
              <span className="datatable-status-value">
                {dataTableState.data.length}
              </span>
            </div>
          )}

          {dataTableState?.error && (
            <div className="datatable-status-row error">
              <span className="datatable-status-label">Error:</span>
              <span className="datatable-status-value text-error">
                {dataTableState.error}
              </span>
            </div>
          )}

          {dataTableState?.lastLoadedAt && (
            <div className="datatable-status-row">
              <span className="datatable-status-label">Last loaded:</span>
              <span className="datatable-status-value">
                {new Date(dataTableState.lastLoadedAt).toLocaleTimeString()}
              </span>
            </div>
          )}

          {dataTableState?.consumers && dataTableState.consumers.length > 0 && (
            <div className="datatable-status-row">
              <span className="datatable-status-label">Consumers:</span>
              <span className="datatable-status-value">
                {dataTableState.consumers.length} component(s)
              </span>
            </div>
          )}
        </div>

        <div className="datatable-actions">
          <button
            className="control-button secondary"
            onClick={handleLoad}
            disabled={!dataTableId || dataTableState?.status === "loading"}
          >
            <Database size={iconEditProps.size} />
            Load Data
          </button>

          <button
            className="control-button secondary"
            onClick={handleRefresh}
            disabled={!dataTableId || dataTableState?.status === "loading"}
          >
            <RefreshCw size={iconEditProps.size} />
            Refresh
          </button>
        </div>
      </PropertySection>

      {/* Usage Info Section */}
      <PropertySection title="Usage Info">
        <div className="datatable-editor-info">
          <p className="datatable-editor-info-text">
            DataTable provides centralized data management. Other components can
            reference this datatable using its ID.
          </p>
          <ul className="datatable-editor-info-list">
            <li>
              Set a unique DataTable ID (e.g., "users-datatable",
              "products-api")
            </li>
            <li>Configure data source in Events Panel</li>
            <li>
              Reference in ListBox, Select, ComboBox with{" "}
              <code>dataTableId</code> prop
            </li>
            <li>Multiple components can share the same datatable</li>
          </ul>
        </div>
      </PropertySection>
    </>
  );
});

export default DataTableEditor;

/**
 * ColumnSelector - API 응답에서 감지된 컬럼 선택 컴포넌트
 *
 * 기능:
 * - 감지된 컬럼 표시 (타입, 샘플값 포함)
 * - 체크박스로 개별 컬럼 선택/해제
 * - 전체 선택/해제
 * - Import to DataTable 버튼
 */

import { useState, useCallback } from "react";
import { Check, Square, CheckSquare, Table2, Upload } from "lucide-react";
import { Button } from "react-aria-components";
import type { DetectedColumn } from "../utils/columnDetector";
import "./ColumnSelector.css";
import { iconProps, iconEditProps } from "../../../../utils/ui/uiConstants";
import { translateKey, useOptionalI18n } from "../../../../i18n";

interface ColumnSelectorProps {
  columns: DetectedColumn[];
  onColumnsChange: (columns: DetectedColumn[]) => void;
  onImport: (columns: DetectedColumn[], tableName: string) => void;
  isImporting?: boolean;
  /** Response 탭에서 설정한 Target DataTable 이름 (기본값으로 사용) */
  defaultTableName?: string;
}

export function ColumnSelector({
  columns,
  onColumnsChange,
  onImport,
  isImporting = false,
  defaultTableName = "",
}: ColumnSelectorProps) {
  const i18n = useOptionalI18n();
  const localize = (key: string, fallback: string) =>
    i18n ? translateKey(i18n.t, `datatable.${key}`, fallback) : fallback;
  // defaultTableName이 있으면 기본값으로 사용
  const [tableName, setTableName] = useState(defaultTableName);

  const selectedCount = columns.filter((c) => c.selected).length;
  const allSelected = selectedCount === columns.length;
  const noneSelected = selectedCount === 0;

  // 개별 컬럼 토글
  const handleToggle = useCallback(
    (key: string) => {
      const updated = columns.map((col) =>
        col.key === key ? { ...col, selected: !col.selected } : col,
      );
      onColumnsChange(updated);
    },
    [columns, onColumnsChange],
  );

  // 전체 선택/해제
  const handleToggleAll = useCallback(() => {
    const newSelected = !allSelected;
    const updated = columns.map((col) => ({ ...col, selected: newSelected }));
    onColumnsChange(updated);
  }, [columns, allSelected, onColumnsChange]);

  // Import 실행
  const handleImport = useCallback(() => {
    if (noneSelected || !tableName.trim()) {
      return;
    }
    onImport(columns, tableName.trim());
  }, [columns, tableName, noneSelected, onImport]);

  // 샘플값 포맷팅
  const formatSampleValue = (value: unknown): string => {
    if (value === null || value === undefined) {
      return "null";
    }
    if (typeof value === "string") {
      return value.length > 30 ? `"${value.slice(0, 30)}..."` : `"${value}"`;
    }
    if (typeof value === "object") {
      return JSON.stringify(value).slice(0, 30) + "...";
    }
    return String(value);
  };

  // 타입 배지 색상
  const getTypeBadgeClass = (type: string): string => {
    switch (type) {
      case "string":
        return "type-string";
      case "number":
        return "type-number";
      case "boolean":
        return "type-boolean";
      case "date":
      case "datetime":
        return "type-date";
      case "email":
        return "type-email";
      case "url":
      case "image":
        return "type-url";
      case "array":
      case "object":
        return "type-complex";
      default:
        return "";
    }
  };

  return (
    <div className="column-selector">
      <div className="column-selector-header">
        <h4 className="column-selector-title">
          <Table2 {...iconProps} />
          {localize("detectedColumns", "Detected Columns")}
        </h4>
        <span className="column-selector-count">
          {selectedCount} / {columns.length} {localize("selected", "selected")}
        </span>
      </div>

      {/* 전체 선택 체크박스 */}
      <div className="column-selector-actions">
        <Button className="control-button" onPress={handleToggleAll}>
          {allSelected ? (
            <CheckSquare {...iconProps} />
          ) : (
            <Square {...iconProps} />
          )}
          {allSelected
            ? localize("deselectAll", "Deselect All")
            : localize("selectAll", "Select All")}
        </Button>
      </div>

      {/* 컬럼 목록 */}
      <div className="column-list">
        {columns.map((column) => (
          <div
            key={column.key}
            className={`column-item ${column.selected ? "selected" : ""}`}
            onClick={() => handleToggle(column.key)}
          >
            <div className="column-checkbox">
              {column.selected ? (
                <Check {...iconEditProps} className="check-icon" />
              ) : (
                <div className="empty-checkbox" />
              )}
            </div>

            <div className="column-info">
              <div className="column-key">{column.key}</div>
              <div className="column-meta">
                <span
                  className={`type-badge ${getTypeBadgeClass(column.type)}`}
                >
                  {column.type}
                </span>
                <span className="sample-value">
                  {formatSampleValue(column.sampleValue)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Import 섹션 */}
      <div className="import-section">
        <div className="import-input-row">
          <label className="import-label">
            {localize("dataTableName", "DataTable Name")}
          </label>
          <input
            type="text"
            className="import-input"
            value={tableName}
            onChange={(e) => setTableName(e.target.value)}
            placeholder="e.g., users_api"
          />
        </div>

        <Button
          className="control-button"
          data-variant="primary"
          onPress={handleImport}
          isDisabled={noneSelected || !tableName.trim() || isImporting}
        >
          <Upload {...iconEditProps} />
          {isImporting
            ? localize("importing", "Importing...")
            : `${localize("import", "Import")} ${selectedCount} ${localize("columns", "Columns")}`}
        </Button>
      </div>
    </div>
  );
}

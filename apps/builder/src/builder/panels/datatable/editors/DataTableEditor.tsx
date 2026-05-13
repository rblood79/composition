/**
 * DataTableEditor - DataTable 상세 편집 컴포넌트
 *
 * 기능:
 * - 스키마 정의 (필드 추가/삭제/수정)
 * - Mock 데이터 관리 (필터, CSV 가져오기)
 * - useMockData 토글
 */

import { useState, useCallback, useMemo, useRef } from "react";
import { Plus, Trash2, Search, Upload, Download, X } from "lucide-react";
import type { TableEditorTab } from "../types/editorTypes";
import Papa from "papaparse";
import { useDataStore } from "../../../stores/data";
import type {
  DataTable,
  DataField,
  DataFieldType,
} from "../../../../types/builder/data.types";
import { PropertySwitch } from "../../../components";
import "./DataTableEditor.css";
import { iconEditProps, iconSmall } from "../../../../utils/ui/uiConstants";

interface DataTableEditorProps {
  dataTable: DataTable;
  onClose: () => void;
  activeTab: TableEditorTab;
}

const FIELD_TYPES: { value: DataFieldType; label: string }[] = [
  { value: "string", label: "String" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
  { value: "date", label: "Date" },
  { value: "datetime", label: "DateTime" },
  { value: "email", label: "Email" },
  { value: "url", label: "URL" },
  { value: "image", label: "Image" },
  { value: "array", label: "Array" },
  { value: "object", label: "Object" },
];

export function DataTableEditor({
  dataTable,
  onClose,
  activeTab,
}: DataTableEditorProps) {
  const updateCollection = useDataStore((state) => state.updateCollection);
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());

  // Schema 업데이트
  const handleSchemaUpdate = useCallback(
    async (newSchema: DataField[]) => {
      try {
        await updateCollection(dataTable.id, { schema: newSchema });
      } catch (error) {
        console.error("스키마 업데이트 실패:", error);
      }
    },
    [dataTable.id, updateCollection]
  );

  // 필드 추가
  const handleAddField = useCallback(() => {
    const newField: DataField = {
      key: `field_${Date.now()}`,
      type: "string",
      label: "New Field",
      required: false,
    };
    handleSchemaUpdate([...dataTable.schema, newField]);
  }, [dataTable.schema, handleSchemaUpdate]);

  // 필드 삭제
  const handleDeleteField = useCallback(
    (fieldKey: string) => {
      const newSchema = dataTable.schema.filter((f) => f.key !== fieldKey);
      handleSchemaUpdate(newSchema);
    },
    [dataTable.schema, handleSchemaUpdate]
  );

  // 필드 업데이트
  const handleUpdateField = useCallback(
    (fieldKey: string, updates: Partial<DataField>) => {
      const newSchema = dataTable.schema.map((f) =>
        f.key === fieldKey ? { ...f, ...updates } : f
      );
      handleSchemaUpdate(newSchema);
    },
    [dataTable.schema, handleSchemaUpdate]
  );

  // Mock 데이터 업데이트
  const handleMockDataUpdate = useCallback(
    async (newMockData: Record<string, unknown>[]) => {
      try {
        await updateCollection(dataTable.id, { mockData: newMockData });
      } catch (error) {
        console.error("Mock 데이터 업데이트 실패:", error);
      }
    },
    [dataTable.id, updateCollection]
  );

  // Mock 데이터 행 추가
  const handleAddMockRow = useCallback(() => {
    const newRow: Record<string, unknown> = {};
    const newRowIndex = dataTable.mockData.length + 1;

    dataTable.schema.forEach((field) => {
      // id 필드는 고유한 값을 자동 생성
      if (field.key === "id") {
        if (field.type === "number") {
          newRow[field.key] = newRowIndex;
        } else {
          newRow[field.key] = `row_${newRowIndex}`;
        }
      } else {
        newRow[field.key] =
          field.defaultValue ?? getDefaultValueForType(field.type);
      }
    });
    handleMockDataUpdate([...dataTable.mockData, newRow]);
  }, [dataTable.schema, dataTable.mockData, handleMockDataUpdate]);

  // Mock 데이터 행 삭제
  const handleDeleteMockRow = useCallback(
    (index: number) => {
      const newMockData = dataTable.mockData.filter((_, i) => i !== index);
      handleMockDataUpdate(newMockData);
    },
    [dataTable.mockData, handleMockDataUpdate]
  );

  // Mock 데이터 셀 업데이트
  const handleUpdateMockCell = useCallback(
    (rowIndex: number, fieldKey: string, value: unknown) => {
      const newMockData = dataTable.mockData.map((row, i) =>
        i === rowIndex ? { ...row, [fieldKey]: value } : row
      );
      handleMockDataUpdate(newMockData);
    },
    [dataTable.mockData, handleMockDataUpdate]
  );

  // CSV 가져오기 (기존 데이터 대체)
  const handleImportCSV = useCallback(
    (importedData: Record<string, unknown>[]) => {
      handleMockDataUpdate(importedData);
    },
    [handleMockDataUpdate]
  );

  // useMockData 토글
  const handleUseMockDataToggle = useCallback(
    async (checked: boolean) => {
      try {
        await updateCollection(dataTable.id, { useMockData: checked });
      } catch (error) {
        console.error("useMockData 업데이트 실패:", error);
      }
    },
    [dataTable.id, updateCollection]
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
    [dataTable.id, updateCollection]
  );

  // Note: onClose is handled by parent DataTableEditorPanel
  void onClose;

  return (
    <>
      {activeTab === "schema" && (
        <SchemaEditor
          schema={dataTable.schema}
          expandedFields={expandedFields}
          setExpandedFields={setExpandedFields}
          onAddField={handleAddField}
          onDeleteField={handleDeleteField}
          onUpdateField={handleUpdateField}
        />
      )}

      {activeTab === "data" && (
        <MockDataEditor
          schema={dataTable.schema}
          mockData={dataTable.mockData}
          onAddRow={handleAddMockRow}
          onDeleteRow={handleDeleteMockRow}
          onUpdateCell={handleUpdateMockCell}
          onImportCSV={handleImportCSV}
        />
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
// Schema Editor
// ============================================

interface SchemaEditorProps {
  schema: DataField[];
  expandedFields: Set<string>;
  setExpandedFields: React.Dispatch<React.SetStateAction<Set<string>>>;
  onAddField: () => void;
  onDeleteField: (key: string) => void;
  onUpdateField: (key: string, updates: Partial<DataField>) => void;
}

// 개별 스키마 필드 행 컴포넌트 (로컬 상태로 IME 문제 해결)
interface SchemaFieldRowProps {
  field: DataField;
  onUpdateField: (key: string, updates: Partial<DataField>) => void;
  onDeleteField: (key: string) => void;
}

function SchemaFieldRow({
  field,
  onUpdateField,
  onDeleteField,
}: SchemaFieldRowProps) {
  // 각 필드에 대한 로컬 상태 (key 변경 시 컴포넌트가 새로 마운트되어 자동 초기화)
  const [localKey, setLocalKey] = useState(field.key);
  const [localLabel, setLocalLabel] = useState(field.label || "");

  return (
    <tr>
      <td>
        <input
          type="text"
          className="cell-input"
          value={localKey}
          onChange={(e) => setLocalKey(e.target.value)}
          onBlur={() => {
            if (localKey !== field.key) {
              onUpdateField(field.key, { key: localKey });
            }
          }}
        />
      </td>
      <td>
        <select
          className="cell-select"
          value={field.type}
          onChange={(e) =>
            onUpdateField(field.key, { type: e.target.value as DataFieldType })
          }
        >
          {FIELD_TYPES.map((ft) => (
            <option key={ft.value} value={ft.value}>
              {ft.label}
            </option>
          ))}
        </select>
      </td>
      <td>
        <input
          type="text"
          className="cell-input"
          value={localLabel}
          onChange={(e) => setLocalLabel(e.target.value)}
          onBlur={() => onUpdateField(field.key, { label: localLabel })}
          placeholder="Label"
        />
      </td>
      <td className="cell-center">
        <input
          type="checkbox"
          checked={field.required || false}
          onChange={(e) =>
            onUpdateField(field.key, { required: e.target.checked })
          }
        />
      </td>
      <td>
        <button
          type="button"
          className="delete-row-btn"
          onClick={() => onDeleteField(field.key)}
        >
          <Trash2 size={iconSmall.size} />
        </button>
      </td>
    </tr>
  );
}

function SchemaEditor({
  schema,
  onAddField,
  onDeleteField,
  onUpdateField,
}: SchemaEditorProps) {
  return (
    <div className="section">
      <div className="section-content">
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Type</th>
                <th>Label</th>
                <th>Req</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {schema.map((field) => (
                <SchemaFieldRow
                  key={field.key}
                  field={field}
                  onUpdateField={onUpdateField}
                  onDeleteField={onDeleteField}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <button type="button" className="add-field-btn" onClick={onAddField}>
        <Plus {...iconEditProps} />
        Add Column
      </button>
    </div>
  );
}

// ============================================
// Mock Data Editor
// ============================================

interface MockDataEditorProps {
  schema: DataField[];
  mockData: Record<string, unknown>[];
  onAddRow: () => void;
  onDeleteRow: (index: number) => void;
  onUpdateCell: (rowIndex: number, fieldKey: string, value: unknown) => void;
  onImportCSV: (data: Record<string, unknown>[]) => void;
}

function MockDataEditor({
  schema,
  mockData,
  onAddRow,
  onDeleteRow,
  onUpdateCell,
  onImportCSV,
}: MockDataEditorProps) {
  const [filterText, setFilterText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 필터링된 데이터 (원본 인덱스 유지)
  const filteredData = useMemo(() => {
    if (!filterText.trim()) {
      return mockData.map((row, index) => ({ row, originalIndex: index }));
    }

    const searchTerm = filterText.toLowerCase();
    return mockData
      .map((row, index) => ({ row, originalIndex: index }))
      .filter(({ row }) =>
        schema.some((field) => {
          const value = row[field.key];
          if (value === null || value === undefined) return false;
          return String(value).toLowerCase().includes(searchTerm);
        })
      );
  }, [mockData, schema, filterText]);

  // CSV 파일 처리
  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const parsedData = results.data as Record<string, unknown>[];

          // 스키마에 맞게 데이터 타입 변환
          const convertedData = parsedData.map((row, index) => {
            const convertedRow: Record<string, unknown> = {};

            schema.forEach((field) => {
              const rawValue = row[field.key];
              convertedRow[field.key] = convertValueToType(
                rawValue,
                field.type,
                index + 1
              );
            });

            return convertedRow;
          });

          onImportCSV(convertedData);

          // 파일 입력 초기화
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        },
        error: (error) => {
          console.error("CSV 파싱 오류:", error);
        },
      });
    },
    [schema, onImportCSV]
  );

  // CSV 내보내기
  const handleExportCSV = useCallback(() => {
    if (mockData.length === 0) return;

    const csv = Papa.unparse(mockData, {
      columns: schema.map((f) => f.key),
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "data.csv";
    link.click();
    URL.revokeObjectURL(url);
  }, [mockData, schema]);

  if (schema.length === 0) {
    return <div className="data-empty">스키마를 먼저 정의하세요.</div>;
  }

  return (
    <div className="section">
      {/* Toolbar */}
      <div className="section-content">
        <div className="data-toolbar">
          {/* Filter */}
          <div className="filter-input-wrapper">
            <Search {...iconEditProps} className="filter-icon" />
            <input
              type="text"
              className="filter-input"
              placeholder="Filter rows..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
            {filterText && (
              <button
                type="button"
                className="filter-clear-btn"
                onClick={() => setFilterText("")}
              >
                <X size={iconSmall.size} />
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="toolbar-actions">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              style={{ display: "none" }}
            />
            <button
              type="button"
              className="toolbar-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Import CSV"
            >
              <Upload {...iconEditProps} />
              Import
            </button>
            <button
              type="button"
              className="toolbar-btn"
              onClick={handleExportCSV}
              disabled={mockData.length === 0}
              title="Export CSV"
            >
              <Download {...iconEditProps} />
              Export
            </button>
          </div>
        </div>

        {/* Filter 결과 표시 */}
        {filterText && (
          <div className="filter-result-info">
            {filteredData.length} / {mockData.length} rows
          </div>
        )}

        {/* Table */}
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th className="row-index">#</th>
                {schema.map((field) => (
                  <th key={field.key}>{field.key}</th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map(({ row, originalIndex }) => (
                <tr key={originalIndex}>
                  <td className="row-index">{originalIndex + 1}</td>
                  {schema.map((field) => (
                    <td key={field.key}>
                      <CellEditor
                        key={`${originalIndex}-${field.key}-${JSON.stringify(
                          row[field.key]
                        )}`}
                        fieldType={field.type}
                        value={row[field.key]}
                        onChange={(value) =>
                          onUpdateCell(originalIndex, field.key, value)
                        }
                      />
                    </td>
                  ))}
                  <td>
                    <button
                      type="button"
                      className="delete-row-btn"
                      onClick={() => onDeleteRow(originalIndex)}
                    >
                      <Trash2 size={iconSmall.size} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>


      </div>
      <button type="button" className="add-row-btn" onClick={onAddRow}>
        <Plus {...iconEditProps} />
        Add Row
      </button>
    </div>
  );
}

// CSV 값을 필드 타입에 맞게 변환
function convertValueToType(
  value: unknown,
  type: DataFieldType,
  rowIndex: number
): unknown {
  if (value === null || value === undefined || value === "") {
    return getDefaultValueForType(type);
  }

  const strValue = String(value);

  switch (type) {
    case "number": {
      const num = Number(strValue);
      return isNaN(num) ? 0 : num;
    }
    case "boolean":
      return strValue.toLowerCase() === "true" || strValue === "1";
    case "date":
      // ISO 날짜 형식으로 변환 시도
      try {
        const date = new Date(strValue);
        return isNaN(date.getTime())
          ? new Date().toISOString().split("T")[0]
          : date.toISOString().split("T")[0];
      } catch {
        return new Date().toISOString().split("T")[0];
      }
    case "datetime":
      try {
        const datetime = new Date(strValue);
        return isNaN(datetime.getTime())
          ? new Date().toISOString()
          : datetime.toISOString();
      } catch {
        return new Date().toISOString();
      }
    case "array":
      try {
        const parsed = JSON.parse(strValue);
        return Array.isArray(parsed) ? parsed : [strValue];
      } catch {
        return strValue.split(",").map((s) => s.trim());
      }
    case "object":
      try {
        return JSON.parse(strValue);
      } catch {
        return {};
      }
    default:
      // id 필드인 경우 자동 생성
      if (strValue === "" || strValue === "undefined") {
        return `row_${rowIndex}`;
      }
      return strValue;
  }
}

// ============================================
// Cell Editor
// ============================================

interface CellEditorProps {
  fieldType: DataFieldType;
  value: unknown;
  onChange: (value: unknown) => void;
}

function CellEditor({ fieldType, value, onChange }: CellEditorProps) {
  // 로컬 상태로 관리하여 한국어 IME 조합 문제 해결
  // useState 초기값으로 props를 사용하고, key prop으로 리셋 처리
  const [localValue, setLocalValue] = useState<string>(String(value || ""));

  const handleBlur = () => {
    // blur 시에만 부모에 알림
    if (fieldType === "number") {
      onChange(localValue === "" ? 0 : Number(localValue));
    } else {
      onChange(localValue);
    }
  };

  switch (fieldType) {
    case "boolean":
      return (
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
      );
    case "number":
      return (
        <input
          type="number"
          className="cell-input"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleBlur}
        />
      );
    case "date":
      return (
        <input
          type="date"
          className="cell-input"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleBlur}
        />
      );
    case "datetime":
      return (
        <input
          type="datetime-local"
          className="cell-input"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleBlur}
        />
      );
    default:
      return (
        <input
          type="text"
          className="cell-input"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleBlur}
        />
      );
  }
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
  // 로컬 상태로 관리하여 타이핑 중 불필요한 리렌더링 방지
  const [localName, setLocalName] = useState(name);

  return (
    <div className="settings-editor">
      <div className="settings-field">
        <label className="settings-label">테이블 이름</label>
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
          ? "Table 데이터를 사용합니다. API 응답 대신 정의된 Table 데이터가 표시됩니다."
          : "실제 API 응답 데이터를 사용합니다."}
      </p>
    </div>
  );
}

// ============================================
// Helpers
// ============================================

function getDefaultValueForType(type: DataFieldType): unknown {
  switch (type) {
    case "string":
    case "email":
    case "url":
    case "image":
      return "";
    case "number":
      return 0;
    case "boolean":
      return false;
    case "date":
    case "datetime":
      return new Date().toISOString().split("T")[0];
    case "array":
      return [];
    case "object":
      return {};
    default:
      return "";
  }
}

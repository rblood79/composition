/**
 * DataTableEditor - DataTable 상세 편집 컴포넌트
 *
 * 기능:
 * - 스키마 정의 (필드 추가/삭제/수정) — ADR-212 Phase 3 에서 격자 헤더 + 필드 패널로 이전
 * - 행 격자 (`grid/DataGrid` — RAC Table role=grid, ADR-212 Phase 2)
 * - useMockData 토글
 */

import { useState, useCallback } from "react";
import type { TableEditorTab } from "../types/editorTypes";
import { useDataStore } from "../../../stores/data";
import type {
  DataTable,
  DataField,
  DataFieldType,
} from "../../../../types/builder/data.types";
import { PropertySwitch } from "../../../components";
import { globalToast } from "../../../stores/toast";
import { renameRowsKey } from "../../../../utils/data/schemaMigration";
import { DataGrid } from "../grid/DataGrid";
import "./DataTableEditor.css";
import { iconEditProps, iconSmall } from "../../../../utils/ui/uiConstants";
import { ACTION_ICONS } from "../../../config/actionIcons";
import {
  semanticLabelKeys,
  translateKey,
  useOptionalI18n,
} from "../../../../i18n";
/** 여러 화면에 공통으로 나오는 액션의 아이콘 정본 (`config/actionIcons.ts`). */
const AddIcon = ACTION_ICONS.add;

/** 컨텍스트 메뉴·다중 선택 툴바와 같은 삭제 아이콘 정본 (`config/actionIcons.ts`). */
const DeleteIcon = ACTION_ICONS.delete;

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
  const rootI18n = useOptionalI18n();
  /** 보간이 필요한 문구 — provider 밖(격리 렌더)이면 키를 그대로 돌려준다. */
  const localizeRoot = useCallback(
    (key: string, params?: Record<string, string | number | boolean>) =>
      rootI18n ? rootI18n.t(`datatable.${key}`, params) : key,
    [rootI18n],
  );

  // Schema 업데이트
  const handleSchemaUpdate = useCallback(
    async (newSchema: DataField[]) => {
      try {
        await updateCollection(dataTable.id, { schema: newSchema });
      } catch (error) {
        console.error("스키마 업데이트 실패:", error);
      }
    },
    [dataTable.id, updateCollection],
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
    [dataTable.schema, handleSchemaUpdate],
  );

  // 필드 업데이트 — key 가 바뀌면 행 값도 같이 옮긴다 (리서치 D2: schema 만 갱신하면
  // mockData · runtimeData 의 그 컬럼이 옛 key 아래에 고아로 남는다)
  const handleUpdateField = useCallback(
    async (fieldKey: string, updates: Partial<DataField>) => {
      const newKey = updates.key;
      const renaming = newKey !== undefined && newKey !== fieldKey;
      if (renaming) {
        if (!newKey || dataTable.schema.some((f) => f.key === newKey)) {
          globalToast.warning(
            localizeRoot("fieldKeyExists", { key: newKey ?? "" }),
          );
          return;
        }
      }
      const newSchema = dataTable.schema.map((f) =>
        f.key === fieldKey ? { ...f, ...updates } : f,
      );
      if (!renaming) {
        handleSchemaUpdate(newSchema);
        return;
      }
      try {
        await updateCollection(dataTable.id, {
          schema: newSchema,
          mockData: renameRowsKey(dataTable.mockData, fieldKey, newKey) ?? [],
          runtimeData: renameRowsKey(dataTable.runtimeData, fieldKey, newKey),
        });
      } catch (error) {
        console.error("필드 key 변경 실패:", error);
      }
    },
    [
      dataTable.id,
      dataTable.schema,
      dataTable.mockData,
      dataTable.runtimeData,
      handleSchemaUpdate,
      updateCollection,
      localizeRoot,
    ],
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

      {activeTab === "data" && <DataGrid table={dataTable} />}

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
  const i18n = useOptionalI18n();
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
              {i18n
                ? translateKey(
                    i18n.t,
                    semanticLabelKeys[ft.label] ?? ft.label,
                    ft.label,
                  )
                : ft.label}
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
          placeholder={
            i18n
              ? translateKey(
                  i18n.t,
                  semanticLabelKeys.Label ?? "Label",
                  "Label",
                )
              : "Label"
          }
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
          <DeleteIcon size={iconSmall.size} />
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
  const i18n = useOptionalI18n();
  const localize = (key: string, fallback: string) =>
    i18n ? translateKey(i18n.t, `datatable.${key}`, fallback) : fallback;
  const label = (value: string) =>
    i18n
      ? translateKey(i18n.t, semanticLabelKeys[value] ?? value, value)
      : value;
  return (
    <div className="section">
      <div className="section-content">
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>{label("Key")}</th>
                <th>{label("Type")}</th>
                <th>{label("Label")}</th>
                <th>{label("Req")}</th>
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

      <button
        type="button"
        className="control-button"
        data-variant="add"
        onClick={onAddField}
      >
        <AddIcon {...iconEditProps} />
        {localize("addColumn", "Add Column")}
      </button>
    </div>
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

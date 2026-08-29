/**
 * DataTableCreator - DataTable 생성 패널 컴포넌트
 *
 * Preset 선택 또는 빈 테이블로 DataTable 생성
 * DataTablePresetSelector의 패널 버전
 *
 * 생성 방식(Preset/Empty) 전환은 패널 탭이 담당한다 (DataTableEditorPanel).
 * 여기는 그 아래 본문 — 스크롤 영역 + 고정 푸터 2단으로만 나뉜다.
 *
 * Preset 카테고리는 탭이 아니라 **카테고리당 Section** 이다. 패널 폭(387px)에 5개 라벨이
 * 들어가지 않아 탭 줄이 가로 스크롤되면서 2개가 상시 숨는 문제가 있었고, 같은 일을 하는
 * ComponentList(카테고리별 컴포넌트 팔레트)가 이미 Section 계열이다.
 *
 * @see docs/features/DATATABLE_PRESET_SYSTEM.md
 */

import { useState, useCallback } from "react";
import { Button } from "react-aria-components";
import {
  User,
  Key,
  Lock,
  Mail,
  Building2,
  Layers,
  Folder,
  Package,
  Tag,
  ShoppingCart,
  Cpu,
  Wrench,
  FileText,
  Users,
  Database,
  Settings,
  Factory,
} from "lucide-react";
import { useDataStore } from "../../../stores/data";
import { PropertyFieldset, Section } from "../../../components";
import type { DataTablePreset } from "../presets/types";
import { PRESET_CATEGORIES } from "../presets/types";
import { getPresetsByCategory } from "../presets/dataTablePresets";
import "./DataTableCreator.css";
import { translateKey, useOptionalI18n } from "../../../../i18n";

// ============================================
// Icon Mapping
// ============================================

const iconMap: Record<string, React.ComponentType<{ size?: number }>> = {
  User,
  Key,
  Lock,
  Mail,
  Building2,
  Layers,
  Folder,
  Package,
  Tag,
  ShoppingCart,
  Cpu,
  Wrench,
  FileText,
  Users,
  Database,
  Settings,
  Factory,
};

// ============================================
// Types
// ============================================

type CreatorMode = "empty" | "preset";

interface DataTableCreatorProps {
  projectId: string;
  onClose: () => void;
  mode: CreatorMode;
}

// ============================================
// Component
// ============================================

export function DataTableCreator({
  projectId,
  onClose,
  mode,
}: DataTableCreatorProps) {
  const i18n = useOptionalI18n();
  const localize = (key: string, fallback: string) =>
    i18n ? translateKey(i18n.t, `datatable.${key}`, fallback) : fallback;
  const createDataTable = useDataStore((state) => state.createDataTable);

  // 선택 상태
  const [selectedPreset, setSelectedPreset] = useState<DataTablePreset | null>(
    null,
  );
  const [sampleCount, setSampleCount] = useState(10);
  const [tableName, setTableName] = useState("");

  // Preset 선택 핸들러
  const handlePresetSelect = useCallback((preset: DataTablePreset) => {
    setSelectedPreset(preset);
    setSampleCount(preset.defaultSampleCount);
  }, []);

  // 생성 핸들러
  const handleCreate = useCallback(async () => {
    try {
      if (mode === "empty") {
        const name = tableName.trim() || "New Table";
        await createDataTable({
          name,
          project_id: projectId,
          schema: [],
          mockData: [],
          useMockData: true,
        });
      } else if (selectedPreset) {
        const sampleData = selectedPreset.generateSampleData(sampleCount);
        await createDataTable({
          name: selectedPreset.name,
          project_id: projectId,
          schema: selectedPreset.schema,
          mockData: sampleData,
          useMockData: true,
        });
      }
      onClose();
    } catch (error) {
      console.error("DataTable 생성 실패:", error);
    }
  }, [
    mode,
    tableName,
    selectedPreset,
    sampleCount,
    projectId,
    createDataTable,
    onClose,
  ]);

  // 아이콘 렌더링 헬퍼
  const renderIcon = (iconName: string, size = 20) => {
    const IconComponent = iconMap[iconName];
    return IconComponent ? (
      <IconComponent size={size} />
    ) : (
      <Database size={size} />
    );
  };

  // mode 전환 탭은 DataTableEditorPanel에서 렌더링됨
  return (
    <div className="datatable-creator">
      <div className="datatable-creator-body">
        {mode === "empty" ? (
          <Section
            id="table-creator"
            title={localize("table", "Table")}
            collapsible={false}
          >
            <PropertyFieldset legend={localize("tableName", "Table Name")}>
              <input
                className="react-aria-Input"
                type="text"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                placeholder={localize("newTable", "New Table")}
              />
            </PropertyFieldset>
            <p className="creator-form-hint">
              {localize(
                "emptyTableHint",
                "After creating an empty table, add fields in the Schema tab.",
              )}
            </p>
          </Section>
        ) : (
          PRESET_CATEGORIES.map((cat) => {
            const presets = getPresetsByCategory(cat.id);
            if (presets.length === 0) return null;
            return (
              <Section
                key={cat.id}
                id={`preset-${cat.id}`}
                title={cat.name}
                className="creator-preset-section"
              >
                <div className="list-group" role="list">
                  {presets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      role="listitem"
                      className={`list-item preset-card ${
                        selectedPreset?.id === preset.id ? "selected" : ""
                      }`}
                      onClick={() => handlePresetSelect(preset)}
                    >
                      <div className="list-item-icon">
                        {renderIcon(preset.icon, 16)}
                      </div>
                      <div className="list-item-name">{preset.name}</div>
                      <div className="list-item-desc">{preset.description}</div>
                      <div className="list-item-meta">
                        {preset.schema.length} fields
                      </div>
                    </button>
                  ))}
                </div>
              </Section>
            );
          })
        )}
      </div>

      {/* Schema Preview — 선택 결과 확인이라 스크롤 밖에 고정 */}
      {mode === "preset" && selectedPreset && (
        <Section
          id="schema-preview"
          title={`${selectedPreset.name} ${localize("schema", "Schema")}`}
          actions={
            <div className="creator-sample-count">
              <label htmlFor="sample-count">
                {localize("rowCount", "row count")}
              </label>
              <input
                id="sample-count"
                aria-label={localize("rowCount", "row count")}
                aria-required="true"
                aria-invalid="false"
                type="number"
                min="0"
                max="100"
                value={sampleCount}
                onChange={(e) =>
                  setSampleCount(
                    Math.max(0, Math.min(100, parseInt(e.target.value) || 0)),
                  )
                }
              />
            </div>
          }
          collapsible={false}
        >
          {selectedPreset.schema.map((field) => (
            <div key={field.key} className="creator-schema-field">
              <span className="schema-field-name">
                {field.key}
                {field.required && (
                  <span className="schema-field-required">*</span>
                )}
              </span>
              <span className="schema-field-type">{field.type}</span>
              <span className="schema-field-label">{field.label}</span>
            </div>
          ))}
        </Section>
      )}

      {/* Footer */}
      <div className="creator-footer">
        <Button
          className="control-button"
          onPress={onClose}
        >
          {i18n ? i18n.t("common.cancel") : "Cancel"}
        </Button>
        <Button
          className="control-button"
          data-variant="primary"
          onPress={handleCreate}
          isDisabled={mode === "preset" && !selectedPreset}
        >
          {mode === "empty"
            ? localize("createEmpty", "Create Empty Table")
            : localize("create", "Create")}
        </Button>
      </div>
    </div>
  );
}

export default DataTableCreator;

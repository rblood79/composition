/**
 * DataTableCreator - DataTable 생성 패널 컴포넌트
 *
 * Preset 선택 또는 빈 테이블로 DataTable 생성
 * DataTablePresetSelector의 패널 버전
 *
 * @see docs/features/DATATABLE_PRESET_SYSTEM.md
 */

import { useState, useMemo, useCallback } from "react";
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
import { Section } from "../../../components";
import type { DataTablePreset, PresetCategory } from "../presets/types";
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

const categoryIconMap: Record<
  string,
  React.ComponentType<{ size?: number }>
> = {
  "users-auth": Users,
  organization: Building2,
  ecommerce: ShoppingCart,
  manufacturing: Factory,
  system: Settings,
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
  const [selectedCategory, setSelectedCategory] =
    useState<PresetCategory>("users-auth");
  const [selectedPreset, setSelectedPreset] = useState<DataTablePreset | null>(
    null,
  );
  const [sampleCount, setSampleCount] = useState(10);
  const [tableName, setTableName] = useState("");

  // 카테고리별 Preset 목록
  const presetsInCategory = useMemo(
    () => getPresetsByCategory(selectedCategory),
    [selectedCategory],
  );

  // 카테고리 변경 핸들러
  const handleCategoryChange = useCallback((category: PresetCategory) => {
    setSelectedCategory(category);
    setSelectedPreset(null);
  }, []);

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

  const renderCategoryIcon = (category: PresetCategory, size = 16) => {
    const IconComponent = categoryIconMap[category];
    return IconComponent ? (
      <IconComponent size={size} />
    ) : (
      <Database size={size} />
    );
  };

  // mode-selection은 DataTableEditorPanel에서 렌더링됨
  return (
    <>
      {/* Content */}
      <div className="section" data-section-id="table-creator">
        {mode === "empty" ? (
          /* Empty Table Form */
          <div className="creator-empty-form">
            <label className="creator-form-label">
              {localize("tableName", "Table Name")}
              <input
                type="text"
                className="creator-form-input"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                placeholder={localize("newTable", "New Table")}
              />
            </label>
            <p className="creator-form-hint">
              {localize(
                "emptyTableHint",
                "After creating an empty table, add fields in the Schema tab.",
              )}
            </p>
          </div>
        ) : (
          /* Preset Selection */
          <>
            {/* Category Tabs */}
            <div className="datatable-creator-tabs">
              {PRESET_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`datatable-creator-tab ${
                    selectedCategory === cat.id ? "active" : ""
                  }`}
                  onClick={() => handleCategoryChange(cat.id)}
                  title={cat.description}
                >
                  {renderCategoryIcon(cat.id)}
                  <span>{cat.name}</span>
                </button>
              ))}
            </div>

            {/* Preset Grid */}
            <div className="section-content">
              <div className="list-group" role="list">
                {presetsInCategory.map((preset) => (
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
            </div>
          </>
        )}
      </div>

      {/* Schema Preview - table-creator의 형제로 위치 */}
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
        <Button className="react-aria-Button secondary" onPress={onClose}>
          {i18n ? i18n.t("common.cancel") : "Cancel"}
        </Button>
        <Button
          className="react-aria-Button primary"
          onPress={handleCreate}
          isDisabled={mode === "preset" && !selectedPreset}
        >
          {mode === "empty"
            ? localize("createEmpty", "Create Empty Table")
            : localize("create", "Create")}
        </Button>
      </div>
    </>
  );
}

export default DataTableCreator;

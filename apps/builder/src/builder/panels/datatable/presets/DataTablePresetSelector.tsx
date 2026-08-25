/**
 * DataTable Preset Selector
 *
 * DataTable 추가 시 Preset을 선택할 수 있는 모달 컴포넌트
 * Layout Preset Selector와 유사한 UX 제공
 *
 * @see docs/features/DATATABLE_PRESET_SYSTEM.md
 */

import { useState, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogTrigger,
  Modal,
  ModalOverlay,
  Heading,
  Button,
} from "react-aria-components";
import {
  X,
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
import type { DataTablePreset, PresetCategory } from "./types";
import { PRESET_CATEGORIES } from "./types";
import { DATATABLE_PRESETS, getPresetsByCategory } from "./dataTablePresets";
import "./DataTablePresetSelector.css";
import { iconProps, iconLarge } from "../../../../utils/ui/uiConstants";
import { ACTION_ICONS } from "../../../config/actionIcons";
import { translateKey, useOptionalI18n } from "../../../../i18n";

/** 여러 화면에 공통으로 나오는 액션의 아이콘 정본 (`config/actionIcons.ts`). */
const AddIcon = ACTION_ICONS.add;

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

interface DataTablePresetSelectorProps {
  /** 모달 열기 트리거 */
  trigger?: React.ReactNode;
  /** Preset 선택 완료 콜백 */
  onSelect: (preset: DataTablePreset, sampleCount: number) => void;
  /** 빈 테이블 생성 콜백 */
  onCreateEmpty: () => void;
  /** 열림 상태 (controlled) */
  isOpen?: boolean;
  /** 열림 상태 변경 콜백 (controlled) */
  onOpenChange?: (isOpen: boolean) => void;
}

// Silence unused variable warning
void DATATABLE_PRESETS;

// ============================================
// Component
// ============================================

export function DataTablePresetSelector({
  trigger,
  onSelect,
  onCreateEmpty,
  isOpen: controlledIsOpen,
  onOpenChange,
}: DataTablePresetSelectorProps) {
  const i18n = useOptionalI18n();
  const localize = (key: string, fallback: string) =>
    i18n ? translateKey(i18n.t, `datatable.${key}`, fallback) : fallback;
  // 내부 상태 (uncontrolled mode)
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen ?? internalIsOpen;
  const setIsOpen = onOpenChange ?? setInternalIsOpen;

  // 선택 상태
  const [mode, setMode] = useState<"empty" | "preset">("preset");
  const [selectedCategory, setSelectedCategory] =
    useState<PresetCategory>("users-auth");
  const [selectedPreset, setSelectedPreset] = useState<DataTablePreset | null>(
    null,
  );
  const [sampleCount, setSampleCount] = useState(10);

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

  // 생성 버튼 핸들러
  const handleCreate = useCallback(() => {
    if (mode === "empty") {
      onCreateEmpty();
    } else if (selectedPreset) {
      onSelect(selectedPreset, sampleCount);
    }
    setIsOpen(false);
    // 상태 초기화
    setMode("preset");
    setSelectedCategory("users-auth");
    setSelectedPreset(null);
    setSampleCount(10);
  }, [mode, selectedPreset, sampleCount, onSelect, onCreateEmpty, setIsOpen]);

  // 아이콘 렌더링 헬퍼
  const renderIcon = (iconName: string, size?: number) => {
    const IconComponent = iconMap[iconName];
    return IconComponent ? (
      <IconComponent size={size} />
    ) : (
      <Database size={size} />
    );
  };

  const renderCategoryIcon = (category: PresetCategory, size?: number) => {
    const IconComponent = categoryIconMap[category];
    return IconComponent ? (
      <IconComponent size={size} />
    ) : (
      <Database size={size} />
    );
  };

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      {trigger || (
        <Button className="react-aria-Button primary">
          <AddIcon {...iconProps} />
          DataTable 추가
        </Button>
      )}

      <ModalOverlay className="react-aria-ModalOverlay">
        <Modal className="react-aria-Modal datatable-preset-modal">
          <Dialog className="react-aria-Dialog">
            {({ close }) => (
              <>
                {/* Header */}
                <div className="preset-modal-header">
                  <Heading slot="title" className="preset-modal-title">
                    <Database size={iconLarge.size} />
                    {localize("addDataTable", "Add DataTable")}
                  </Heading>
                  <Button className="preset-modal-close" onPress={close}>
                    <X size={iconProps.size} />
                  </Button>
                </div>

                {/* Mode Selection */}
                <div className="preset-mode-selection">
                  <label className="preset-mode-option">
                    <input
                      type="radio"
                      name="mode"
                      checked={mode === "empty"}
                      onChange={() => setMode("empty")}
                    />
                    <span className="preset-mode-label">
                      {localize("emptyStart", "Start with an empty table")}
                    </span>
                  </label>
                  <label className="preset-mode-option">
                    <input
                      type="radio"
                      name="mode"
                      checked={mode === "preset"}
                      onChange={() => setMode("preset")}
                    />
                    <span className="preset-mode-label">
                      {localize("preset", "Choose from a preset")}
                    </span>
                  </label>
                </div>

                {/* Preset Selection (visible when mode === "preset") */}
                {mode === "preset" && (
                  <div className="preset-content">
                    {/* Category Tabs */}
                    <div className="preset-category-tabs">
                      {PRESET_CATEGORIES.map((cat) => (
                        <button
                          key={cat.id}
                          className={`preset-category-tab ${
                            selectedCategory === cat.id ? "active" : ""
                          }`}
                          onClick={() => handleCategoryChange(cat.id)}
                          title={cat.description}
                        >
                          {renderCategoryIcon(cat.id, iconProps.size)}
                          <span>{cat.name}</span>
                        </button>
                      ))}
                    </div>

                    {/* Preset Grid */}
                    <div className="list-group" role="list">
                      {presetsInCategory.map((preset) => (
                        <button
                          key={preset.id}
                          role="listitem"
                          className={`list-item preset-card ${
                            selectedPreset?.id === preset.id ? "selected" : ""
                          }`}
                          onClick={() => handlePresetSelect(preset)}
                        >
                          <div className="list-item-icon">
                            {renderIcon(preset.icon, iconLarge.size)}
                          </div>
                          <div className="list-item-name">{preset.name}</div>
                          <div className="list-item-desc">
                            {preset.description}
                          </div>
                          <div className="list-item-meta">
                            {preset.schema.length} fields
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Schema Preview */}
                    {selectedPreset && (
                      <div className="preset-preview">
                        <div className="preset-preview-header">
                          <span className="preset-preview-title">
                            {renderIcon(selectedPreset.icon, iconProps.size)}
                            {selectedPreset.name} Schema
                          </span>
                          <div className="preset-sample-count">
                            <label>
                              {localize("sampleData", "Sample data:")}
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={sampleCount}
                              onChange={(e) =>
                                setSampleCount(
                                  Math.max(
                                    0,
                                    Math.min(
                                      100,
                                      parseInt(e.target.value) || 0,
                                    ),
                                  ),
                                )
                              }
                            />
                            <span>{localize("countUnit", "items")}</span>
                          </div>
                        </div>
                        <div className="preset-preview-schema">
                          {selectedPreset.schema.map((field) => (
                            <div
                              key={field.key}
                              className="preset-schema-field"
                            >
                              <span className="schema-field-name">
                                {field.key}
                                {field.required && (
                                  <span className="schema-field-required">
                                    *
                                  </span>
                                )}
                              </span>
                              <span className="schema-field-type">
                                {field.type}
                              </span>
                              <span className="schema-field-label">
                                {field.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="preset-modal-footer">
                  <Button
                    className="react-aria-Button secondary"
                    onPress={close}
                  >
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
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}

export default DataTablePresetSelector;

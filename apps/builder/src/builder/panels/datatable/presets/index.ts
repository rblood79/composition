/**
 * DataTable Preset System
 *
 * DataTable 추가 시 Preset을 선택할 수 있는 기능 제공 — UI 는 editors/DataTableCreator
 * (옛 모달 선택기 DataTablePresetSelector 는 소비처 0 으로 2026-09-16 삭제)
 *
 * @see presets/dataTablePresets.ts (카탈로그) · @composition/sample-data (생성기, ADR-220) — DATATABLE_PRESET_SYSTEM.md 는 없다 (stale 참조 정리 2026-09-16)
 */

// Types
export type {
  PresetCategory,
  PresetCategoryMeta,
  PresetColumn,
  PresetField,
  PresetGenerateOptions,
  PresetSample,
  PresetTranslate,
  DataTablePreset,
} from "./types";
export { PRESET_CATEGORIES, definePreset, resolvePresetSchema } from "./types";

// Preset Definitions
export {
  DATATABLE_PRESETS,
  getPresetsByCategory,
  getAllPresets,
} from "./dataTablePresets";

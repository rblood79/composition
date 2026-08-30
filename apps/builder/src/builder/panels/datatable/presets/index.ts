/**
 * DataTable Preset System
 *
 * DataTable 추가 시 Preset을 선택할 수 있는 기능 제공
 * Layout Preset 패턴과 동일한 UX
 *
 * @see docs/features/DATATABLE_PRESET_SYSTEM.md
 */

// Types
export type {
  PresetCategory,
  PresetCategoryMeta,
  DataTablePreset,
} from "./types";
export { PRESET_CATEGORIES } from "./types";

// Preset Definitions
export {
  DATATABLE_PRESETS,
  getPresetsByCategory,
  getAllPresets,
} from "./dataTablePresets";

// UI Components
export { DataTablePresetSelector } from "./DataTablePresetSelector";

/**
 * Builder Components
 *
 * 통합된 공통 컴포넌트 모음
 *
 * @since 2025-12-26 Part 1 통합
 */

// Property 컴포넌트
export {
  PropertyFieldset,
  PropertySection,
  PropertyInput,
  PropertyFieldTemplateInput,
  PropertyNumberInput,
  PropertyCheckbox,
  PropertySelect,
  PropertySwitch,
  PropertySlider,
  PropertyUnitInput,
  BORDER_RADIUS_PRESET_OPTIONS,
  BORDER_WIDTH_PRESET_OPTIONS,
  PAGE_GAP_PRESETS,
  SPACING_PRESET_OPTIONS,
  type PropertyUnitPreset,
  PropertyColor,
  PropertyColorPicker,
  PropertyCustomId,
  PropertyDataBinding,
  type DataBindingValue,
  PropertyListItem,
  PropertySizeToggle,
  PropertyIconPicker,
} from "./property";

// Panel 컴포넌트
export {
  PanelContents,
  panelContents,
  PanelHeader,
  Section,
  SectionGroupToggleButton,
  SectionSplitStack,
} from "./panel";
export type {
  PanelContentsProps,
  SectionProps,
  SectionGroupToggleButtonProps,
  SectionSplitStackProps,
} from "./panel";

// Selection 컴포넌트
export {
  MultiSelectStatusIndicator,
  BatchPropertyEditor,
  SelectionFilter,
  SelectionMemory,
  SmartSelection,
} from "./selection";

// Feedback 컴포넌트
export {
  EmptyState,
  LoadingSpinner,
  Toast,
  ToastContainer,
  ScopedErrorBoundary,
} from "./feedback";

// Dialog 컴포넌트
export { AddPageDialog } from "./dialog";

// Data 컴포넌트
export { DataTable, DataTableMetadata } from "./data";

// Help 컴포넌트

// Overlay 컴포넌트
export {
  ShortcutTooltip,
  type ShortcutTooltipProps,
  CommandPalette,
  type CommandPaletteProps,
  AgentCommandConfirmDialogHost,
  EditingSemanticsImpactDialogHost,
  ContextMenuProvider,
  useContextMenu,
  type ContextMenuProviderProps,
} from "./overlay";

// UI 컴포넌트
export { ActionIconButton, type ActionIconButtonProps } from "./ui";

// Styles
import "./styles";

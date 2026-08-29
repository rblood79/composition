/**
 * Panels Module
 *
 * 패널 시스템의 진입점
 * - Panel configurations
 * - Panel registry
 * - Panel components
 * - Panel hooks
 */

// Core
export * from "./core/types";
export { PanelRegistry } from "./core/PanelRegistry";
export { PANEL_CONFIGS, registerAllPanels } from "./core/panelConfigs";

// Panel components
// Navigation panels
export { NavigatorPanel } from "./navigator/NavigatorPanel";
export { ComponentsPanel } from "./components/ComponentsPanel";

// Tool panels
export { ThemesPanel } from "./themes/ThemesPanel";
export { AIPanel } from "./ai/AIPanel";

// System panels
export { SettingsPanel } from "./settings/SettingsPanel";

// Editor panels
export { PropertiesPanel } from "./properties/PropertiesPanel";
export { StylesPanel } from "./styles/StylesPanel";
export { InteractionsPanel } from "./interactions/InteractionsPanel";
export { HistoryPanel } from "./history/HistoryPanel";

// Side effect: Register all panels when this module is imported
import "./core/panelConfigs";

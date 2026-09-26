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
export { AIPanel } from "./ai/lazyAIPanel";

// System panels

// Editor panels
export { PropertiesPanel } from "./properties/PropertiesPanel";
export { StylesPanel } from "./styles/StylesPanel";
// ADR-242 — history · settings · interactions · themes 는 lazy (panelConfigs 의 loader 만)

// Side effect: Register all panels when this module is imported
import "./core/panelConfigs";

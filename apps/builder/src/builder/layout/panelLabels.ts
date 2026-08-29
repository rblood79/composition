import type { PanelConfig, PanelId } from "../panels/core/types";

export const PANEL_TRANSLATION_KEYS: Partial<Record<PanelId, string>> = {
  nodes: "panels.navigator",
  components: "panels.components",
  datatable: "panels.dataTable",
  datatableEditor: "panels.dataTableEditor",
  theme: "panels.theme",
  settings: "panels.settings",
  ai: "panels.ai",
  properties: "panels.properties",
  styles: "panels.styles",
  events: "panels.interactions",
  history: "panels.history",
  monitor: "panels.monitor",
};

export function getPanelLabel(
  config: PanelConfig,
  t: (key: string) => string,
): string {
  const key = PANEL_TRANSLATION_KEYS[config.id];
  return key ? t(key) : config.name;
}

import type { PanelConfig, PanelId } from "../panels/core/types";

export const PANEL_TRANSLATION_KEYS: Partial<Record<PanelId, string>> = {
  navigator: "panels.navigator",
  components: "panels.components",
  datatable: "panels.dataTable",
  theme: "panels.theme",
  settings: "panels.settings",
  site: "panels.site",
  ai: "panels.ai",
  properties: "panels.properties",
  events: "panels.interactions",
  history: "panels.history",
  codeView: "panels.codeView",
};

export function getPanelLabel(
  config: PanelConfig,
  t: (key: string) => string,
): string {
  const key = PANEL_TRANSLATION_KEYS[config.id];
  return key ? t(key) : config.name;
}

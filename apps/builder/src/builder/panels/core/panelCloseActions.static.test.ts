import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const STANDARD_PANEL_SOURCES = [
  {
    component: "NavigatorPanel",
    source: "../navigator/NavigatorPanel.tsx",
  },
  { component: "ComponentsPanel", source: "../components/ComponentList.tsx" },
  { component: "DataTablePanel", source: "../datatable/DataTablePanel.tsx" },
  {
    component: "DataTableEditorPanel",
    source: "../datatable/DataTableEditorPanel.tsx",
  },
  { component: "ThemesPanel", source: "../themes/ThemesPanel.tsx" },
  { component: "SettingsPanel", source: "../settings/SettingsPanel.tsx" },
  { component: "AIPanel", source: "../ai/AIPanel.tsx" },
  { component: "PropertiesPanel", source: "../properties/PropertiesPanel.tsx" },
  { component: "StylesPanel", source: "../styles/StylesPanel.tsx" },
  {
    component: "InteractionsPanel",
    source: "../interactions/InteractionsPanel.tsx",
  },
  { component: "HistoryPanel", source: "../history/HistoryPanel.tsx" },
  { component: "MonitorPanel", source: "../monitor/MonitorPanel.tsx" },
] as const;

function panelHeaderBlocks(source: string): string[] {
  return source.match(/^(\s*)<PanelHeader\b[\s\S]*?^\1\/>/gm) ?? [];
}

describe("registered panel close action coverage", () => {
  it("등록된 12개 패널을 전부 인벤토리한다", async () => {
    const configs = await readFile(
      resolve(__dirname, "panelConfigs.ts"),
      "utf-8",
    );
    const registeredComponents = configs.match(/^\s*component:\s*\w+,/gm) ?? [];

    expect(registeredComponents).toHaveLength(12);
    expect(configs).toContain("component: NavigatorPanel");
    for (const { component } of STANDARD_PANEL_SOURCES) {
      expect(configs).toContain(`component: ${component}`);
    }
  });

  it.each(STANDARD_PANEL_SOURCES)(
    "$component의 모든 PanelHeader가 공통 close 계약에 참여한다",
    async ({ source: file }) => {
      const source = await readFile(resolve(__dirname, file), "utf-8");
      const headers = panelHeaderBlocks(source);

      expect(headers.length).toBeGreaterThan(0);
      for (const header of headers) {
        expect(header).toMatch(/(?:panelId|onClose)=/);
      }
    },
  );
});

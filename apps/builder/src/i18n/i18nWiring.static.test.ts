import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readBuilderFile = (relativePath: string): string =>
  readFileSync(resolve(__dirname, "..", relativePath), "utf8");

describe("i18n Builder wiring", () => {
  it("mounts I18nProvider at the application root", () => {
    const source = readBuilderFile("main.tsx");

    expect(source).toContain('import { I18nProvider } from "./i18n";');
    expect(source).toContain("<I18nProvider>");
    expect(source).toContain("</I18nProvider>");
  });

  it("keeps language selection and primary chrome on the translation path", () => {
    const settings = readBuilderFile(
      "builder/panels/settings/SettingsPanel.tsx",
    );
    const header = readBuilderFile("builder/main/BuilderHeader.tsx");
    const panelNav = readBuilderFile("builder/layout/PanelNav.tsx");
    const panelWorkspace = readBuilderFile("builder/layout/PanelWorkspace.tsx");
    const zoom = readBuilderFile("builder/workspace/ZoomControls.tsx");
    const nodesTabs = readBuilderFile(
      "builder/panels/nodes/NodesPanelTabs.tsx",
    );
    const frames = readBuilderFile(
      "builder/panels/nodes/FramesTab/FrameList.tsx",
    );
    const stylesTabs = readBuilderFile(
      "builder/panels/styles/components/StylesPanelTabs.tsx",
    );
    const switcher = readBuilderFile("i18n/LanguageSwitcher.tsx");
    const propertyFieldset = readBuilderFile(
      "builder/components/property/PropertyFieldset.tsx",
    );
    const dataTable = readBuilderFile(
      "builder/panels/datatable/DataTablePanel.tsx",
    );
    const debuggerSource = readBuilderFile(
      "builder/devtools/ShortcutDebugger.tsx",
    );

    expect(settings).toContain('import { LanguageSwitcher } from "@/i18n";');
    expect(settings).toContain("<LanguageSwitcher />");
    expect(settings).toContain('t("settings.title")');
    expect(header).toContain('import { useI18n } from "../../i18n";');
    expect(header).toContain('t("header.publish")');
    expect(header).toContain('t("header.logo")');
    expect(header).toContain('t("header.emptyHistory")');
    expect(panelNav).toContain(
      'import { getPanelLabel } from "./panelLabels";',
    );
    expect(panelWorkspace).toContain('t("workspace.workArea")');
    expect(panelWorkspace).toContain('t("workspace.movePanel",');
    expect(zoom).toContain('t("zoom.level")');
    expect(zoom).toContain('t("zoom.align")');
    expect(nodesTabs).toContain('t("nodes.pages")');
    expect(frames).toContain('t("nodes.frames")');
    expect(frames).toContain('t("nodes.addFrame")');
    expect(stylesTabs).toContain('t("styles.layout")');
    expect(switcher).toContain('t("settings.language")');
    expect(propertyFieldset).toContain("translateDisplayLabel");
    expect(dataTable).toContain("datatable.${key}");
    expect(debuggerSource).toContain("debugger.${key}");
  });
});

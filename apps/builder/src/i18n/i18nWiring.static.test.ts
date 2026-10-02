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

  it("uses React Aria's localized string formatter inside the provider", () => {
    const provider = readBuilderFile("i18n/I18nProvider.tsx");

    expect(provider).toContain("useLocalizedStringFormatter,");
    expect(provider).toContain('from "@react-aria/i18n"');
    expect(provider).toContain("useLocalizedStringFormatter(localizedStrings)");
    expect(provider).not.toContain("getTranslation(locale, key)");
    expect(provider).not.toContain("replacePlaceholders");
    expect(provider).not.toContain("labels.");
  });

  it("keeps language selection and primary chrome on the translation path", () => {
    const settings = readBuilderFile(
      "builder/panels/settings/SettingsPanel.tsx",
    );
    const header = readBuilderFile("builder/main/BuilderHeader.tsx");
    const panelToggleGroup = readBuilderFile(
      "builder/layout/PanelToggleGroup.tsx",
    );
    const panelWorkspace = readBuilderFile("builder/layout/PanelWorkspace.tsx");
    const zoom = readBuilderFile("builder/workspace/ZoomControls.tsx");
    // ADR-248 4e: the catalog Navigator (tabs in the panel, the layouts list in the definitions section).
    const navigatorTabs = readBuilderFile(
      "builder/panels/navigator/catalog/CatalogNavigatorPanel.tsx",
    );
    const frames = readBuilderFile(
      "builder/panels/navigator/catalog/CatalogDefinitionsSection.tsx",
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

    expect(settings).toContain('import { LanguageSwitcher } from "@/i18n";');
    expect(settings).toContain("<LanguageSwitcher />");
    expect(settings).toContain('t("settings.title")');
    expect(header).toContain('import { useI18n } from "../../i18n";');
    // ADR-249 — 전체 메뉴 항목 라벨은 헤더 액션 표가 키로 싣고 lazy 본문이 t() 로 푼다
    const headerMenuActions = readBuilderFile(
      "builder/main/headerMenu/headerMenuActions.ts",
    );
    expect(headerMenuActions).toContain('labelKey: "header.importProject"');
    expect(headerMenuActions).toContain('labelKey: "header.exportProject"');
    expect(
      readBuilderFile("builder/main/headerMenu/HeaderMainMenu.tsx"),
    ).toContain("useI18n()");
    expect(header).not.toContain('t("header.publish")');
    expect(header).toContain('t("header.logo")');
    expect(panelToggleGroup).toContain(
      'import { getPanelLabel } from "./panelLabels";',
    );
    expect(panelWorkspace).toContain('t("workspace.workArea")');
    expect(panelWorkspace).toContain('t("workspace.movePanel",');
    expect(zoom).toContain('t("zoom.level")');
    expect(zoom).toContain('t("zoom.align")');
    expect(navigatorTabs).toContain('t("navigator.pages")');
    expect(frames).toContain('t("navigator.layouts")');
    expect(frames).toContain('t("navigator.addLayout")');
    expect(stylesTabs).toContain('t("styles.layout")');
    expect(switcher).toContain('t("settings.language")');
    expect(propertyFieldset).toContain("semanticLabelKeys");
    expect(dataTable).toContain("datatable.${key}");
  });
});

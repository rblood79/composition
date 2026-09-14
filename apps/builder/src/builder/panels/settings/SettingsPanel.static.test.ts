import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("SettingsPanel 공통 panel 구조", () => {
  it("workspace frame 폭을 채우는 공통 panel root를 사용한다", async () => {
    const source = await readFile(
      resolve(__dirname, "SettingsPanel.tsx"),
      "utf-8",
    );

    expect(source).toContain('className="panel settings-panel"');
    expect(source).not.toContain('className="settings-panel"');
  });

  it("offers Auto, Horizontal, and Vertical page layout choices", async () => {
    const source = await readFile(
      resolve(__dirname, "SettingsPanel.tsx"),
      "utf-8",
    );
    expect(source).toContain('id: "auto"');
    expect(source).toContain('t("settings.pageLayoutAuto")');
    expect(source).toContain("PropertySizeToggle");
    expect(source).toContain('className="settings-page-layout-toggle"');
    expect(source).toContain('className="settings-theme-mode-toggle"');
    expect(source).toContain('className="settings-ui-scale-toggle"');
    expect(source).toContain('t("settings.themeModeAuto")');
    expect(source).toContain('id: "light"');
    expect(source).toContain('id: "dark"');
    expect(source).toContain('id: "auto"');
    expect(source).toContain('{ id: "80", label: "S" }');
    expect(source).toContain('{ id: "100", label: "M" }');
    expect(source).toContain('{ id: "120", label: "L" }');
    expect(source).not.toContain("getThemeModeIcon");
    expect(source).not.toContain("PropertySelect");
    expect(source).toContain("PropertyUnitInput");
    expect(source).toContain('t("settings.pageGap")');
    // 「80 PX」 — 단위 suffix + stepper, preset · 아이콘 없음 (panel-ui 20 — 대조 B11)
    expect(source).toContain("value={`${pageGap}px`}");
    expect(source).toContain('units={["px"]}');
    expect(source).toContain("unitSuffix");
    expect(source).toContain("allowKeywords={false}");
    expect(source).not.toContain("PAGE_GAP_PRESETS");
    expect(source).not.toContain("icon={UnfoldHorizontal}");
    expect(source).toContain("onChange={handlePageLayoutChange}");
    expect(source).toContain("onChange={handlePageGapChange}");
    expect(source).toContain("alignPagesToScreen();");
    expect(source).not.toContain('value: "zigzag"');
    expect(source).not.toContain("pageLayoutZigzag");
  });
});

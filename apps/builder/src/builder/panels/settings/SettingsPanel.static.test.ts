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

    expect(source).toContain('value: "auto"');
    expect(source).toContain('t("settings.pageLayoutAuto")');
    expect(source).toContain("PropertySizeToggle");
    expect(source).toContain('className="settings-page-layout-toggle"');
    expect(source).toContain("PropertyUnitInput");
    expect(source).toContain('t("settings.pageGap")');
    expect(source).toContain("value={String(pageGap)}");
    expect(source).toContain("units={[]}");
    expect(source).toContain("allowKeywords={false}");
    expect(source).toContain("presets={PAGE_GAP_PRESETS}");
    expect(source).toContain("icon={UnfoldHorizontal}");
    expect(source).toContain('{ id: "sm", label: "S", value: "40" }');
    expect(source).toContain('{ id: "md", label: "M", value: "80" }');
    expect(source).toContain('{ id: "lg", label: "L", value: "120" }');
    expect(source).toContain("onChange={handlePageLayoutChange}");
    expect(source).toContain("onChange={handlePageGapChange}");
    expect(source).toContain("alignPagesToScreen();");
    expect(source).not.toContain('value: "zigzag"');
    expect(source).not.toContain("pageLayoutZigzag");
  });
});

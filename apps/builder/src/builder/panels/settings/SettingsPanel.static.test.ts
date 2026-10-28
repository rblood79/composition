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

  it("Builder 환경 선택지 — 테마 모드 · 배율 (페이지 레이아웃은 Site 패널)", async () => {
    const source = await readFile(
      resolve(__dirname, "SettingsPanel.tsx"),
      "utf-8",
    );
    expect(source).toContain("PropertySizeToggle");
    expect(source).toContain('className="settings-theme-mode-toggle"');
    expect(source).toContain('className="settings-ui-scale-toggle"');
    expect(source).toContain('t("settings.themeModeAuto")');
    expect(source).toContain('{ id: "80", label: "S" }');
    expect(source).toContain('{ id: "100", label: "M" }');
    expect(source).toContain('{ id: "120", label: "L" }');
    expect(source).not.toContain("getThemeModeIcon");
    expect(source).not.toContain("PropertySelect");
    expect(source).not.toContain("useCatalogPageLayout");
    expect(source).not.toContain("useCatalogToastPlacement");
  });
});

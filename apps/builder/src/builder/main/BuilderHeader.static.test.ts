import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("BuilderHeader chrome control groups", () => {
  it("semantic header와 공통 control group class를 사용한다", async () => {
    const source = await readFile(
      resolve(__dirname, "BuilderHeader.tsx"),
      "utf-8",
    );

    expect(source).toContain('<header className="header">');
    expect(source).not.toContain('<nav className="header">');
    expect(source.match(/className="builder-control-group"/g)).toHaveLength(2);
    expect(source).toContain(
      '<Group\n        className="header_contents screen builder-viewport-controls"',
    );
    expect(source).toContain('aria-label={t("header.viewportControls")}');
    expect(source).toContain('aria-label={t("header.viewportSize")}');
    expect(source).toContain(
      'className="react-aria-Button header-menu-button"',
    );
    expect(source).toContain("<ActionIconButton");
    expect(source).toContain("workspaceLayout?.visibility.monitor === true");
  });

  it("상단 Publish를 제거하고 전체 메뉴에서 프로젝트 JSON import/export를 연결한다", async () => {
    const source = await readFile(
      resolve(__dirname, "BuilderHeader.tsx"),
      "utf-8",
    );

    expect(source).not.toContain("onPublish");
    expect(source).not.toContain('className="publish"');
    expect(source).toContain('if (key === "import")');
    expect(source).toContain('if (key === "export") void onExportProject()');
    expect(source).toContain('accept="application/json,.json"');
    expect(source).toContain("void onImportProject(file)");
  });

  it("header shell은 transparent이고 group surface는 공통 stylesheet가 소유한다", async () => {
    const [headerStyles, groupStyles] = await Promise.all([
      readFile(resolve(__dirname, "../styles/layout/header.css"), "utf-8"),
      readFile(
        resolve(__dirname, "../styles/modules/builder-control-group.css"),
        "utf-8",
      ),
    ]);

    expect(headerStyles).toMatch(
      /\.app \.header\s*\{[\s\S]*?background: transparent;[\s\S]*?border-bottom: 0;/,
    );
    expect(groupStyles).toContain(
      ".builder-control-group.react-aria-ToggleButtonGroup",
    );
    expect(groupStyles).toContain(
      '.react-aria-ToggleButtonGroup[data-orientation="vertical"]',
    );
    expect(groupStyles).toMatch(
      /\.builder-control-group\.react-aria-ToggleButtonGroup\s*\{[\s\S]*?--button-color: var\(--bg-raised\);[\s\S]*?background: var\(--button-color\);/,
    );
    expect(groupStyles).toMatch(
      /\.react-aria-ToggleButton\s*\{[\s\S]*?padding: var\(--spacing-sm\);/,
    );
    expect(groupStyles).toMatch(
      /\.react-aria-ToggleButton\[data-selected\]\s*\{[\s\S]*?--button-text: var\(--fg-on-accent\);[\s\S]*?color: var\(--button-text\);/,
    );
    expect(groupStyles).toMatch(
      /\.react-aria-SelectionIndicator\s*\{[\s\S]*?--button-color: var\(--accent\);[\s\S]*?background: var\(--button-color\);/,
    );
    expect(groupStyles).toMatch(
      /\.builder-viewport-controls\s*\{[\s\S]*?background: var\(--bg-raised\);/,
    );
    expect(groupStyles).toMatch(
      /\.builder-viewport-controls[\s\S]*?> \.builder-control-group\.react-aria-ToggleButtonGroup\s*\{[\s\S]*?--button-color: transparent;[\s\S]*?padding: 0;[\s\S]*?box-shadow: none;/,
    );
    expect(headerStyles).toMatch(
      /\.zoom-trigger-button\s*\{[\s\S]*?background: var\(--bg-muted\);[\s\S]*?box-shadow: none;[\s\S]*?border-radius: var\(--radius-md\);/,
    );
    expect(headerStyles).toMatch(
      /\.react-aria-Button\.header-menu-button\s*\{[\s\S]*?border: none;[\s\S]*?background: var\(--bg-muted\);[\s\S]*?padding: var\(--spacing-sm\);[\s\S]*?border-radius: 6px;/,
    );
    expect(headerStyles).not.toContain('[aria-label="menu"]');
    expect(headerStyles).not.toContain(".header_contents .publish");
  });
});

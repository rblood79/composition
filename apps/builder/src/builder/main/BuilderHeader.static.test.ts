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
      '<Group\n          className="builder-action-group"',
    );
    expect(source).not.toContain('<div className="builder-action-group">');
    expect(source).toContain(
      '<Group\n        className="header_contents screen builder-viewport-controls"',
    );
    expect(source).toContain('aria-label={t("header.viewportControls")}');
    expect(source).toContain('aria-label={t("header.viewportSize")}');
    expect(source).toContain(
      'className="react-aria-Button header-menu-button"',
    );
    expect(source).toContain("<ActionIconButton");
    expect(source).not.toContain("workspaceLayout");
  });

  it("상단 Publish를 제거하고 전체 메뉴 host 로 프로젝트 가져오기/내보내기를 연결한다", async () => {
    const source = await readFile(
      resolve(__dirname, "BuilderHeader.tsx"),
      "utf-8",
    );

    expect(source).not.toContain("onPublish");
    expect(source).not.toContain('className="publish"');
    expect(source).toContain(
      "onImportProject: () => importInputRef.current?.click()",
    );
    expect(source).toContain("onExportProject: () => void onExportProject()");
    // ADR-235 Phase 4 — v1 JSON + v2 zip 가져오기, v1 JSON 내보내기는 별도 항목
    expect(source).toContain(
      'accept="application/json,.json,application/zip,.zip"',
    );
    expect(source).toContain(
      "onExportProjectJson: () => void onExportProjectJson()",
    );
    expect(source).toContain("void onImportProject(file)");
  });

  // ADR-249 — 항목 · 순서는 구조 표 (`headerMenu/builderMenuStructure.ts`) 가 정본이고
  // "모든 항목이 실행 경로를 갖는다" 는 G0 (`builderMenuStructure.static.test.ts`) 가
  // 잠근다. 헤더는 트리거와 lazy 본문만 갖는다 — 손으로 쓴 항목 · 분기 짝이
  // 어긋난 것이 2026-09-29 `96ab2cee1` (삭제 · 도움말 · 정보) 결함이었다.
  it("전체 메뉴 본문은 lazy chunk 이고 헤더는 항목을 직접 쓰지 않는다", async () => {
    const source = await readFile(
      resolve(__dirname, "BuilderHeader.tsx"),
      "utf-8",
    );

    expect(source).toContain('import("./headerMenu/HeaderMainMenu")');
    expect(source).toContain("lazy(loadHeaderMainMenu)");
    expect(source).toContain("onHoverStart={preloadHeaderMainMenu}");
    expect(source).not.toContain("<MenuItem");
    expect(source).not.toContain("onAction=");
    // COMMAND_META 초기 번들 상주 금지 (ADR-196 HC6)
    // 정적 import 는 타입 (host) 과 runtime (initial 전용 모듈 묶음) 뿐
    expect(
      [...source.matchAll(/from "\.\/headerMenu\/([^"]+)"/g)].map((m) => m[1]),
    ).toEqual(["headerMenuActions", "headerMenuRuntime"]);
    expect(source).not.toContain("commandMeta");
    expect(source).not.toContain('<ToggleButton id="workflow"');
  });

  it("프로젝트 삭제는 확인 후 대시보드로 나가 빌더 언마운트 뒤에 지운다", async () => {
    const source = await readFile(
      resolve(__dirname, "BuilderHeader.tsx"),
      "utf-8",
    );

    expect(source).toContain("<ConfirmDialog");
    expect(source).toContain("onDeleteProject: () => setIsDeleteConfirmOpen(true)");
    expect(source).toContain("buildPendingProjectDeleteState(projectId)");
    // 빌더 안에서 DB 를 직접 지우지 않는다 — fire-and-forget persist 가 되살린다
    expect(source).not.toContain("getDB");
  });

  it("Compare의 current-page filter는 Compare 중에만 보이는 독립 옵션이다", async () => {
    const source = await readFile(
      resolve(__dirname, "BuilderHeader.tsx"),
      "utf-8",
    );

    expect(source).toContain("isCompareMode && filterCurrentPage");
    expect(source).toContain('id="current-page"');
    expect(source).toContain('t("header.compareCurrentPageOnly")');
    expect(source).toContain(
      'setCurrentPageFilter(selectedKeys.has("current-page"))',
    );
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
      /\.builder-control-group\.react-aria-ToggleButtonGroup\s*\{[\s\S]*?--button-color: var\(--chrome-surface\);[\s\S]*?background: var\(--button-color\);/,
    );
    // indicator ToggleButton 의 크기·padding 은 `builder-control-size.css` 의 lg 티어가
    // 소유한다 — 같은 선택자를 두 파일이 쓰면 import 순서가 판정하므로 여기엔 없어야 한다
    // (게이트: styles/controlSize.static.test.ts).
    expect(groupStyles).not.toMatch(
      /\.react-aria-ToggleButton\s*\{[\s\S]*?padding: var\(--spacing-sm\);/,
    );
    expect(groupStyles).toMatch(
      /\.react-aria-ToggleButton\[data-selected\]\s*\{[\s\S]*?color: var\(--focus-ring\);/,
    );
    expect(groupStyles).toMatch(
      /\.react-aria-SelectionIndicator\s*\{[\s\S]*?--button-color: var\(--accent\);[\s\S]*?background: var\(--button-color\);/,
    );
    // chrome island 3종은 표면/여백/그림자를 직접 쓰지 않고 정본 토큰만 읽는다.
    expect(groupStyles).toMatch(
      /\.builder-action-group,\s*\.builder-viewport-controls\s*\{[\s\S]*?background: var\(--chrome-surface\);/,
    );
    expect(groupStyles).toMatch(
      /\.builder-viewport-controls\s*\{[\s\S]*?padding: var\(--chrome-padding\);[\s\S]*?border: var\(--chrome-border\);[\s\S]*?border-radius: var\(--chrome-radius\);[\s\S]*?box-shadow: var\(--chrome-shadow\);/,
    );
    expect(groupStyles).toMatch(
      /\.builder-viewport-controls[\s\S]*?> \.builder-control-group\.react-aria-ToggleButtonGroup[\s\S]*?\.builder-action-group\s*> \.builder-control-group\.react-aria-ToggleButtonGroup\s*\{[\s\S]*?--button-color: transparent;[\s\S]*?padding: 0;[\s\S]*?box-shadow: none;/,
    );
    expect(headerStyles).toMatch(
      /\.zoom-trigger-button\s*\{[\s\S]*?background: var\(--bg-muted\);[\s\S]*?box-shadow: none;[\s\S]*?border-radius: var\(--radius-md\);/,
    );
    expect(headerStyles).toMatch(
      /\.react-aria-Button\.header-menu-button\s*\{[\s\S]*?border: none;[\s\S]*?background: var\(--bg-muted\);[\s\S]*?padding: var\(--spacing-sm\);[\s\S]*?border-radius: 6px;/,
    );
    expect(headerStyles).not.toContain('[aria-label="menu"]');
    expect(headerStyles).not.toContain(".header_contents .publish");
    expect(headerStyles).not.toContain(".header-menu-item[data-selected]");
  });
});

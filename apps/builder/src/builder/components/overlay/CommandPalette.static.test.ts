import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("CommandPalette panel shell contract", () => {
  const readSource = () =>
    readFile(resolve(__dirname, "CommandPalette.tsx"), "utf8");
  const readStyles = () =>
    readFile(resolve(__dirname, "CommandPalette.css"), "utf8");
  const readCanvasStyles = () =>
    readFile(resolve(__dirname, "../../styles/layout/canvas.css"), "utf8");

  it("React Aria overlay 동작을 유지한 채 공통 panel DOM을 사용한다", async () => {
    const source = await readSource();

    expect(source).toContain("<ModalOverlay");
    expect(source).toContain('<Modal className="command-palette-modal">');
    expect(source).toMatch(
      /<Dialog\s+aria-label="명령어 팔레트"\s+className="panel command-palette-panel"\s*>/,
    );
    expect(source).toMatch(
      /<PanelHeader\s+icon=\{<Command size=\{iconProps\.size\} \/>\}\s+title="명령어"/,
    );
    // 헤더 우측 close 는 다른 패널과 같은 PanelHeader actions(.panel-actions) 경로
    expect(source).toMatch(
      /actions=\{\s*<ActionIconButton\s+onPress=\{\(\) => handleOpenChange\(false\)\}/,
    );
    expect(source).toContain(
      'className="panel-contents command-palette-contents"',
    );
    expect(source).toContain(
      'import { SearchField as BuilderSearchField } from "../ui/SearchField";',
    );
    expect(source).toMatch(
      /<BuilderSearchField\s+ref=\{inputRef\}\s+appearance="control"[\s\S]*?aria-label="명령어 검색"\s*\/>/,
    );
    expect(source).not.toContain('<div className="command-palette-search">');
    expect(source).not.toContain('className="command-palette-input"');
    expect(source).toContain("<ListBox");
    expect(source).toContain("<ListBoxItem");
    expect(source).toContain("onAction={(key) => executeCommand");
  });

  it("panel shell과 modal 표면은 공통 token을 사용한다", async () => {
    const [styles, canvasStyles] = await Promise.all([
      readStyles(),
      readCanvasStyles(),
    ]);

    expect(styles).toContain("border-radius: var(--radius-lg)");
    expect(styles).toContain("box-shadow: var(--shadow-lg)");
    expect(styles).not.toContain("border-radius: 12px");
    expect(styles).not.toContain("0 16px 48px rgba");
    expect(styles).toMatch(
      /\.command-palette-contents\s*>\s*\.builder-search-field--control\s*\{[\s\S]*?padding: var\(--spacing-sm\);/,
    );
    expect(canvasStyles).toContain(".command-palette-modal .panel-header");
  });
});

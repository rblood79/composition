import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

async function readHistorySource(file: string): Promise<string> {
  return readFile(resolve(__dirname, file), "utf-8");
}

describe("HistoryPanel panel-system contract", () => {
  it("uses the shared panel sections with Photoshop history grouping", async () => {
    const source = await readHistorySource("HistoryPanel.tsx");

    expect(source).toContain('title="작업 내역"');
    expect(source).toContain('title="스냅샷"');
    expect(source).toContain("collapsible={false}");
    expect(source).toContain('id="history-edits"');
    expect(source).toContain('title="편집"');
    expect(source).not.toContain('className="history-snapshot-header"');
  });

  it("keeps destructive history clearing behind an explicit more menu", async () => {
    const source = await readHistorySource("HistoryPanel.tsx");

    expect(source).toMatch(/<MenuItem\s+id="clear-history"/);
    expect(source).toContain("현재 페이지 기록 초기화");
    expect(source).not.toContain('aria-label="Clear history"');
  });

  it("places undo and redo before snapshot actions in the panel header", async () => {
    const source = await readHistorySource("HistoryPanel.tsx");
    const actionsIndex = source.indexOf('<Toolbar className="history-actions"');
    const undoIndex = source.indexOf('aria-label="실행 취소"', actionsIndex);
    const redoIndex = source.indexOf('aria-label="다시 실행"', actionsIndex);
    const snapshotIndex = source.indexOf(
      'aria-label="스냅샷 생성"',
      actionsIndex,
    );

    expect(actionsIndex).toBeGreaterThan(-1);
    expect(undoIndex).toBeGreaterThan(actionsIndex);
    expect(redoIndex).toBeGreaterThan(undoIndex);
    expect(snapshotIndex).toBeGreaterThan(redoIndex);
    expect(source).toContain('shortcutId="undo"');
    expect(source).toContain('shortcutId="redo"');
    expect(source).toContain("await useStore.getState().undo()");
    expect(source).toContain("await useStore.getState().redo()");
  });

  it("uses token-based flat rows and accent selection", async () => {
    const css = await readHistorySource("HistoryPanel.css");
    const sectionContentRuleStart = css.indexOf(
      ".history-panel .history-section > .section-content",
    );
    const sectionContentRuleEnd = css.indexOf("}", sectionContentRuleStart);
    const sectionContentRule = css.slice(
      sectionContentRuleStart,
      sectionContentRuleEnd,
    );
    const historyButtonRuleStart = css.indexOf(".history-item-btn {");
    const historyButtonRuleEnd = css.indexOf("}", historyButtonRuleStart);
    const historyButtonRule = css.slice(
      historyButtonRuleStart,
      historyButtonRuleEnd,
    );
    const activeHistoryButtonRuleStart = css.indexOf(
      '.history-panel .history-item-btn[aria-current="step"]',
    );
    const activeHistoryButtonRuleEnd = css.indexOf(
      "}",
      activeHistoryButtonRuleStart,
    );
    const activeHistoryButtonRule = css.slice(
      activeHistoryButtonRuleStart,
      activeHistoryButtonRuleEnd,
    );

    expect(css).toContain(".history-panel .history-section > .section-content");
    expect(sectionContentRule).not.toContain("padding:");
    expect(sectionContentRule).not.toContain("gap:");
    expect(css).not.toContain("border-bottom: 1px solid var(--border)");
    expect(css).toContain("border: 0");
    expect(historyButtonRule).toContain(
      "height: var(--control-size)",
    );
    expect(historyButtonRule).toContain(
      "padding: var(--spacing-xs) var(--spacing-sm)",
    );
    expect(historyButtonRule).not.toContain("min-height: var(--control-size-lg)");
    expect(activeHistoryButtonRule).toContain(
      "--button-color: var(--bg-muted)",
    );
    expect(activeHistoryButtonRule).toContain(
      "border-radius: var(--radius-md)",
    );
    expect(activeHistoryButtonRule).toContain(
      "box-shadow: var(--inset-shadow-sm)",
    );
    expect(css).toContain("min-width: 0");
    expect(css).not.toContain("transition: all");
  });

  it("marks the current edit on the interactive history button", async () => {
    const source = await readHistorySource("HistoryPanel.tsx");

    expect(source).toContain('aria-current={isActive ? "step" : undefined}');
  });
});

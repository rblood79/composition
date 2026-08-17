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

    expect(css).toContain(".history-panel .history-section > .section-content");
    expect(sectionContentRule).not.toContain("padding:");
    expect(sectionContentRule).not.toContain("gap:");
    expect(css).not.toContain("border-bottom: 1px solid var(--border)");
    expect(css).toContain("border: 0");
    expect(css).toContain("min-height: var(--header-height)");
    expect(css).toContain("padding: var(--spacing-xs) var(--spacing-sm)");
    expect(css).toContain("background: var(--accent-subtle)");
    expect(css).toContain("min-width: 0");
    expect(css).not.toContain("transition: all");
  });
});

import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

// (The old BuilderCore cutover contract retired with the old app — ADR-248 4e; the Builder core is
// CatalogBuilderCore.)
describe("BuilderHeader history action ownership", () => {
  it("removes history UI from the global header and delegates it to HistoryPanel", async () => {
    const coreSource = await readFile(
      resolve(__dirname, "CatalogBuilderCore.tsx"),
      "utf-8",
    );
    const headerSource = await readFile(
      resolve(__dirname, "BuilderHeader.tsx"),
      "utf-8",
    );
    const headerCss = await readFile(
      resolve(__dirname, "../styles/layout/header.css"),
      "utf-8",
    );

    expect(headerSource).not.toContain('className="history-info"');
    expect(headerSource).not.toContain('className="code sizeInfo"');
    expect(headerSource).not.toContain("historyInfo:");
    expect(headerSource).not.toContain('shortcutId="undo"');
    expect(headerSource).not.toContain('shortcutId="redo"');
    expect(headerSource).not.toContain("canUndo:");
    expect(headerSource).not.toContain("canRedo:");
    expect(coreSource).not.toContain("onUndo={handleUndo}");
    expect(coreSource).not.toContain("onRedo={handleRedo}");
    expect(coreSource).not.toContain("historyInfo={{");
    expect(headerCss).not.toContain(".sizeInfo");
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(resolve(__dirname, relativePath), "utf8");
}

describe("ADR-922 G3 workspace occupancy cutover", () => {
  // (The old Workspace · compare mode · BuilderCanvas renderer selection retired with the old app —
  // ADR-248 4e.)
  it("Canvas-local consumer가 legacy panel inset runtime을 import하지 않는다", () => {
    const consumers = [
      "../workspace/scrollbar/CanvasScrollbar.tsx",
      "PanelWorkspace.tsx",
    ].map(read);

    for (const source of consumers) {
      expect(source).not.toContain("panelLayoutRuntime");
      expect(source).not.toContain("measureWorkspacePanelInsets");
      expect(source).not.toContain("subscribeToPanelLayoutChanges");
      expect(source).not.toContain("registerPanelElement");
    }
  });

  it("workspace와 panel overlay는 host-local 좌표계를 공유한다", () => {
    const panelStyles = read("PanelWorkspace.css");
    const workspaceStyles = read("../workspace/Workspace.css");

    // `.app` 이 칸 하나짜리 grid 이고 캔버스 · chrome 층이 그 칸에 겹친다 (host 래퍼 없음).
    expect(panelStyles).not.toMatch(/\.panel-workspace-(host|main)\s*[{,>]/);
    expect(panelStyles).toMatch(
      /\.app\s*\{[\s\S]*?display: grid;[\s\S]*?grid-template-columns: minmax\(0, 1fr\);[\s\S]*?grid-template-rows: minmax\(0, 1fr\);/,
    );
    expect(panelStyles).toMatch(/\.app > \*\s*\{[\s\S]*?grid-area: 1 \/ 1;/);
    expect(panelStyles).not.toMatch(
      /\.panel-workspace\s*\{[^}]*position: absolute;/,
    );
    expect(workspaceStyles).not.toContain("position: fixed");
    expect(workspaceStyles).toMatch(
      /\.workspace \{[\s\S]*?position: relative;/,
    );
  });
});

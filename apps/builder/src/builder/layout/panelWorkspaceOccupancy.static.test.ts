import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(resolve(__dirname, relativePath), "utf8");
}

describe("ADR-922 G3 workspace occupancy cutover", () => {
  it("세 renderer mode가 하나의 Workspace root에서 content만 선택한다", () => {
    const workspace = read("../workspace/Workspace.tsx");
    const compareMode = read(
      "../workspace/components/WorkspaceCompareMode.tsx",
    );
    const fallback = read("../main/BuilderCanvas.tsx");

    expect(workspace).toContain(
      '<main ref={containerRef} className="workspace">',
    );
    expect(workspace).toContain("compareMode && fallbackCanvas");
    expect(workspace).toContain("!useWebGL && fallbackCanvas");
    expect(compareMode).not.toContain(
      'className="workspace workspace--compare-mode"',
    );
    expect(fallback).toContain('<div className="workSpace">');
    expect(fallback).not.toContain('<main className="workSpace">');
  });

  it("Canvas-local consumer가 legacy panel inset runtime을 import하지 않는다", () => {
    const consumers = [
      "../workspace/hooks/useWorkspaceCanvasSizing.ts",
      "../workspace/scrollbar/CanvasScrollbar.tsx",
      "../workspace/canvas/skia/skiaOverlayHelpers.ts",
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

    expect(panelStyles).toContain(".panel-workspace-host");
    expect(panelStyles).toContain(".panel-workspace-main");
    expect(panelStyles).toContain("grid-area: main");
    expect(panelStyles).toContain("inset: 0");
    expect(workspaceStyles).not.toContain("position: fixed");
    expect(workspaceStyles).toMatch(
      /\.workspace \{[\s\S]*?position: relative;/,
    );
  });
});

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
    expect(panelStyles).toMatch(
      /\.panel-workspace-host\s*\{[\s\S]*?display: grid;[\s\S]*?grid-template-areas: "workspace";/,
    );
    expect(panelStyles).toMatch(
      /\.panel-workspace-main,[\s\S]*?\.panel-workspace\s*\{[\s\S]*?grid-area: workspace;/,
    );
    expect(panelStyles).not.toMatch(
      /\.panel-workspace\s*\{[^}]*position: absolute;/,
    );
    expect(workspaceStyles).not.toContain("position: fixed");
    expect(workspaceStyles).toMatch(
      /\.workspace \{[\s\S]*?position: relative;/,
    );
  });
});

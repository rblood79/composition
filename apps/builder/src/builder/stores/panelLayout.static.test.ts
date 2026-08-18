import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Photoshop식 panel layout persistence 계약", () => {
  it("v2 primary만 production Zustand state로 유지한다", async () => {
    const source = await readFile(
      resolve(__dirname, "panelLayout.ts"),
      "utf-8",
    );

    expect(source).toContain(
      "panelWorkspaceLayout: PanelWorkspaceLayoutV2 | null",
    );
    expect(source).toContain("migratePanelWorkspaceStorageToV2({");
    expect(source).toContain("PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY");
    expect(source).toContain("scheduleV2Write(normalized.value)");
    expect(source).not.toMatch(/\bpanelLayout:\s/);
    expect(source).not.toContain("projectV2ToLegacyView(");
    expect(source).not.toContain("setPanelLayout");
    expect(source).not.toContain("resetPanelLayout");
    expect(source).not.toContain('localStorage.setItem("panel-layout"');
    expect(source).not.toContain("activeLeftPanels.length > 2");
    expect(source).not.toContain("activeRightPanels.length > 2");
    expect(source).not.toContain("너무 많은 패널이 활성화");
  });
});

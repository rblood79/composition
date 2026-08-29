import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const BUILDER_ROOT = resolve(__dirname, "..");

async function readBuilderFile(path: string): Promise<string> {
  return readFile(resolve(BUILDER_ROOT, path), "utf-8");
}

describe("ADR-922 G6 legacy panel removal", () => {
  it.each([
    "layout/PanelArea.tsx",
    "layout/BottomPanelArea.tsx",
    "layout/PanelContainer.tsx",
    "layout/PanelContainer.static.test.ts",
    "layout/ModalPanelContainer.tsx",
    "layout/ModalPanelContainer.css",
    "layout/panelStackLayout.ts",
    "layout/panelStackLayout.test.ts",
    "workspace/utils/panelLayoutRuntime.ts",
    "styles/layout/footer.css",
    "styles/modules/panel-container.css",
  ])("removes unused legacy surface %s", async (path) => {
    await expect(access(resolve(BUILDER_ROOT, path))).rejects.toThrow();
  });

  it("keeps only the v3 Zustand state/actions in production", async () => {
    const [store, storeIndex, hook, hookType, runtime, coordinator, workspace] =
      await Promise.all([
        readBuilderFile("stores/panelLayout.ts"),
        readBuilderFile("stores/index.ts"),
        readBuilderFile("hooks/usePanelLayout.ts"),
        readBuilderFile("layout/types.ts"),
        readBuilderFile("layout/panelWorkspaceRuntime.ts"),
        readBuilderFile("layout/panelWorkspaceLayoutCoordinator.ts"),
        readBuilderFile("layout/PanelWorkspace.tsx"),
      ]);

    for (const source of [store, storeIndex, hook, hookType]) {
      expect(source).not.toContain("state.panelLayout");
      expect(source).not.toContain("setPanelLayout");
      expect(source).not.toContain("resetPanelLayout");
      expect(source).not.toContain("savePanelLayoutToStorage");
      expect(source).not.toContain("loadPanelLayoutFromStorage");
      expect(source).not.toContain("openPanelAsModal");
      expect(source).not.toContain("toggleBottomPanel");
    }

    expect(store).not.toMatch(/\bpanelLayout:\s/);
    expect(store).toContain(
      "panelWorkspaceLayout: PanelWorkspaceLayoutV4 | null",
    );
    expect(hook).toContain("(panelId: PanelId) =>");
    expect(hook).not.toContain("_side: PanelSide");
    expect(hook).toContain("focusPanel");

    for (const source of [
      store,
      hook,
      hookType,
      runtime,
      coordinator,
      workspace,
    ]) {
      expect(source).not.toContain("PanelWorkspaceLayoutV2");
      expect(source).not.toContain("floatAnchoredPanelWorkspaceClusters");
      expect(source).not.toContain("detachPanelToFloatingCluster");
      expect(source).not.toContain("floatingFocusOrder");
    }
  });

  it("retains the read-only v1 parser and durable rollback backup", async () => {
    const [migration, persistence] = await Promise.all([
      readBuilderFile("layout/panelWorkspaceLayoutV2Migration.ts"),
      readBuilderFile("layout/panelWorkspaceLayoutV2Persistence.ts"),
    ]);

    expect(migration).toContain("PanelLayoutState");
    expect(migration).toContain("projectV2ToLegacyView");
    expect(persistence).toContain("readPanelWorkspaceV1Compatibility");
    expect(persistence).toContain("PANEL_WORKSPACE_LAYOUT_V1_BACKUP_KEY");
  });

  it("removes legacy exports/CSS imports while retaining bottom Monitor placement", async () => {
    const [layoutIndex, styleIndex, workspace, panelConfigs] =
      await Promise.all([
        readBuilderFile("layout/index.ts"),
        readBuilderFile("styles/index.css"),
        readBuilderFile("layout/PanelWorkspace.tsx"),
        readBuilderFile("panels/core/panelConfigs.ts"),
      ]);

    expect(layoutIndex).not.toContain("PanelArea");
    expect(layoutIndex).not.toContain("BottomPanelArea");
    expect(layoutIndex).not.toContain("PanelContainer");
    expect(layoutIndex).not.toContain("ModalPanelContainer");
    expect(styleIndex).not.toContain("footer.css");
    expect(styleIndex).not.toContain("panel-container.css");
    expect(workspace).toContain('["left", "right", "bottom"] as const');
    expect(workspace).toContain("if (panelIds.length === 0) return null");
    expect(panelConfigs).toMatch(
      /id: "monitor",[\s\S]*?defaultPosition: "bottom"/,
    );
  });
});

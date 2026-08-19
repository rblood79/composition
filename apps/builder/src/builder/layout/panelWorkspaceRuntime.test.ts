import { describe, expect, it, vi } from "vitest";
import {
  PANEL_WORKSPACE_TEST_REGISTRY,
  createPanelWorkspaceLayoutV2,
} from "./panelWorkspaceLayoutV2.testFixtures";
import { createPanelWorkspaceRuntime } from "./panelWorkspaceRuntime";

function rowHeight(
  layout: ReturnType<typeof createPanelWorkspaceLayoutV2>,
  panelId: string,
): number | undefined {
  return layout.clusters
    .flatMap((cluster) => cluster.columns)
    .flatMap((column) => column.rows)
    .find((row) => row.panelId === panelId)?.height;
}

describe("ADR-922 PanelWorkspace production runtime", () => {
  it("interaction cancel은 시작 시 committed v2 snapshot을 byte-equivalent로 복원한다", () => {
    const layout = createPanelWorkspaceLayoutV2();
    const runtime = createPanelWorkspaceRuntime(
      layout,
      PANEL_WORKSPACE_TEST_REGISTRY,
      { width: 1440, height: 852 },
      { left: 48, right: 48, bottom: 48 },
    );
    expect(runtime.ok).toBe(true);
    if (!runtime.ok) return;
    const initialRaw = JSON.stringify(runtime.value.getLayout());

    runtime.value.beginInteraction();
    expect(
      runtime.value.movePanel("properties", {
        x: 760,
        y: 120,
        width: 320,
        height: 520,
      }).ok,
    ).toBe(true);
    expect(JSON.stringify(runtime.value.getLayout())).not.toBe(initialRaw);

    expect(JSON.stringify(runtime.value.cancelInteraction())).toBe(initialRaw);
    runtime.value.destroy();
  });

  it("move hot path는 storage를 쓰지 않고 end에서 동일 layout을 반환한다", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const runtime = createPanelWorkspaceRuntime(
      createPanelWorkspaceLayoutV2(),
      PANEL_WORKSPACE_TEST_REGISTRY,
      { width: 1440, height: 852 },
      { left: 48, right: 48, bottom: 48 },
    );
    expect(runtime.ok).toBe(true);
    if (!runtime.ok) return;

    runtime.value.beginInteraction();
    runtime.value.movePanel("properties", {
      x: 720,
      y: 96,
      width: 320,
      height: 520,
    });
    const committed = runtime.value.endInteraction();

    expect(committed).toBe(runtime.value.getLayout());
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
    runtime.value.destroy();
  });

  it("Phase 3 drag move는 v2 committed graph를 변경하지 않고 invalid drop은 commit 0으로 끝난다", () => {
    const runtime = createPanelWorkspaceRuntime(
      createPanelWorkspaceLayoutV2(),
      PANEL_WORKSPACE_TEST_REGISTRY,
      { width: 1200, height: 800 },
      { left: 48, right: 48, bottom: 48 },
    );
    expect(runtime.ok).toBe(true);
    if (!runtime.ok) return;
    const baseRaw = JSON.stringify(runtime.value.getLayout());

    expect(runtime.value.beginDrag("properties").ok).toBe(true);
    const updated = runtime.value.updateDrag(
      "properties",
      { x: 5000, y: 5000, width: 320, height: 520 },
      { x: 5000, y: 5000 },
    );
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.value.candidate).toBeNull();
    expect(JSON.stringify(runtime.value.getLayout())).toBe(baseRaw);

    const ended = runtime.value.endDrag("properties");
    expect(ended.ok).toBe(true);
    if (!ended.ok) return;
    expect(ended.value.committed).toBe(false);
    expect(ended.value.affectedPanelIds).toEqual([]);
    expect(JSON.stringify(ended.value.layout)).toBe(baseRaw);
    runtime.value.destroy();
  });

  it("Phase 3 valid zone drop만 v2 compatibility writer에 한 번 넘길 layout을 만든다", () => {
    const runtime = createPanelWorkspaceRuntime(
      createPanelWorkspaceLayoutV2(),
      PANEL_WORKSPACE_TEST_REGISTRY,
      { width: 1200, height: 800 },
      { left: 48, right: 48, bottom: 48 },
    );
    expect(runtime.ok).toBe(true);
    if (!runtime.ok) return;

    expect(runtime.value.beginDrag("properties").ok).toBe(true);
    const updated = runtime.value.updateDrag(
      "properties",
      { x: 800, y: 600, width: 320, height: 200 },
      { x: 600, y: 700 },
    );
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.value.candidate).toEqual({
      kind: "zone",
      zone: "bottom",
    });

    const ended = runtime.value.endDrag("properties");
    expect(ended.ok).toBe(true);
    if (!ended.ok) return;
    expect(ended.value.committed).toBe(true);
    expect(ended.value.candidate).toEqual({
      kind: "zone",
      zone: "bottom",
    });
    expect(ended.value.affectedPanelIds).toContain("properties");
    expect(ended.value.layout.version).toBe(2);
    runtime.value.destroy();
  });

  it("Phase 3 Escape/pointer cancel은 drag session과 preview만 폐기하고 base layout을 유지한다", () => {
    const runtime = createPanelWorkspaceRuntime(
      createPanelWorkspaceLayoutV2(),
      PANEL_WORKSPACE_TEST_REGISTRY,
      { width: 1200, height: 800 },
      { left: 48, right: 48, bottom: 48 },
    );
    expect(runtime.ok).toBe(true);
    if (!runtime.ok) return;
    const baseRaw = JSON.stringify(runtime.value.getLayout());

    expect(runtime.value.beginDrag("properties").ok).toBe(true);
    expect(
      runtime.value.updateDrag(
        "properties",
        { x: 500, y: 350, width: 320, height: 520 },
        { x: 600, y: 400 },
      ).ok,
    ).toBe(true);
    const cancelled = runtime.value.cancelDrag();

    expect(cancelled.committed).toBe(false);
    expect(runtime.value.getDragSession()).toBeNull();
    expect(JSON.stringify(cancelled.layout)).toBe(baseRaw);
    expect(JSON.stringify(runtime.value.getLayout())).toBe(baseRaw);
    runtime.value.destroy();
  });

  it("reference resize는 max를 넘겼다가 되돌아와도 pointer 기준 위치에서 다시 resize한다", () => {
    const layout = createPanelWorkspaceLayoutV2();
    layout.visibility.history = true;
    const runtime = createPanelWorkspaceRuntime(
      layout,
      PANEL_WORKSPACE_TEST_REGISTRY,
      { width: 1440, height: 852 },
      { left: 48, right: 48, bottom: 48 },
    );
    expect(runtime.ok).toBe(true);
    if (!runtime.ok) return;

    runtime.value.beginInteraction();
    expect(
      runtime.value.resizePanelFromReference("properties", "bottom", 0, 400).ok,
    ).toBe(true);
    expect(rowHeight(runtime.value.getLayout(), "properties")).toBe(810);
    expect(rowHeight(runtime.value.getLayout(), "history")).toBe(160);

    expect(
      runtime.value.resizePanelFromReference("properties", "bottom", 0, 290).ok,
    ).toBe(true);
    expect(rowHeight(runtime.value.getLayout(), "properties")).toBe(810);
    expect(rowHeight(runtime.value.getLayout(), "history")).toBe(160);

    expect(
      runtime.value.resizePanelFromReference("properties", "bottom", 0, 260).ok,
    ).toBe(true);
    expect(rowHeight(runtime.value.getLayout(), "properties")).toBe(780);
    expect(rowHeight(runtime.value.getLayout(), "history")).toBe(190);
    runtime.value.destroy();
  });
});

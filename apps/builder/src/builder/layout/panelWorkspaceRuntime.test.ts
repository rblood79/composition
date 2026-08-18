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
    const initialRaw = JSON.stringify(layout);
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
    expect(rowHeight(runtime.value.getLayout(), "properties")).toBe(800);
    expect(rowHeight(runtime.value.getLayout(), "history")).toBe(170);

    expect(
      runtime.value.resizePanelFromReference("properties", "bottom", 0, 280).ok,
    ).toBe(true);
    expect(rowHeight(runtime.value.getLayout(), "properties")).toBe(800);
    expect(rowHeight(runtime.value.getLayout(), "history")).toBe(170);

    expect(
      runtime.value.resizePanelFromReference("properties", "bottom", 0, 260).ok,
    ).toBe(true);
    expect(rowHeight(runtime.value.getLayout(), "properties")).toBe(780);
    expect(rowHeight(runtime.value.getLayout(), "history")).toBe(190);
    runtime.value.destroy();
  });
});

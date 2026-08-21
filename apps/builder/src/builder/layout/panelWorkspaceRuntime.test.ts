import { describe, expect, it, vi } from "vitest";
import type { PanelFrameGeometry } from "../panels/core/types";
import { PANEL_WORKSPACE_TEST_REGISTRY } from "./panelWorkspaceLayoutV2.testFixtures";
import {
  solvePanelWorkspaceLayoutV3,
  type PanelWorkspaceLayoutV3,
} from "./panelWorkspaceLayoutV3";
import { createPanelWorkspaceLayoutV3Fixture } from "./panelWorkspaceLayoutV3.testFixtures";
import { createPanelWorkspaceRuntime } from "./panelWorkspaceRuntime";

function rowHeight(
  layout: ReturnType<typeof createPanelWorkspaceLayoutV3Fixture>,
  panelId: string,
): number | undefined {
  return layout.clusters
    .flatMap((cluster) => cluster.columns)
    .flatMap((column) => column.rows)
    .find((row) => row.panelId === panelId)?.height;
}

function solvedFrame(
  layout: PanelWorkspaceLayoutV3,
  panelId: "properties",
  surfaceRect: { width: number; height: number },
): PanelFrameGeometry {
  const solved = solvePanelWorkspaceLayoutV3(
    layout,
    PANEL_WORKSPACE_TEST_REGISTRY,
    surfaceRect,
  );
  expect(solved.ok).toBe(true);
  if (!solved.ok) throw new Error(solved.error);
  const frame = solved.value.frameGeometries.get(panelId);
  expect(frame).toBeDefined();
  if (!frame) throw new Error(`Missing frame for "${panelId}"`);
  return frame;
}

describe("ADR-922 PanelWorkspace production runtime", () => {
  it("interaction cancel은 시작 시 committed v3 snapshot을 byte-equivalent로 복원한다", () => {
    const layout = createPanelWorkspaceLayoutV3Fixture({
      width: 1440,
      height: 1200,
    });
    layout.visibility.history = true;
    const runtime = createPanelWorkspaceRuntime(
      layout,
      PANEL_WORKSPACE_TEST_REGISTRY,
      { width: 1440, height: 1200 },
    );
    expect(runtime.ok).toBe(true);
    if (!runtime.ok) return;
    const initialRaw = JSON.stringify(runtime.value.getLayout());

    runtime.value.beginInteraction();
    expect(runtime.value.resizePanel("properties", "bottom", 0, 30).ok).toBe(
      true,
    );
    expect(JSON.stringify(runtime.value.getLayout())).not.toBe(initialRaw);

    expect(JSON.stringify(runtime.value.cancelInteraction())).toBe(initialRaw);
    runtime.value.destroy();
  });

  it("resize hot path는 storage를 쓰지 않고 end에서 동일 layout을 반환한다", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const runtime = createPanelWorkspaceRuntime(
      createPanelWorkspaceLayoutV3Fixture(),
      PANEL_WORKSPACE_TEST_REGISTRY,
      { width: 1440, height: 852 },
    );
    expect(runtime.ok).toBe(true);
    if (!runtime.ok) return;

    runtime.value.beginInteraction();
    runtime.value.resizePanel("properties", "left", -20, 0);
    const committed = runtime.value.endInteraction();

    expect(committed).toBe(runtime.value.getLayout());
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
    runtime.value.destroy();
  });

  it("Phase 5 drag move는 v3 committed graph를 변경하지 않고 invalid drop은 commit 0으로 끝난다", () => {
    const runtime = createPanelWorkspaceRuntime(
      createPanelWorkspaceLayoutV3Fixture({ width: 1200, height: 800 }),
      PANEL_WORKSPACE_TEST_REGISTRY,
      { width: 1200, height: 800 },
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
    expect(JSON.stringify(ended.value.layout)).toBe(baseRaw);
    runtime.value.destroy();
  });

  it("Phase 5 valid zone drop만 v3 graph를 commit한다", () => {
    const runtime = createPanelWorkspaceRuntime(
      createPanelWorkspaceLayoutV3Fixture({ width: 1200, height: 800 }),
      PANEL_WORKSPACE_TEST_REGISTRY,
      { width: 1200, height: 800 },
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
    const bottomCluster = ended.value.layout.clusters.find(
      (cluster) => cluster.placementZone === "bottom",
    );
    expect(
      bottomCluster?.columns.some((column) =>
        column.rows.some((row) => row.panelId === "properties"),
      ),
    ).toBe(true);
    expect(ended.value.layout.version).toBe(3);
    runtime.value.destroy();
  });

  it("Phase 3 Escape/pointer cancel은 drag session과 preview만 폐기하고 base layout을 유지한다", () => {
    const runtime = createPanelWorkspaceRuntime(
      createPanelWorkspaceLayoutV3Fixture({ width: 1200, height: 800 }),
      PANEL_WORKSPACE_TEST_REGISTRY,
      { width: 1200, height: 800 },
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

  it("reference row resize는 paired min 이후 남은 workspace를 사용하고 clamp에서 복귀한다", () => {
    const layout = createPanelWorkspaceLayoutV3Fixture({
      width: 1440,
      height: 1200,
    });
    layout.visibility.history = true;
    const runtime = createPanelWorkspaceRuntime(
      layout,
      PANEL_WORKSPACE_TEST_REGISTRY,
      { width: 1440, height: 1200 },
    );
    expect(runtime.ok).toBe(true);
    if (!runtime.ok) return;

    runtime.value.beginInteraction();
    expect(
      runtime.value.resizePanelFromReference("properties", "bottom", 0, 1000)
        .ok,
    ).toBe(true);
    expect(rowHeight(runtime.value.getLayout(), "properties")).toBe(1036);
    expect(rowHeight(runtime.value.getLayout(), "history")).toBe(160);

    expect(
      runtime.value.resizePanelFromReference("properties", "bottom", 0, 400).ok,
    ).toBe(true);
    expect(rowHeight(runtime.value.getLayout(), "properties")).toBe(920);
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

  it("center-top reference resize는 clamp 복귀 뒤에도 center와 pointer edge를 유지한다", () => {
    const surfaceRect = { width: 1200, height: 800 } as const;
    const layout = createPanelWorkspaceLayoutV3Fixture(surfaceRect);
    const cluster = layout.clusters.find((candidate) =>
      candidate.columns.some((column) =>
        column.rows.some((row) => row.panelId === "properties"),
      ),
    );
    expect(cluster).toBeDefined();
    if (!cluster) return;
    cluster.placementZone = "top";
    delete cluster.originOffset;

    const before = solvedFrame(layout, "properties", surfaceRect);
    const runtime = createPanelWorkspaceRuntime(
      layout,
      PANEL_WORKSPACE_TEST_REGISTRY,
      surfaceRect,
    );
    expect(runtime.ok).toBe(true);
    if (!runtime.ok) return;

    runtime.value.beginInteraction();
    expect(
      runtime.value.resizePanelFromReference("properties", "right", 1000, 0).ok,
    ).toBe(true);
    expect(
      runtime.value.resizePanelFromReference("properties", "right", 20, 0).ok,
    ).toBe(true);
    const after = solvedFrame(
      runtime.value.getLayout(),
      "properties",
      surfaceRect,
    );

    expect(after.x + after.width / 2).toBe(before.x + before.width / 2);
    expect(after.x + after.width).toBe(before.x + before.width + 20);
    expect(after.width).toBe(before.width + 40);
    runtime.value.destroy();
  });

  it("Phase 4 activation은 right stack overflow를 top-right의 왼쪽 column에 만든다", () => {
    const runtime = createPanelWorkspaceRuntime(
      createPanelWorkspaceLayoutV3Fixture({ width: 1200, height: 800 }),
      PANEL_WORKSPACE_TEST_REGISTRY,
      { width: 1200, height: 800 },
    );
    expect(runtime.ok).toBe(true);
    if (!runtime.ok) return;

    const activated = runtime.value.activatePanel("history");
    expect(activated.ok).toBe(true);
    if (!activated.ok) return;
    const cluster = runtime.value
      .getLayout()
      .clusters.find((candidate) =>
        candidate.columns.some((column) =>
          column.rows.some((row) => row.panelId === "properties"),
        ),
      );
    expect(cluster?.columns.map((column) => column.rows)).toEqual([
      [{ panelId: "history", height: 450 }],
      [{ panelId: "properties", height: 520 }],
    ]);
    expect(runtime.value.getLayout().railOrder.right).toEqual([
      "properties",
      "history",
    ]);
    runtime.value.destroy();
  });

  it("Phase 5 explicit reset은 default rail과 zone placement를 v3 layout에 복원한다", () => {
    const runtime = createPanelWorkspaceRuntime(
      createPanelWorkspaceLayoutV3Fixture({ width: 1200, height: 800 }),
      PANEL_WORKSPACE_TEST_REGISTRY,
      { width: 1200, height: 800 },
    );
    expect(runtime.ok).toBe(true);
    if (!runtime.ok) return;

    expect(runtime.value.beginDrag("properties").ok).toBe(true);
    expect(
      runtime.value.updateDrag(
        "properties",
        { x: 500, y: 650, width: 233, height: 100 },
        { x: 600, y: 700 },
      ).ok,
    ).toBe(true);
    expect(runtime.value.endDrag("properties")).toMatchObject({
      ok: true,
      value: { committed: true },
    });

    const reset = runtime.value.resetLayout();
    expect(reset.ok).toBe(true);
    if (!reset.ok) return;
    runtime.value.endInteraction();
    expect(runtime.value.getLayout().railOrder.right).toEqual([
      "properties",
      "history",
    ]);
    const started = runtime.value.beginDrag("properties");
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(
      started.value.baseLayout.clusters.find((cluster) =>
        cluster.columns.some((column) =>
          column.rows.some((row) => row.panelId === "properties"),
        ),
      )?.placementZone,
    ).toBe("top-right");
    runtime.value.cancelDrag();
    runtime.value.destroy();
  });
});

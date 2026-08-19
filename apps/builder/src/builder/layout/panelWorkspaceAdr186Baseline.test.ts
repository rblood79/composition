import { describe, expect, it } from "vitest";
import {
  ADR_186_CLUSTER_SIZE_FIXTURE,
  ADR_186_DEFAULT_ZONE_BY_RAIL,
  ADR_186_PLACEMENT_ZONES,
  ADR_186_SURFACE_RECT_FIXTURE,
  ADR_186_ZONE_ORIGIN_FIXTURES,
  createAdr186TenPlusFloatingFixture,
} from "./panelWorkspaceAdr186.testFixtures";
import {
  PANEL_WORKSPACE_TEST_REGISTRY,
  createPanelWorkspaceLayoutV2,
} from "./panelWorkspaceLayoutV2.testFixtures";
import {
  activatePanelWorkspacePanel,
  resizePanelWorkspaceBoundary,
} from "./panelWorkspaceLayoutInteraction";
import { createPanelWorkspaceRuntime } from "./panelWorkspaceRuntime";

const ACTIVATION_OPTIONS = {
  workspaceRect: { width: 1600, height: 900 },
  railSizes: { left: 48, right: 48, bottom: 48 },
} as const;

function placedPanelIds(
  layout: ReturnType<typeof createAdr186TenPlusFloatingFixture>["layout"],
) {
  return layout.clusters.flatMap((cluster) =>
    cluster.columns.flatMap((column) => column.rows.map((row) => row.panelId)),
  );
}

describe("ADR-186 G0 placement contract fixtures", () => {
  it("9-zone vocabulary, default rail mapping과 origin 기대값을 고정한다", () => {
    expect(ADR_186_PLACEMENT_ZONES).toEqual([
      "top-left",
      "top",
      "top-right",
      "left",
      "center",
      "right",
      "bottom-left",
      "bottom",
      "bottom-right",
    ]);
    expect(new Set(ADR_186_PLACEMENT_ZONES)).toHaveLength(9);
    expect(ADR_186_DEFAULT_ZONE_BY_RAIL).toEqual({
      left: "top-left",
      right: "top-right",
      bottom: "bottom",
    });

    const { width: surfaceWidth, height: surfaceHeight } =
      ADR_186_SURFACE_RECT_FIXTURE;
    const { width: clusterWidth, height: clusterHeight } =
      ADR_186_CLUSTER_SIZE_FIXTURE;
    expect(ADR_186_ZONE_ORIGIN_FIXTURES).toEqual([
      { zone: "top-left", x: 0, y: 0 },
      { zone: "top", x: (surfaceWidth - clusterWidth) / 2, y: 0 },
      { zone: "top-right", x: surfaceWidth - clusterWidth, y: 0 },
      { zone: "left", x: 0, y: (surfaceHeight - clusterHeight) / 2 },
      {
        zone: "center",
        x: (surfaceWidth - clusterWidth) / 2,
        y: (surfaceHeight - clusterHeight) / 2,
      },
      {
        zone: "right",
        x: surfaceWidth - clusterWidth,
        y: (surfaceHeight - clusterHeight) / 2,
      },
      { zone: "bottom-left", x: 0, y: surfaceHeight - clusterHeight },
      {
        zone: "bottom",
        x: (surfaceWidth - clusterWidth) / 2,
        y: surfaceHeight - clusterHeight,
      },
      {
        zone: "bottom-right",
        x: surfaceWidth - clusterWidth,
        y: surfaceHeight - clusterHeight,
      },
    ]);
  });

  it("현 v2는 unsnapped move를 자유 XY로 commit하고 cancel은 시작 graph를 복원한다", () => {
    const runtime = createPanelWorkspaceRuntime(
      createPanelWorkspaceLayoutV2(),
      PANEL_WORKSPACE_TEST_REGISTRY,
      { width: 1440, height: 852 },
      { left: 48, right: 48, bottom: 48 },
    );
    expect(runtime.ok).toBe(true);
    if (!runtime.ok) return;

    runtime.value.beginInteraction();
    expect(
      runtime.value.movePanel("properties", {
        x: 720,
        y: 96,
        width: 320,
        height: 520,
      }).ok,
    ).toBe(true);
    const committed = runtime.value.endInteraction();
    const floating = committed.clusters.find((cluster) =>
      cluster.columns.some((column) =>
        column.rows.some((row) => row.panelId === "properties"),
      ),
    );
    expect(floating).toMatchObject({
      anchor: "floating",
      position: { x: 720, y: 96 },
    });

    const committedRaw = JSON.stringify(committed);
    runtime.value.beginInteraction();
    expect(
      runtime.value.movePanel("properties", {
        x: 100,
        y: 100,
        width: 320,
        height: 520,
      }).ok,
    ).toBe(true);
    expect(JSON.stringify(runtime.value.cancelInteraction())).toBe(
      committedRaw,
    );
    runtime.value.destroy();
  });

  it("hidden reopen은 row를 중복하지 않고 paired resize는 인접 합계를 보존한다", () => {
    const layout = createPanelWorkspaceLayoutV2();
    const firstOpen = activatePanelWorkspacePanel(
      layout,
      PANEL_WORKSPACE_TEST_REGISTRY,
      "history",
      ACTIVATION_OPTIONS,
    );
    expect(firstOpen.ok).toBe(true);
    if (!firstOpen.ok) return;
    const hidden = activatePanelWorkspacePanel(
      firstOpen.value.layout,
      PANEL_WORKSPACE_TEST_REGISTRY,
      "history",
      ACTIVATION_OPTIONS,
    );
    expect(hidden.ok).toBe(true);
    if (!hidden.ok) return;
    const reopened = activatePanelWorkspacePanel(
      hidden.value.layout,
      PANEL_WORKSPACE_TEST_REGISTRY,
      "history",
      ACTIVATION_OPTIONS,
    );
    expect(reopened.ok).toBe(true);
    if (!reopened.ok) return;

    const historyRows = reopened.value.layout.clusters.flatMap((cluster) =>
      cluster.columns.flatMap((column) =>
        column.rows.filter((row) => row.panelId === "history"),
      ),
    );
    expect(historyRows).toHaveLength(1);
    expect(reopened.value.layout.railOrder.right).toEqual([
      "properties",
      "history",
    ]);

    const pairedLayout = createPanelWorkspaceLayoutV2();
    pairedLayout.visibility.history = true;
    const right = pairedLayout.clusters.find(
      (cluster) => cluster.anchor === "right",
    );
    const before = right?.columns[0]?.rows ?? [];
    const beforeTotal = before.reduce((sum, row) => sum + row.height, 0);
    const resized = resizePanelWorkspaceBoundary(
      pairedLayout,
      PANEL_WORKSPACE_TEST_REGISTRY,
      "properties",
      "bottom",
      0,
      30,
    );
    expect(resized.ok).toBe(true);
    if (!resized.ok) return;
    const after = resized.value.layout.clusters.find(
      (cluster) => cluster.anchor === "right",
    )?.columns[0]?.rows;
    expect(after).toEqual([
      { panelId: "properties", height: 550 },
      { panelId: "history", height: 420 },
    ]);
    expect(after?.reduce((sum, row) => sum + row.height, 0)).toBe(beforeTotal);
  });

  it("10+ floating migration 입력은 mixed rail과 tail-topmost 순서를 손실 없이 고정한다", () => {
    const { layout, registry, mixedRailClusterId } =
      createAdr186TenPlusFloatingFixture();
    const placed = placedPanelIds(layout);
    const rails = [
      ...layout.railOrder.left,
      ...layout.railOrder.right,
      ...layout.railOrder.bottom,
    ];
    const mixed = layout.clusters.find(
      (cluster) => cluster.id === mixedRailClusterId,
    );

    expect(layout.clusters).toHaveLength(10);
    expect(new Set(placed).size).toBe(registry.length);
    expect(new Set(rails)).toEqual(new Set(placed));
    expect(mixed?.columns.flatMap((column) => column.rows)).toEqual([
      { panelId: "nodes", height: 100 },
      { panelId: "properties", height: 100 },
      { panelId: "monitor", height: 120 },
    ]);
    expect(layout.floatingFocusOrder[0]).toBe(mixedRailClusterId);
    expect(layout.floatingFocusOrder.at(-1)).toBe("floating:bottom-right");
    expect(layout.visibility.settings).toBe(false);
  });
});

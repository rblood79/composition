import { describe, expect, it } from "vitest";
import type { PanelSnapEdge } from "../panels/core/types";
import {
  PANEL_WORKSPACE_TEST_REGISTRY,
  createPanelWorkspaceLayoutV2,
} from "./panelWorkspaceLayoutV2.testFixtures";
import {
  activatePanelWorkspacePanel,
  detachPanelToFloatingCluster,
  resizePanelWorkspaceBoundary,
  snapPanelWorkspacePanel,
} from "./panelWorkspaceLayoutInteraction";
import { solvePanelWorkspaceLayoutV2 } from "./panelWorkspaceLayoutV2";

const ACTIVATION_OPTIONS = {
  workspaceRect: { width: 1600, height: 900 },
  railSizes: { left: 48, right: 48, bottom: 48 },
} as const;

function visibleRightStack() {
  const layout = createPanelWorkspaceLayoutV2();
  layout.visibility.history = true;
  return layout;
}

describe("ADR-922 PanelWorkspace v2 interaction transaction", () => {
  it("right activation은 아래 stack 후 세로 공간 부족 시 새 left column을 만든다", () => {
    const registry = [
      ...PANEL_WORKSPACE_TEST_REGISTRY,
      {
        id: "styles" as const,
        defaultPosition: "right" as const,
        minWidth: 233,
        maxWidth: 640,
        defaultWidth: 320,
        minHeight: 160,
        maxHeight: 800,
        defaultHeight: 300,
      },
    ];
    const layout = createPanelWorkspaceLayoutV2();
    const right = layout.clusters.find((cluster) => cluster.anchor === "right");
    if (!right) throw new Error("right cluster is required");
    right.columns[0]!.rows = [
      { panelId: "properties", height: 350 },
      { panelId: "history", height: 300 },
    ];
    layout.visibility.properties = true;
    layout.visibility.history = false;
    layout.visibility.styles = false;

    const stacked = activatePanelWorkspacePanel(
      layout,
      registry,
      "history",
      ACTIVATION_OPTIONS,
    );
    expect(stacked.ok).toBe(true);
    if (!stacked.ok) return;
    const stackedRight = stacked.value.layout.clusters.find(
      (cluster) => cluster.anchor === "right",
    );
    expect(
      stackedRight?.columns[0]?.rows
        .filter((row) => stacked.value.layout.visibility[row.panelId] === true)
        .map((row) => row.panelId),
    ).toEqual(["properties", "history"]);

    const columned = activatePanelWorkspacePanel(
      stacked.value.layout,
      registry,
      "styles",
      ACTIVATION_OPTIONS,
    );
    expect(columned.ok).toBe(true);
    if (!columned.ok) return;
    const columnedRight = columned.value.layout.clusters.find(
      (cluster) => cluster.anchor === "right",
    );
    expect(
      columnedRight?.columns.map((column) =>
        column.rows.map((row) => row.panelId),
      ),
    ).toEqual([["styles"], ["properties", "history"]]);
    expect(columned.value.layout.railOrder.right).toEqual([
      "properties",
      "history",
      "styles",
    ]);
    const solved = solvePanelWorkspaceLayoutV2(
      columned.value.layout,
      registry,
      ACTIVATION_OPTIONS,
    );
    expect(solved.ok).toBe(true);
    if (!solved.ok) return;
    const stylesFrame = solved.value.frameGeometries.get("styles");
    const propertiesFrame = solved.value.frameGeometries.get("properties");
    expect(stylesFrame).toBeDefined();
    expect(propertiesFrame).toBeDefined();
    expect(stylesFrame!.x).toBeLessThan(propertiesFrame!.x);
    expect(stylesFrame!.y).toBe(propertiesFrame!.y);
  });

  it("left activation은 아래 stack 후 세로 공간 부족 시 새 right column을 만든다", () => {
    const layout = createPanelWorkspaceLayoutV2();
    const left = layout.clusters.find((cluster) => cluster.anchor === "left");
    if (!left) throw new Error("left cluster is required");
    left.columns[0]!.rows = [
      { panelId: "nodes", height: 350 },
      { panelId: "datatableEditor", height: 300 },
      { panelId: "settings", height: 300 },
    ];
    layout.visibility.nodes = true;
    layout.visibility.datatableEditor = false;
    layout.visibility.settings = false;

    const stacked = activatePanelWorkspacePanel(
      layout,
      PANEL_WORKSPACE_TEST_REGISTRY,
      "datatableEditor",
      ACTIVATION_OPTIONS,
    );
    expect(stacked.ok).toBe(true);
    if (!stacked.ok) return;

    const columned = activatePanelWorkspacePanel(
      stacked.value.layout,
      PANEL_WORKSPACE_TEST_REGISTRY,
      "settings",
      ACTIVATION_OPTIONS,
    );
    expect(columned.ok).toBe(true);
    if (!columned.ok) return;
    const columnedLeft = columned.value.layout.clusters.find(
      (cluster) => cluster.anchor === "left",
    );
    expect(
      columnedLeft?.columns.map((column) =>
        column.rows.map((row) => row.panelId),
      ),
    ).toEqual([["nodes", "datatableEditor"], ["settings"]]);
    const solved = solvePanelWorkspaceLayoutV2(
      columned.value.layout,
      PANEL_WORKSPACE_TEST_REGISTRY,
      ACTIVATION_OPTIONS,
    );
    expect(solved.ok).toBe(true);
    if (!solved.ok) return;
    const nodesFrame = solved.value.frameGeometries.get("nodes");
    const settingsFrame = solved.value.frameGeometries.get("settings");
    expect(nodesFrame).toBeDefined();
    expect(settingsFrame).toBeDefined();
    expect(settingsFrame!.x).toBeGreaterThan(nodesFrame!.x);
    expect(settingsFrame!.y).toBe(nodesFrame!.y);
  });

  it.each<PanelSnapEdge>(["top", "right", "bottom", "left"])(
    "%s snap은 source를 한 번만 배치하고 target cluster에 삽입한다",
    (edge) => {
      const layout = createPanelWorkspaceLayoutV2();
      layout.visibility.settings = true;

      const result = snapPanelWorkspacePanel(
        layout,
        PANEL_WORKSPACE_TEST_REGISTRY,
        "settings",
        "properties",
        edge,
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const placements = result.value.layout.clusters.flatMap((cluster) =>
        cluster.columns.flatMap((column) =>
          column.rows.filter((row) => row.panelId === "settings"),
        ),
      );
      expect(placements).toHaveLength(1);
      expect(result.value.affectedPanelIds).toEqual(
        expect.arrayContaining(["settings", "properties"]),
      );
      const targetCluster = result.value.layout.clusters.find((cluster) =>
        cluster.columns.some((column) =>
          column.rows.some((row) => row.panelId === "properties"),
        ),
      );
      expect(
        targetCluster?.columns.some((column) =>
          column.rows.some((row) => row.panelId === "settings"),
        ),
      ).toBe(true);
    },
  );

  it("detach/move는 기존 placement를 제거하고 동일 크기의 floating cluster 하나를 만든다", () => {
    const layout = visibleRightStack();

    const result = detachPanelToFloatingCluster(
      layout,
      PANEL_WORKSPACE_TEST_REGISTRY,
      "history",
      { x: 420, y: 180, width: 320, height: 450 },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const floating = result.value.layout.clusters.find(
      (cluster) =>
        cluster.anchor === "floating" &&
        cluster.columns.some((column) =>
          column.rows.some((row) => row.panelId === "history"),
        ),
    );
    expect(floating).toMatchObject({
      anchor: "floating",
      position: { x: 420, y: 180 },
      columns: [
        {
          width: 320,
          rows: [{ panelId: "history", height: 450 }],
        },
      ],
    });
    expect(result.value.layout.floatingFocusOrder.at(-1)).toBe(floating?.id);
  });

  it("row boundary resize는 source 증가량과 neighbor 감소량을 같은 결과에 반영한다", () => {
    const layout = visibleRightStack();

    const result = resizePanelWorkspaceBoundary(
      layout,
      PANEL_WORKSPACE_TEST_REGISTRY,
      "properties",
      "bottom",
      0,
      40,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const right = result.value.layout.clusters.find(
      (cluster) => cluster.anchor === "right",
    );
    expect(right?.columns[0]?.rows).toEqual([
      { panelId: "properties", height: 560 },
      { panelId: "history", height: 410 },
    ]);
    expect(result.value.affectedPanelIds).toEqual(["properties", "history"]);
  });

  it("column boundary resize는 양쪽 column 전체를 같은 transaction에서 갱신한다", () => {
    const layout = visibleRightStack();
    const right = layout.clusters.find((cluster) => cluster.anchor === "right");
    if (!right) throw new Error("right cluster is required");
    right.columns = [
      {
        id: "right:history",
        width: 320,
        rows: [{ panelId: "history", height: 450 }],
      },
      {
        id: "right:properties",
        width: 300,
        rows: [{ panelId: "properties", height: 520 }],
      },
    ];

    const result = resizePanelWorkspaceBoundary(
      layout,
      PANEL_WORKSPACE_TEST_REGISTRY,
      "history",
      "right",
      30,
      0,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const resized = result.value.layout.clusters.find(
      (cluster) => cluster.anchor === "right",
    );
    expect(resized?.columns.map((column) => column.width)).toEqual([350, 270]);
    expect(result.value.affectedPanelIds).toEqual(["history", "properties"]);
  });

  it("neighbor min에 걸리면 paired delta 전체를 clamp한다", () => {
    const layout = visibleRightStack();

    const result = resizePanelWorkspaceBoundary(
      layout,
      PANEL_WORKSPACE_TEST_REGISTRY,
      "properties",
      "bottom",
      0,
      500,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const right = result.value.layout.clusters.find(
      (cluster) => cluster.anchor === "right",
    );
    expect(right?.columns[0]?.rows).toEqual([
      { panelId: "properties", height: 800 },
      { panelId: "history", height: 170 },
    ]);
  });

  it("hidden row는 outer vertical resize의 neighbor 제약에 포함하지 않는다", () => {
    const layout = createPanelWorkspaceLayoutV2();

    const result = resizePanelWorkspaceBoundary(
      layout,
      PANEL_WORKSPACE_TEST_REGISTRY,
      "properties",
      "bottom",
      0,
      400,
      { maxHeight: 900 },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const right = result.value.layout.clusters.find(
      (cluster) => cluster.anchor === "right",
    );
    expect(
      right?.columns[0]?.rows.find((row) => row.panelId === "properties"),
    ).toEqual({ panelId: "properties", height: 900 });
  });

  it("floating left/top outer resize는 반대쪽 edge를 고정한다", () => {
    const detached = detachPanelToFloatingCluster(
      visibleRightStack(),
      PANEL_WORKSPACE_TEST_REGISTRY,
      "history",
      { x: 420, y: 180, width: 320, height: 450 },
    );
    expect(detached.ok).toBe(true);
    if (!detached.ok) return;

    const left = resizePanelWorkspaceBoundary(
      detached.value.layout,
      PANEL_WORKSPACE_TEST_REGISTRY,
      "history",
      "left",
      -30,
      0,
    );
    expect(left.ok).toBe(true);
    if (!left.ok) return;
    const afterLeft = left.value.layout.clusters.find(
      (cluster) => cluster.anchor === "floating",
    );
    expect(afterLeft).toMatchObject({
      position: { x: 390, y: 180 },
      columns: [{ width: 350 }],
    });

    const top = resizePanelWorkspaceBoundary(
      left.value.layout,
      PANEL_WORKSPACE_TEST_REGISTRY,
      "history",
      "top",
      0,
      -20,
    );
    expect(top.ok).toBe(true);
    if (!top.ok) return;
    const afterTop = top.value.layout.clusters.find(
      (cluster) => cluster.anchor === "floating",
    );
    expect(afterTop).toMatchObject({
      position: { x: 390, y: 160 },
      columns: [{ width: 350, rows: [{ height: 470 }] }],
    });
  });
});

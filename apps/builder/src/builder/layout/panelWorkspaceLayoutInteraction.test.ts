import { describe, expect, it } from "vitest";
import type { PanelSnapEdge } from "../panels/core/types";
import {
  PANEL_WORKSPACE_TEST_REGISTRY,
  createPanelWorkspaceLayoutV2,
} from "./panelWorkspaceLayoutV2.testFixtures";
import {
  detachPanelToFloatingCluster,
  resizePanelWorkspaceBoundary,
  snapPanelWorkspacePanel,
} from "./panelWorkspaceLayoutInteraction";

function visibleRightStack() {
  const layout = createPanelWorkspaceLayoutV2();
  layout.visibility.history = true;
  return layout;
}

describe("ADR-922 PanelWorkspace v2 interaction transaction", () => {
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

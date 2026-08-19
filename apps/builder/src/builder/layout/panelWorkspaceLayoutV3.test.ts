import { describe, expect, it } from "vitest";
import {
  createDefaultPanelWorkspaceLayoutV3,
  PANEL_WORKSPACE_DEFAULT_ZONE_BY_RAIL,
  PANEL_WORKSPACE_PLACEMENT_ZONES,
  parsePanelWorkspaceLayoutV3,
  type PanelWorkspaceLayoutV3,
} from "./panelWorkspaceLayoutV3";
import { PANEL_WORKSPACE_TEST_REGISTRY } from "./panelWorkspaceLayoutV2.testFixtures";

const SURFACE_RECT = { width: 1200, height: 800 } as const;

function panelIdsInLayout(layout: PanelWorkspaceLayoutV3): string[] {
  return layout.clusters.flatMap((cluster) =>
    cluster.columns.flatMap((column) => column.rows.map((row) => row.panelId)),
  );
}

describe("ADR-186 PanelWorkspaceLayoutV3 model", () => {
  it("9-zone vocabulary와 Photoshop default mapping으로 v3-born layout을 만든다", () => {
    expect(PANEL_WORKSPACE_PLACEMENT_ZONES).toEqual([
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
    expect(PANEL_WORKSPACE_DEFAULT_ZONE_BY_RAIL).toEqual({
      left: "top-left",
      right: "top-right",
      bottom: "bottom",
    });

    const result = createDefaultPanelWorkspaceLayoutV3(
      PANEL_WORKSPACE_TEST_REGISTRY,
      SURFACE_RECT,
      { nodes: true, properties: true },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.version).toBe(3);
    expect(
      result.value.clusters.map((cluster) => cluster.placementZone),
    ).toEqual(["top-left", "top-right", "bottom"]);
    expect(new Set(panelIdsInLayout(result.value)).size).toBe(
      PANEL_WORKSPACE_TEST_REGISTRY.length,
    );
    expect(JSON.stringify(result.value)).not.toMatch(
      /"(?:position|x|y|anchor)"/,
    );
  });

  it("duplicate zone/row/rail과 3번째 column을 deterministic하게 normalize한다", () => {
    const input = {
      version: 3,
      visibility: {
        nodes: true,
        properties: true,
        history: true,
        unknown: true,
      },
      railOrder: {
        left: ["nodes", "nodes", "unknown"],
        right: ["properties", "history", "properties"],
        bottom: [],
      },
      clusters: [
        {
          id: "cluster:right-primary",
          placementZone: "top-right",
          columns: [
            {
              id: "right:0",
              width: 2000,
              rows: [
                { panelId: "properties", height: 1 },
                { panelId: "properties", height: 9000 },
                { panelId: "unknown", height: 200 },
              ],
            },
            {
              id: "right:1",
              width: 400,
              rows: [{ panelId: "history", height: 9000 }],
            },
            {
              id: "right:2",
              width: 400,
              rows: [{ panelId: "monitor", height: 240 }],
            },
          ],
        },
        {
          id: "cluster:right-duplicate",
          placementZone: "top-right",
          columns: [
            {
              id: "right:duplicate",
              width: 320,
              rows: [{ panelId: "history", height: 450 }],
            },
          ],
        },
        {
          id: "cluster:center",
          placementZone: "center",
          columns: [
            {
              id: "center:0",
              width: 233,
              rows: [{ panelId: "nodes", height: 520 }],
            },
          ],
        },
      ],
      clusterFocusOrder: [
        "cluster:right-primary",
        "cluster:right-primary",
        "missing",
      ],
    };

    const first = parsePanelWorkspaceLayoutV3(
      input,
      PANEL_WORKSPACE_TEST_REGISTRY,
      SURFACE_RECT,
    );
    const second = parsePanelWorkspaceLayoutV3(
      input,
      PANEL_WORKSPACE_TEST_REGISTRY,
      SURFACE_RECT,
    );
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(JSON.stringify(first.value)).toBe(JSON.stringify(second.value));
    expect(
      new Set(first.value.clusters.map((cluster) => cluster.placementZone))
        .size,
    ).toBe(first.value.clusters.length);
    expect(
      first.value.clusters.every((cluster) => cluster.columns.length <= 2),
    ).toBe(true);

    const placed = panelIdsInLayout(first.value);
    const rails = [
      ...first.value.railOrder.left,
      ...first.value.railOrder.right,
      ...first.value.railOrder.bottom,
    ];
    expect(placed).toHaveLength(PANEL_WORKSPACE_TEST_REGISTRY.length);
    expect(new Set(placed).size).toBe(placed.length);
    expect(rails).toHaveLength(PANEL_WORKSPACE_TEST_REGISTRY.length);
    expect(new Set(rails).size).toBe(rails.length);
    expect(first.value.clusterFocusOrder.at(-1)).toBe("cluster:right-primary");
    expect(new Set(first.value.clusterFocusOrder)).toEqual(
      new Set(first.value.clusters.map((cluster) => cluster.id)),
    );

    for (const cluster of first.value.clusters) {
      const totalWidth =
        cluster.columns.reduce((sum, column) => sum + column.width, 0) +
        Math.max(0, cluster.columns.length - 1) * 4;
      expect(totalWidth).toBeLessThanOrEqual(SURFACE_RECT.width);
      for (const column of cluster.columns) {
        const totalHeight =
          column.rows.reduce((sum, row) => sum + row.height, 0) +
          Math.max(0, column.rows.length - 1) * 4;
        expect(totalHeight).toBeLessThanOrEqual(SURFACE_RECT.height);
      }
    }
  });

  it("malformed v3, zero surface와 duplicate registry ID를 거부한다", () => {
    expect(
      parsePanelWorkspaceLayoutV3(
        { version: 3 },
        PANEL_WORKSPACE_TEST_REGISTRY,
        SURFACE_RECT,
      ),
    ).toMatchObject({ ok: false });
    expect(
      createDefaultPanelWorkspaceLayoutV3(PANEL_WORKSPACE_TEST_REGISTRY, {
        width: 0,
        height: 800,
      }),
    ).toMatchObject({ ok: false });
    expect(
      createDefaultPanelWorkspaceLayoutV3(
        [PANEL_WORKSPACE_TEST_REGISTRY[0]!, PANEL_WORKSPACE_TEST_REGISTRY[0]!],
        SURFACE_RECT,
      ),
    ).toMatchObject({ ok: false });
  });
});

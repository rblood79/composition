import { describe, expect, it } from "vitest";
import {
  createDefaultPanelWorkspaceLayoutV3,
  PANEL_WORKSPACE_DEFAULT_ZONE_BY_RAIL,
  PANEL_WORKSPACE_PLACEMENT_ZONES,
  panelWorkspaceZoneOrigin,
  parsePanelWorkspaceLayoutV3,
  solvePanelWorkspaceLayoutV3,
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
  it("9-zone origin을 fit 후 surface local 좌표로 순수 계산한다", () => {
    const clusterSize = { width: 240, height: 160 };
    const expected = [
      [0, 0],
      [480, 0],
      [960, 0],
      [0, 320],
      [480, 320],
      [960, 320],
      [0, 640],
      [480, 640],
      [960, 640],
    ];

    expect(
      PANEL_WORKSPACE_PLACEMENT_ZONES.map((zone) => {
        const origin = panelWorkspaceZoneOrigin(
          zone,
          SURFACE_RECT,
          clusterSize,
        );
        return [origin.x, origin.y];
      }),
    ).toEqual(expected);
  });

  it("right/top/bottom zone은 크기 변경 뒤에도 해당 surface edge를 보존한다", () => {
    const registry = [PANEL_WORKSPACE_TEST_REGISTRY[0]!];
    const createLayout = (
      placementZone: PanelWorkspaceLayoutV3["clusters"][number]["placementZone"],
      width: number,
      height: number,
    ): PanelWorkspaceLayoutV3 => ({
      version: 3,
      visibility: { nodes: true },
      railOrder: { left: ["nodes"], right: [], bottom: [] },
      clusters: [
        {
          id: `zone:${placementZone}`,
          placementZone,
          columns: [
            {
              id: `zone:${placementZone}:column:0`,
              width,
              rows: [{ panelId: "nodes", height }],
            },
          ],
        },
      ],
      clusterFocusOrder: [`zone:${placementZone}`],
    });

    for (const width of [233, 500]) {
      const right = solvePanelWorkspaceLayoutV3(
        createLayout("top-right", width, 160),
        registry,
        SURFACE_RECT,
      );
      expect(right.ok).toBe(true);
      if (!right.ok) continue;
      const geometry = right.value.clusterGeometries.get("zone:top-right")!;
      expect(geometry.x + geometry.width).toBe(SURFACE_RECT.width);
      expect(geometry.y).toBe(0);
    }

    for (const height of [160, 500]) {
      const bottom = solvePanelWorkspaceLayoutV3(
        createLayout("bottom-right", 233, height),
        registry,
        SURFACE_RECT,
      );
      expect(bottom.ok).toBe(true);
      if (!bottom.ok) continue;
      const geometry = bottom.value.clusterGeometries.get("zone:bottom-right")!;
      expect(geometry.x + geometry.width).toBe(SURFACE_RECT.width);
      expect(geometry.y + geometry.height).toBe(SURFACE_RECT.height);
    }
  });

  it("320x180 surface에서 visible frame을 surface 밖으로 내보내지 않는다", () => {
    const layout = createDefaultPanelWorkspaceLayoutV3(
      PANEL_WORKSPACE_TEST_REGISTRY,
      { width: 320, height: 180 },
      Object.fromEntries(
        PANEL_WORKSPACE_TEST_REGISTRY.map((entry) => [entry.id, true]),
      ),
    );
    expect(layout.ok).toBe(true);
    if (!layout.ok) return;
    const solved = solvePanelWorkspaceLayoutV3(
      layout.value,
      PANEL_WORKSPACE_TEST_REGISTRY,
      { width: 320, height: 180 },
    );
    expect(solved.ok).toBe(true);
    if (!solved.ok) return;
    for (const frame of solved.value.frameGeometries.values()) {
      expect(frame.x).toBeGreaterThanOrEqual(0);
      expect(frame.y).toBeGreaterThanOrEqual(0);
      expect(frame.x + frame.width).toBeLessThanOrEqual(320);
      expect(frame.y + frame.height).toBeLessThanOrEqual(180);
    }
  });

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

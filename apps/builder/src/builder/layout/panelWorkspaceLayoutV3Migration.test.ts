import { describe, expect, it } from "vitest";
import type { PanelId } from "../panels/core/types";
import {
  createAdr186TenPlusFloatingFixture,
  ADR_186_SURFACE_RECT_FIXTURE,
} from "./panelWorkspaceAdr186.testFixtures";
import type {
  PanelWorkspaceLayoutV2,
  PanelWorkspaceRegistryEntry,
} from "./panelWorkspaceLayoutV2";
import {
  PANEL_WORKSPACE_TEST_REGISTRY,
  createPanelWorkspaceLayoutV2,
} from "./panelWorkspaceLayoutV2.testFixtures";
import type { PanelWorkspaceLayoutV3 } from "./panelWorkspaceLayoutV3";
import { migratePanelWorkspaceLayoutV2ToV3 } from "./panelWorkspaceLayoutV3Migration";

const SURFACE_RECT = { width: 1200, height: 800 } as const;

function placedPanelIds(layout: PanelWorkspaceLayoutV3): PanelId[] {
  return layout.clusters.flatMap((cluster) =>
    cluster.columns.flatMap((column) => column.rows.map((row) => row.panelId)),
  );
}

function panelIdsAtZone(
  layout: PanelWorkspaceLayoutV3,
  zone: string,
): PanelId[] {
  return (
    layout.clusters
      .find((cluster) => cluster.placementZone === zone)
      ?.columns.flatMap((column) => column.rows.map((row) => row.panelId)) ?? []
  );
}

describe("ADR-186 v2 -> v3 measured-surface migration", () => {
  it("anchored left/right/bottom을 Photoshop default zone으로 매핑한다", () => {
    const result = migratePanelWorkspaceLayoutV2ToV3(
      createPanelWorkspaceLayoutV2(),
      PANEL_WORKSPACE_TEST_REGISTRY,
      { surfaceRect: SURFACE_RECT, migrationId: "migration-anchored" },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.migrationSource).toEqual({
      version: 2,
      migrationId: "migration-anchored",
    });
    expect(
      Object.fromEntries(
        result.value.clusters.map((cluster) => [
          cluster.id,
          cluster.placementZone,
        ]),
      ),
    ).toMatchObject({
      "anchor:left": "top-left",
      "anchor:right": "top-right",
      "anchor:bottom": "bottom",
    });
    expect(JSON.stringify(result.value)).not.toMatch(
      /"(?:position|x|y|anchor)"/,
    );
  });

  it("같은 위치 collision은 tail-topmost cluster가 nearest zone을 선점한다", () => {
    const collisionSurface = { width: 1000, height: 1000 } as const;
    const registry = PANEL_WORKSPACE_TEST_REGISTRY.filter(
      (entry) => entry.id === "nodes" || entry.id === "properties",
    );
    const layout: PanelWorkspaceLayoutV2 = {
      version: 2,
      visibility: { nodes: true, properties: true },
      railOrder: {
        left: ["nodes"],
        right: ["properties"],
        bottom: [],
      },
      clusters: [
        {
          id: "floating:bottommost",
          anchor: "floating",
          position: { x: 0, y: 0 },
          columns: [
            {
              id: "bottommost:0",
              width: 233,
              rows: [{ panelId: "nodes", height: 233 }],
            },
          ],
        },
        {
          id: "floating:topmost",
          anchor: "floating",
          position: { x: 0, y: 0 },
          columns: [
            {
              id: "topmost:0",
              width: 233,
              rows: [{ panelId: "properties", height: 233 }],
            },
          ],
        },
      ],
      floatingFocusOrder: ["floating:bottommost", "floating:topmost"],
    };

    const result = migratePanelWorkspaceLayoutV2ToV3(layout, registry, {
      surfaceRect: collisionSurface,
      migrationId: "migration-collision",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(
      result.value.clusters.find((cluster) => cluster.id === "floating:topmost")
        ?.placementZone,
    ).toBe("top-left");
    expect(
      result.value.clusters.find(
        (cluster) => cluster.id === "floating:bottommost",
      )?.placementZone,
    ).toBe("top");
    expect(result.value.clusterFocusOrder).toEqual([
      "floating:bottommost",
      "floating:topmost",
    ]);
  });

  it("10+ mixed-rail overflow를 persisted rail membership으로 stable route한다", () => {
    const { layout, registry, mixedRailClusterId } =
      createAdr186TenPlusFloatingFixture();
    const first = migratePanelWorkspaceLayoutV2ToV3(layout, registry, {
      surfaceRect: ADR_186_SURFACE_RECT_FIXTURE,
      migrationId: "migration-ten-plus",
    });
    const second = migratePanelWorkspaceLayoutV2ToV3(layout, registry, {
      surfaceRect: ADR_186_SURFACE_RECT_FIXTURE,
      migrationId: "migration-ten-plus",
    });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(JSON.stringify(first.value)).toBe(JSON.stringify(second.value));
    expect(first.value.clusters).toHaveLength(9);
    expect(
      first.value.clusters.some(({ id }) => id === mixedRailClusterId),
    ).toBe(false);
    expect(panelIdsAtZone(first.value, "top-left")).toEqual([
      "components",
      "nodes",
    ]);
    expect(panelIdsAtZone(first.value, "top-right")).toEqual([
      "datatable",
      "properties",
    ]);
    expect(panelIdsAtZone(first.value, "bottom")).toEqual([
      "events",
      "monitor",
    ]);
    expect(first.value.clusterFocusOrder).toEqual([
      "floating:top-left",
      "floating:top",
      "floating:top-right",
      "floating:left",
      "floating:center",
      "floating:right",
      "floating:bottom-left",
      "floating:bottom",
      "floating:bottom-right",
    ]);

    const placed = placedPanelIds(first.value);
    const rails = [
      ...first.value.railOrder.left,
      ...first.value.railOrder.right,
      ...first.value.railOrder.bottom,
    ];
    expect(new Set(placed).size).toBe(registry.length);
    expect(new Set(rails)).toEqual(new Set(placed));
    expect(first.value.visibility.settings).toBe(false);
  });

  it("registry add/remove 뒤에도 등록 panel을 row와 rail에 정확히 한 번 둔다", () => {
    const registry: PanelWorkspaceRegistryEntry[] = [
      ...PANEL_WORKSPACE_TEST_REGISTRY.filter(
        (entry) => entry.id !== "monitor",
      ),
      {
        id: "ai",
        defaultPosition: "right",
        minWidth: 233,
        maxWidth: 640,
        defaultWidth: 320,
        minHeight: 160,
        maxHeight: 800,
        defaultHeight: 500,
      },
    ];
    const result = migratePanelWorkspaceLayoutV2ToV3(
      createPanelWorkspaceLayoutV2(),
      registry,
      { surfaceRect: SURFACE_RECT, migrationId: "migration-registry" },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const placed = placedPanelIds(result.value);
    const rails = [
      ...result.value.railOrder.left,
      ...result.value.railOrder.right,
      ...result.value.railOrder.bottom,
    ];
    expect(placed).toHaveLength(registry.length);
    expect(new Set(placed).size).toBe(registry.length);
    expect(new Set(rails)).toEqual(new Set(placed));
    expect(placed).toContain("ai");
    expect(placed).not.toContain("monitor");
  });

  it("malformed v2, empty migrationId와 non-zero가 아닌 measured surface를 거부한다", () => {
    expect(
      migratePanelWorkspaceLayoutV2ToV3(
        { version: 2 },
        PANEL_WORKSPACE_TEST_REGISTRY,
        { surfaceRect: SURFACE_RECT, migrationId: "migration-malformed" },
      ),
    ).toMatchObject({ ok: false });
    expect(
      migratePanelWorkspaceLayoutV2ToV3(
        createPanelWorkspaceLayoutV2(),
        PANEL_WORKSPACE_TEST_REGISTRY,
        { surfaceRect: SURFACE_RECT, migrationId: "" },
      ),
    ).toMatchObject({ ok: false });
    expect(
      migratePanelWorkspaceLayoutV2ToV3(
        createPanelWorkspaceLayoutV2(),
        PANEL_WORKSPACE_TEST_REGISTRY,
        {
          surfaceRect: { width: 0, height: 800 },
          migrationId: "migration-zero",
        },
      ),
    ).toMatchObject({ ok: false });
  });
});

import { describe, expect, it } from "vitest";
import {
  PANEL_WORKSPACE_TEST_REGISTRY,
  createPanelWorkspaceLayoutV2,
} from "./panelWorkspaceLayoutV2.testFixtures";
import { migratePanelWorkspaceLayoutV2ToV3 } from "./panelWorkspaceLayoutV3Migration";
import { migratePanelWorkspaceLayoutV3ToV4 } from "./panelWorkspaceLayoutV4Migration";

const SURFACE_RECT = { width: 1200, height: 800 } as const;

function legacyV3Raw(): Record<string, unknown> {
  const v3 = migratePanelWorkspaceLayoutV2ToV3(
    createPanelWorkspaceLayoutV2(),
    PANEL_WORKSPACE_TEST_REGISTRY,
    { surfaceRect: SURFACE_RECT, migrationId: "fixture-v2-v3" },
  );
  if (!v3.ok) throw new Error(v3.error);
  return JSON.parse(
    JSON.stringify(v3.value).replaceAll('"navigator"', '"nodes"'),
  ) as Record<string, unknown>;
}

describe("PanelWorkspaceLayout v3 -> v4 Navigator ID migration", () => {
  it("visibility/rail/row ID를 올리고 geometry와 cluster identity를 보존한다", () => {
    const raw = legacyV3Raw();
    const before = structuredClone(raw) as {
      clusters: Array<{
        id: string;
        columns: Array<{
          width: number;
          rows: Array<{ panelId: string; height: number }>;
        }>;
      }>;
      clusterFocusOrder: string[];
    };
    const result = migratePanelWorkspaceLayoutV3ToV4(
      raw,
      PANEL_WORKSPACE_TEST_REGISTRY,
      { surfaceRect: SURFACE_RECT, migrationId: "fixture-v3-v4" },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      version: 4,
      migrationSource: { version: 3, migrationId: "fixture-v3-v4" },
      visibility: { navigator: true },
    });
    expect(result.value.railOrder.left).toContain("navigator");
    expect(JSON.stringify(result.value)).not.toContain('"nodes"');
    expect(result.value.clusterFocusOrder).toEqual(before.clusterFocusOrder);
    expect(
      result.value.clusters.map((cluster) => ({
        id: cluster.id,
        columns: cluster.columns.map((column) => ({
          width: column.width,
          heights: column.rows.map((row) => row.height),
        })),
      })),
    ).toEqual(
      before.clusters.map((cluster) => ({
        id: cluster.id,
        columns: cluster.columns.map((column) => ({
          width: column.width,
          heights: column.rows.map((row) => row.height),
        })),
      })),
    );
  });

  it("mixed ID는 canonical navigator 값과 placement를 우선하고 중복을 제거한다", () => {
    const raw = legacyV3Raw() as {
      visibility: Record<string, boolean>;
      railOrder: { left: string[]; right: string[]; bottom: string[] };
      clusters: Array<{
        columns: Array<{
          rows: Array<{ panelId: string; height: number }>;
        }>;
      }>;
    };
    raw.visibility.nodes = true;
    raw.visibility.navigator = false;
    raw.railOrder.left = ["nodes", "navigator", ...raw.railOrder.left];
    raw.clusters[0]!.columns[0]!.rows.push({
      panelId: "navigator",
      height: 321,
    });

    const result = migratePanelWorkspaceLayoutV3ToV4(
      raw,
      PANEL_WORKSPACE_TEST_REGISTRY,
      { surfaceRect: SURFACE_RECT, migrationId: "mixed-v3-v4" },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.visibility.navigator).toBe(false);
    expect(
      result.value.railOrder.left.filter((id) => id === "navigator"),
    ).toHaveLength(1);
    const rows = result.value.clusters.flatMap((cluster) =>
      cluster.columns.flatMap((column) => column.rows),
    );
    expect(rows.filter((row) => row.panelId === "navigator")).toEqual([
      { panelId: "navigator", height: 321 },
    ]);
  });

  it("empty migration id는 layout을 만들지 않고 거부한다", () => {
    expect(
      migratePanelWorkspaceLayoutV3ToV4(
        legacyV3Raw(),
        PANEL_WORKSPACE_TEST_REGISTRY,
        { surfaceRect: SURFACE_RECT, migrationId: "" },
      ),
    ).toEqual({ ok: false, error: "Migration id is empty" });
  });
});

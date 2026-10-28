import { describe, expect, it } from "vitest";
import { normalizePanelWorkspaceLayoutV4 } from "./panelWorkspaceLayoutV4";
import { PANEL_WORKSPACE_TEST_REGISTRY } from "./panelWorkspaceLayoutV2.testFixtures";
import {
  PANEL_WORKSPACE_TEST_SURFACE_RECT,
  createPanelWorkspaceLayoutV4Fixture,
} from "./panelWorkspaceLayoutV4.testFixtures";

/**
 * ADR-288 Phase 0 ③ (R3 · G3): a saved v4 layout that still holds the removed panel ids
 * (`datatableEditor` · `datatableField` — merged into `datatable`) opens as if they were never
 * there: the normalizer drops an id the registry does not know from the rail order, the
 * visibility map and every column row, and keeps the rest. No ignore path is needed.
 */
const REMOVED = ["datatableEditor", "datatableField"] as const;

describe("ADR-288 — a saved layout with removed panel ids", () => {
  it("normalizes to the registered panels only (the removed ids vanish, nothing throws)", () => {
    // The registry after Phase 3 — the two editor panels are not registered any more.
    const registry = PANEL_WORKSPACE_TEST_REGISTRY;
    expect(
      registry.some((entry) =>
        (REMOVED as readonly string[]).includes(entry.id),
      ),
    ).toBe(false);
    const saved = createPanelWorkspaceLayoutV4Fixture();
    const kept = saved.clusters[0]!.columns[0]!.rows[0]!.panelId;
    const legacy = {
      ...saved,
      visibility: {
        ...saved.visibility,
        datatableEditor: true,
        datatableField: true,
      },
      railOrder: {
        ...saved.railOrder,
        left: [...saved.railOrder.left, ...REMOVED],
      },
      clusters: saved.clusters.map((cluster, index) =>
        index === 0
          ? {
              ...cluster,
              columns: [
                {
                  ...cluster.columns[0]!,
                  rows: [
                    ...cluster.columns[0]!.rows,
                    { panelId: "datatableEditor", height: 600 },
                  ],
                },
                ...cluster.columns.slice(1),
                {
                  id: "legacy:field",
                  width: 260,
                  rows: [{ panelId: "datatableField", height: 600 }],
                },
              ],
            }
          : cluster,
      ),
    } as typeof saved;

    const result = normalizePanelWorkspaceLayoutV4(
      legacy,
      registry,
      PANEL_WORKSPACE_TEST_SURFACE_RECT,
    );
    if (!result.ok) throw new Error(result.error);
    const text = JSON.stringify(result.value);
    for (const removed of REMOVED) expect(text).not.toContain(removed);
    const rows = result.value.clusters.flatMap((cluster) =>
      cluster.columns.flatMap((column) =>
        column.rows.map((row) => row.panelId),
      ),
    );
    expect(rows).toContain(kept);
    expect(new Set(rows).size).toBe(rows.length);
    expect(Object.keys(result.value.visibility).sort()).toEqual(
      registry.map((entry) => entry.id).sort(),
    );
  });
});

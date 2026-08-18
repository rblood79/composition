import { describe, expect, it } from "vitest";
import type { PanelId } from "../panels/core/types";
import {
  MIN_PANEL_WORKSPACE_MAIN_HEIGHT,
  MIN_PANEL_WORKSPACE_MAIN_WIDTH,
  PANEL_WORKSPACE_GAP,
  normalizePanelWorkspaceLayoutV2,
  parsePanelWorkspaceLayoutV2,
  solvePanelWorkspaceLayoutV2,
  type PanelWorkspaceLayoutV2,
} from "./panelWorkspaceLayoutV2";
import {
  PANEL_WORKSPACE_TEST_REGISTRY,
  createPanelWorkspaceLayoutV2,
} from "./panelWorkspaceLayoutV2.testFixtures";

function panelOccurrences(
  layout: PanelWorkspaceLayoutV2,
): Map<PanelId, number> {
  const occurrences = new Map<PanelId, number>();
  for (const cluster of layout.clusters) {
    for (const column of cluster.columns) {
      for (const row of column.rows) {
        occurrences.set(row.panelId, (occurrences.get(row.panelId) ?? 0) + 1);
      }
    }
  }
  return occurrences;
}

describe("ADR-922 PanelWorkspaceLayoutV2 model", () => {
  it("valid v2 record를 idempotent하게 parse한다", () => {
    const input = createPanelWorkspaceLayoutV2();
    const first = parsePanelWorkspaceLayoutV2(
      input,
      PANEL_WORKSPACE_TEST_REGISTRY,
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = parsePanelWorkspaceLayoutV2(
      first.value,
      PANEL_WORKSPACE_TEST_REGISTRY,
    );
    expect(second).toEqual(first);
    expect(first.value).toEqual(input);
  });

  it("unknown/duplicate panel과 3번째 column을 정규화해 registry panel을 정확히 한 번 둔다", () => {
    const input = createPanelWorkspaceLayoutV2() as PanelWorkspaceLayoutV2 & {
      visibility: Record<string, boolean>;
    };
    input.visibility.removed = true;
    input.railOrder.left.push("nodes", "removed" as PanelId);
    input.clusters[0]!.columns[0]!.rows =
      input.clusters[0]!.columns[0]!.rows.filter(
        (row) => row.panelId !== "settings",
      );
    input.clusters[0]?.columns.push(
      {
        id: "extra:1",
        width: 10,
        rows: [
          { panelId: "nodes", height: 10 },
          { panelId: "removed" as PanelId, height: 10 },
        ],
      },
      {
        id: "extra:2",
        width: 5000,
        rows: [{ panelId: "settings", height: 5000 }],
      },
    );

    const result = normalizePanelWorkspaceLayoutV2(
      input,
      PANEL_WORKSPACE_TEST_REGISTRY,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.clusters[0]?.columns).toHaveLength(2);
    expect(Object.keys(result.value.visibility)).not.toContain("removed");
    expect(result.value.railOrder.left).toEqual([
      "nodes",
      "datatableEditor",
      "settings",
    ]);
    expect([...panelOccurrences(result.value).values()]).toEqual(
      Array(PANEL_WORKSPACE_TEST_REGISTRY.length).fill(1),
    );
  });

  it("registry add/remove 뒤 기존 known geometry/order를 보존하고 신규 panel만 default로 추가한다", () => {
    const previousRegistry = PANEL_WORKSPACE_TEST_REGISTRY.filter(
      ({ id }) => id !== "history",
    );
    const previous = normalizePanelWorkspaceLayoutV2(
      createPanelWorkspaceLayoutV2(),
      previousRegistry,
    );
    expect(previous.ok).toBe(true);
    if (!previous.ok) return;

    const evolved = parsePanelWorkspaceLayoutV2(
      previous.value,
      PANEL_WORKSPACE_TEST_REGISTRY,
    );
    expect(evolved.ok).toBe(true);
    if (!evolved.ok) return;

    expect(evolved.value.visibility.history).toBe(false);
    expect(evolved.value.railOrder.right.at(-1)).toBe("history");
    const withoutHistory = structuredClone(evolved.value);
    withoutHistory.visibility.history = undefined;
    withoutHistory.railOrder.right = withoutHistory.railOrder.right.filter(
      (id) => id !== "history",
    );
    for (const cluster of withoutHistory.clusters) {
      for (const column of cluster.columns) {
        column.rows = column.rows.filter((row) => row.panelId !== "history");
      }
    }
    expect(withoutHistory).toEqual(previous.value);

    const removedRegistry = PANEL_WORKSPACE_TEST_REGISTRY.filter(
      ({ id }) => id !== "settings",
    );
    const removed = parsePanelWorkspaceLayoutV2(evolved.value, removedRegistry);
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect(panelOccurrences(removed.value).has("settings")).toBe(false);
    expect(removed.value.railOrder.left).not.toContain("settings");
  });

  it("duplicate registry ID를 input boundary에서 거부한다", () => {
    const result = parsePanelWorkspaceLayoutV2(createPanelWorkspaceLayoutV2(), [
      ...PANEL_WORKSPACE_TEST_REGISTRY,
      PANEL_WORKSPACE_TEST_REGISTRY[0]!,
    ]);

    expect(result).toEqual({
      ok: false,
      error: 'Duplicate panel registry id "nodes"',
    });
  });
});

describe("ADR-922 PanelWorkspaceLayoutV2 constrained solver", () => {
  it("railOrder가 빈 side는 rendered rail inset을 0으로 파생한다", () => {
    const layout = createPanelWorkspaceLayoutV2();
    layout.railOrder.bottom = [];
    layout.railOrder.right.push("monitor");

    const result = solvePanelWorkspaceLayoutV2(
      layout,
      PANEL_WORKSPACE_TEST_REGISTRY,
      {
        workspaceRect: { width: 1600, height: 900 },
        railSizes: { left: 48, right: 48, bottom: 48 },
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.occupiedInsets.bottom).toBe(0);
    expect(result.value.mainContentRect.height).toBe(900);
  });

  it("visible anchored cluster와 rail만 occupied inset에 포함한다", () => {
    const layout = createPanelWorkspaceLayoutV2();
    const result = solvePanelWorkspaceLayoutV2(
      layout,
      PANEL_WORKSPACE_TEST_REGISTRY,
      {
        workspaceRect: { width: 1600, height: 900 },
        railSizes: { left: 48, right: 48, bottom: 32 },
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.occupiedInsets).toEqual({
      left: 48 + PANEL_WORKSPACE_GAP + 490,
      right: 48 + PANEL_WORKSPACE_GAP + 320,
      bottom: 32,
    });
    expect(result.value.mainContentRect.width).toBeGreaterThanOrEqual(
      MIN_PANEL_WORKSPACE_MAIN_WIDTH,
    );
    expect(result.value.mainContentRect.height).toBeGreaterThanOrEqual(
      MIN_PANEL_WORKSPACE_MAIN_HEIGHT,
    );
  });

  it("800px viewport에서는 right를 유지하고 left를 overlay한 뒤 확장 시 원 anchor로 복귀한다", () => {
    const layout = createPanelWorkspaceLayoutV2();
    layout.visibility.nodes = false;
    layout.visibility.datatableEditor = true;
    const persistedBefore = structuredClone(layout);

    const constrained = solvePanelWorkspaceLayoutV2(
      layout,
      PANEL_WORKSPACE_TEST_REGISTRY,
      {
        workspaceRect: { width: 800, height: 900 },
        railSizes: { left: 48, right: 48, bottom: 32 },
      },
    );
    expect(constrained.ok).toBe(true);
    if (!constrained.ok) return;
    expect(constrained.value.presentations.left).toBe("constrained-overlay");
    expect(constrained.value.presentations.right).toBe("anchored");
    expect(constrained.value.occupiedInsets.left).toBe(48);
    expect(constrained.value.mainContentRect.width).toBeGreaterThanOrEqual(0);
    for (const geometry of constrained.value.frameGeometries.values()) {
      expect(geometry.x).toBeGreaterThanOrEqual(0);
      expect(geometry.y).toBeGreaterThanOrEqual(0);
      expect(geometry.x + geometry.width).toBeLessThanOrEqual(800);
      expect(geometry.y + geometry.height).toBeLessThanOrEqual(900);
    }

    const expanded = solvePanelWorkspaceLayoutV2(
      layout,
      PANEL_WORKSPACE_TEST_REGISTRY,
      {
        workspaceRect: { width: 1400, height: 900 },
        railSizes: { left: 48, right: 48, bottom: 32 },
      },
    );
    expect(expanded.ok).toBe(true);
    if (!expanded.ok) return;
    expect(expanded.value.presentations.left).toBe("anchored");
    expect(layout).toEqual(persistedBefore);
  });

  it("bottom demand가 main reservation을 침범하면 persisted size를 바꾸지 않고 overlay한다", () => {
    const layout = createPanelWorkspaceLayoutV2();
    layout.visibility.monitor = true;
    const persistedBefore = structuredClone(layout);

    const result = solvePanelWorkspaceLayoutV2(
      layout,
      PANEL_WORKSPACE_TEST_REGISTRY,
      {
        workspaceRect: { width: 1000, height: 400 },
        railSizes: { left: 48, right: 48, bottom: 32 },
      },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.presentations.bottom).toBe("constrained-overlay");
    expect(result.value.occupiedInsets.bottom).toBe(32);
    expect(result.value.mainContentRect.height).toBeGreaterThanOrEqual(0);
    expect(layout).toEqual(persistedBefore);
  });

  it("workspace가 panel min보다 작아도 emergency presentation geometry는 viewport를 넘지 않는다", () => {
    const layout = createPanelWorkspaceLayoutV2();
    for (const panelId of Object.keys(layout.visibility) as PanelId[]) {
      layout.visibility[panelId] = panelId === "monitor";
    }

    const result = solvePanelWorkspaceLayoutV2(
      layout,
      PANEL_WORKSPACE_TEST_REGISTRY,
      {
        workspaceRect: { width: 200, height: 120 },
        railSizes: { left: 24, right: 24, bottom: 20 },
      },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const monitor = result.value.frameGeometries.get("monitor");
    expect(monitor).toBeDefined();
    expect((monitor?.x ?? 0) + (monitor?.width ?? 0)).toBeLessThanOrEqual(200);
    expect((monitor?.y ?? 0) + (monitor?.height ?? 0)).toBeLessThanOrEqual(120);
    expect(result.value.mainContentRect.width).toBeGreaterThanOrEqual(0);
    expect(result.value.mainContentRect.height).toBeGreaterThanOrEqual(0);
  });
});

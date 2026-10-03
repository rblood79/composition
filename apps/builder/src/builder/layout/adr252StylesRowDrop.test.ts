// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useBuilderUiStore } from "../stores/builderUiStore";
import type { PanelId } from "../panels/core/types";
import type { PanelWorkspaceRegistryEntry } from "./panelWorkspaceLayoutV2";
import { PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY } from "./panelWorkspaceLayoutV2Persistence";
import { createDefaultPanelWorkspaceLayoutV4 } from "./panelWorkspaceLayoutV4";

/**
 * ADR-252 G3 — a saved V4 layout from before the Design panel (rows `properties` and `styles` in
 * one column, `styles` on top) opens on the registry without `styles`: the `properties` placement
 * keys (zone · cluster · column · row height · visibility) stay, the `styles` row drops without an
 * error, and the hydration is `ready` (not `memory-fallback`). The screen position of `properties`
 * may move up into the dropped row's place — that is the normal re-stack (review l2).
 */
const SURFACE = { width: 1400, height: 900 };
const entry = (
  id: string,
  defaultPosition: PanelWorkspaceRegistryEntry["defaultPosition"],
  minWidth = 233,
): PanelWorkspaceRegistryEntry => ({
  id: id as PanelId,
  defaultPosition,
  minWidth,
  maxWidth: 640,
  defaultWidth: minWidth,
  minHeight: 160,
  maxHeight: 800,
  defaultHeight: 300,
});
const BEFORE = [
  entry("navigator", "left"),
  entry("properties", "right"),
  entry("styles", "right"),
  entry("events", "right"),
];
const AFTER = [
  entry("navigator", "left"),
  entry("properties", "right", 264),
  entry("events", "right"),
];

function savedLayoutWithStylesAbove() {
  const created = createDefaultPanelWorkspaceLayoutV4(BEFORE, SURFACE, {
    properties: true,
    styles: true,
  } as Partial<Record<PanelId, boolean>>);
  if (!created.ok) throw new Error(created.error);
  const layout = structuredClone(created.value);
  const cluster = layout.clusters.find((c) =>
    c.columns.some((col) => col.rows.some((r) => r.panelId === "properties")),
  )!;
  cluster.columns[0]!.width = 300;
  cluster.columns[0]!.rows = [
    { panelId: "styles" as PanelId, height: 340 },
    { panelId: "properties", height: 410 },
    { panelId: "events", height: 300 },
  ];
  return { layout, cluster };
}

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("ADR-252 G3 — saved `styles` row", () => {
  it("keeps the properties placement keys, drops styles, hydrates ready", () => {
    const { layout, cluster } = savedLayoutWithStylesAbove();
    localStorage.setItem(
      PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY,
      JSON.stringify(layout),
    );
    useBuilderUiStore.setState({ panelWorkspaceLayout: null });

    useBuilderUiStore.getState().initializePanelWorkspaceLayout(AFTER, SURFACE);

    const state = useBuilderUiStore.getState();
    expect(state.panelWorkspaceHydrationStatus).toBe("ready");
    const next = state.panelWorkspaceLayout!;
    const rows = next.clusters.flatMap((c) =>
      c.columns.flatMap((col) => col.rows.map((r) => r.panelId)),
    );
    expect(rows).not.toContain("styles");
    expect(Object.keys(next.visibility)).not.toContain("styles");
    expect(Object.values(next.railOrder).flat()).not.toContain("styles");

    const kept = next.clusters.find((c) => c.id === cluster.id)!;
    expect(kept.placementZone).toBe(cluster.placementZone);
    expect(kept.columns[0]!.id).toBe(cluster.columns[0]!.id);
    expect(kept.columns[0]!.width).toBe(300);
    expect(kept.columns[0]!.rows).toEqual([
      { panelId: "properties", height: 410 },
      { panelId: "events", height: 300 },
    ]);
    expect(next.visibility.properties).toBe(true);
  });
});

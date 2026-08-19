import { describe, expect, it, vi } from "vitest";
import type { PanelFrameGeometry } from "../panels/core/types";
import {
  PANEL_WORKSPACE_TEST_REGISTRY,
  createPanelWorkspaceLayoutV2,
} from "./panelWorkspaceLayoutV2.testFixtures";
import {
  PANEL_WORKSPACE_PLACEMENT_ZONES,
  solvePanelWorkspaceLayoutV3,
  type PanelWorkspaceLayoutV3,
  type PanelWorkspacePlacementZone,
} from "./panelWorkspaceLayoutV3";
import { migratePanelWorkspaceLayoutV2ToV3 } from "./panelWorkspaceLayoutV3Migration";
import {
  beginPanelWorkspaceDragSession,
  commitPanelWorkspaceDragSession,
  updatePanelWorkspaceDragSession,
} from "./panelWorkspaceZoneDrop";

const SURFACE = { width: 1200, height: 800 } as const;

function createV3Layout(): PanelWorkspaceLayoutV3 {
  const migrated = migratePanelWorkspaceLayoutV2ToV3(
    createPanelWorkspaceLayoutV2(),
    PANEL_WORKSPACE_TEST_REGISTRY,
    { surfaceRect: SURFACE, migrationId: "phase-3-test" },
  );
  if (!migrated.ok) throw new Error(migrated.error);
  return migrated.value;
}

function frameFor(
  layout: PanelWorkspaceLayoutV3,
  panelId: "nodes" | "properties",
): PanelFrameGeometry {
  const solved = solvePanelWorkspaceLayoutV3(
    layout,
    PANEL_WORKSPACE_TEST_REGISTRY,
    SURFACE,
  );
  if (!solved.ok) throw new Error(solved.error);
  const frame = solved.value.frameGeometries.get(panelId);
  if (!frame) throw new Error(`Missing frame for ${panelId}`);
  return frame;
}

function zonePoint(zone: PanelWorkspacePlacementZone): {
  x: number;
  y: number;
} {
  const column =
    zone.endsWith("left") || zone === "left"
      ? 0
      : zone.endsWith("right") || zone === "right"
        ? 2
        : 1;
  const row =
    zone.startsWith("top") || zone === "top"
      ? 0
      : zone.startsWith("bottom") || zone === "bottom"
        ? 2
        : 1;
  return {
    x: ((column + 0.5) * SURFACE.width) / 3,
    y: ((row + 0.5) * SURFACE.height) / 3,
  };
}

describe("ADR-186 Phase 3 panel workspace zone drop", () => {
  it.each(PANEL_WORKSPACE_PLACEMENT_ZONES)(
    "%s hit region은 panel edge가 없을 때 단일 zone candidate를 만든다",
    (zone) => {
      const layout = createV3Layout();
      for (const panelId of Object.keys(layout.visibility)) {
        layout.visibility[panelId as keyof typeof layout.visibility] =
          panelId === "properties";
      }
      const frame = frameFor(layout, "properties");
      const session = beginPanelWorkspaceDragSession(
        layout,
        PANEL_WORKSPACE_TEST_REGISTRY,
        SURFACE,
        "properties",
      );
      expect(session.ok).toBe(true);
      if (!session.ok) return;

      const updated = updatePanelWorkspaceDragSession(
        session.value,
        PANEL_WORKSPACE_TEST_REGISTRY,
        SURFACE,
        frame,
        zonePoint(zone),
      );

      expect(updated.ok).toBe(true);
      if (!updated.ok) return;
      expect(updated.value.candidate).toEqual({ kind: "zone", zone });
    },
  );

  it("panel adjacency를 zone보다 우선하고 가능한 outer face 하나만 반환한다", () => {
    const layout = createV3Layout();
    const target = frameFor(layout, "nodes");
    const source = frameFor(layout, "properties");
    const session = beginPanelWorkspaceDragSession(
      layout,
      PANEL_WORKSPACE_TEST_REGISTRY,
      SURFACE,
      "properties",
    );
    expect(session.ok).toBe(true);
    if (!session.ok) return;

    const preview = {
      ...source,
      x: target.x,
      y: target.y + target.height + 4,
    };
    const updated = updatePanelWorkspaceDragSession(
      session.value,
      PANEL_WORKSPACE_TEST_REGISTRY,
      SURFACE,
      preview,
      { x: preview.x + preview.width / 2, y: preview.y },
    );

    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.value.candidate).toEqual({
      kind: "panel-edge",
      panelId: "nodes",
      edge: "bottom",
    });
  });

  it("같은 column의 내부 row 경계는 panel-edge 후보로 노출하지 않는다", () => {
    const layout = createV3Layout();
    layout.visibility.settings = true;
    const target = frameFor(layout, "nodes");
    const source = frameFor(layout, "properties");
    const session = beginPanelWorkspaceDragSession(
      layout,
      PANEL_WORKSPACE_TEST_REGISTRY,
      SURFACE,
      "properties",
    );
    expect(session.ok).toBe(true);
    if (!session.ok) return;

    const preview = {
      ...source,
      x: target.x,
      y: target.y + target.height + 4,
    };
    const updated = updatePanelWorkspaceDragSession(
      session.value,
      PANEL_WORKSPACE_TEST_REGISTRY,
      SURFACE,
      preview,
      { x: preview.x + preview.width / 2, y: preview.y },
    );

    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.value.candidate).not.toEqual({
      kind: "panel-edge",
      panelId: "nodes",
      edge: "bottom",
    });
  });

  it("valid panel-edge drop은 target cluster에 한 번 commit하고 rail identity를 유지한다", () => {
    const layout = createV3Layout();
    const target = frameFor(layout, "nodes");
    const source = frameFor(layout, "properties");
    const session = beginPanelWorkspaceDragSession(
      layout,
      PANEL_WORKSPACE_TEST_REGISTRY,
      SURFACE,
      "properties",
    );
    expect(session.ok).toBe(true);
    if (!session.ok) return;
    const preview = {
      ...source,
      x: target.x,
      y: target.y + target.height + 4,
    };
    const updated = updatePanelWorkspaceDragSession(
      session.value,
      PANEL_WORKSPACE_TEST_REGISTRY,
      SURFACE,
      preview,
      { x: preview.x + preview.width / 2, y: preview.y },
    );
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;

    const committed = commitPanelWorkspaceDragSession(
      updated.value,
      PANEL_WORKSPACE_TEST_REGISTRY,
      SURFACE,
    );

    expect(committed.ok).toBe(true);
    if (!committed.ok) return;
    expect(committed.value).toMatchObject({
      committed: true,
      commitCount: 1,
    });
    const targetCluster = committed.value.layout.clusters.find((cluster) =>
      cluster.columns.some((column) =>
        column.rows.some((row) => row.panelId === "nodes"),
      ),
    );
    expect(targetCluster?.placementZone).toBe("top-left");
    expect(
      targetCluster?.columns.flatMap((column) =>
        column.rows.map((row) => row.panelId),
      ),
    ).toEqual(["nodes", "properties", "datatableEditor", "settings"]);
    expect(committed.value.layout.railOrder).toEqual(layout.railOrder);
  });

  it("valid zone drop은 target zone graph만 한 번 commit하고 persisted XY를 만들지 않는다", () => {
    const layout = createV3Layout();
    for (const panelId of Object.keys(layout.visibility)) {
      layout.visibility[panelId as keyof typeof layout.visibility] =
        panelId === "properties";
    }
    const baseRaw = JSON.stringify(layout);
    const frame = frameFor(layout, "properties");
    const session = beginPanelWorkspaceDragSession(
      layout,
      PANEL_WORKSPACE_TEST_REGISTRY,
      SURFACE,
      "properties",
    );
    expect(session.ok).toBe(true);
    if (!session.ok) return;
    const updated = updatePanelWorkspaceDragSession(
      session.value,
      PANEL_WORKSPACE_TEST_REGISTRY,
      SURFACE,
      { ...frame, x: 500, y: 350 },
      zonePoint("center"),
    );
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;

    expect(JSON.stringify(updated.value.baseLayout)).toBe(baseRaw);
    const committed = commitPanelWorkspaceDragSession(
      updated.value,
      PANEL_WORKSPACE_TEST_REGISTRY,
      SURFACE,
    );

    expect(committed.ok).toBe(true);
    if (!committed.ok) return;
    expect(committed.value.committed).toBe(true);
    expect(committed.value.commitCount).toBe(1);
    expect(
      committed.value.layout.clusters.find((cluster) =>
        cluster.columns.some((column) =>
          column.rows.some((row) => row.panelId === "properties"),
        ),
      )?.placementZone,
    ).toBe("center");
    expect(JSON.stringify(committed.value.layout)).not.toMatch(
      /"(?:position|x|y)"\s*:/,
    );
    expect(committed.value.layout.railOrder).toEqual(layout.railOrder);
  });

  it("null candidate는 byte-equivalent base graph로 rollback하고 commit 0을 반환한다", () => {
    const layout = createV3Layout();
    const baseRaw = JSON.stringify(layout);
    const session = beginPanelWorkspaceDragSession(
      layout,
      PANEL_WORKSPACE_TEST_REGISTRY,
      SURFACE,
      "properties",
    );
    expect(session.ok).toBe(true);
    if (!session.ok) return;

    const committed = commitPanelWorkspaceDragSession(
      { ...session.value, candidate: null },
      PANEL_WORKSPACE_TEST_REGISTRY,
      SURFACE,
    );

    expect(committed.ok).toBe(true);
    if (!committed.ok) return;
    expect(committed.value).toMatchObject({
      committed: false,
      commitCount: 0,
    });
    expect(JSON.stringify(committed.value.layout)).toBe(baseRaw);
  });

  it("candidate hot path는 DOM geometry query 없이 반복 평가된다", () => {
    const layout = createV3Layout();
    const frame = frameFor(layout, "properties");
    const session = beginPanelWorkspaceDragSession(
      layout,
      PANEL_WORKSPACE_TEST_REGISTRY,
      SURFACE,
      "properties",
    );
    expect(session.ok).toBe(true);
    if (!session.ok) return;
    const query = vi.spyOn(Element.prototype, "getBoundingClientRect");
    let current = session.value;

    for (let index = 0; index < 300; index += 1) {
      const updated = updatePanelWorkspaceDragSession(
        current,
        PANEL_WORKSPACE_TEST_REGISTRY,
        SURFACE,
        { ...frame, x: index, y: index / 2 },
        { x: index + 10, y: index / 2 + 10 },
      );
      expect(updated.ok).toBe(true);
      if (!updated.ok) break;
      current = updated.value;
    }

    expect(query).not.toHaveBeenCalled();
    query.mockRestore();
  });
});

import { describe, expect, it } from "vitest";
import type { PanelId } from "../panels/core/types";
import {
  createDefaultPanelWorkspaceLayoutV4,
  solvePanelWorkspaceLayoutV4,
  type PanelWorkspaceLayoutV4,
  type PanelWorkspacePlacementZone,
} from "./panelWorkspaceLayoutV4";
import {
  activatePanelWorkspacePanelV4,
  resetPanelWorkspaceLayoutV4,
  resizePanelWorkspaceBoundaryV4,
} from "./panelWorkspacePolicyV4";
import {
  beginPanelWorkspaceDragSession,
  commitPanelWorkspaceDragSession,
  updatePanelWorkspaceDragSession,
} from "./panelWorkspaceZoneDrop";
import type { PanelWorkspaceRegistryEntry } from "./panelWorkspaceLayoutV2";

const SURFACE_RECT = { width: 1200, height: 204 } as const;
const ZONES = [
  "top-left",
  "top",
  "top-right",
  "left",
  "center",
  "right",
  "bottom-left",
  "bottom",
  "bottom-right",
] as const satisfies readonly PanelWorkspacePlacementZone[];
const OUTER_RESIZE_CASES = [
  { edge: "left", deltaX: -40, deltaY: 0, width: 240, height: 100 },
  { edge: "right", deltaX: 40, deltaY: 0, width: 240, height: 100 },
  { edge: "top", deltaX: 0, deltaY: -30, width: 200, height: 130 },
  { edge: "bottom", deltaX: 0, deltaY: 30, width: 200, height: 130 },
] as const;

const REGISTRY: PanelWorkspaceRegistryEntry[] = [
  registryEntry("navigator", "left"),
  registryEntry("components", "left"),
  registryEntry("settings", "left"),
  registryEntry("properties", "right"),
  registryEntry("styles", "right"),
  registryEntry("history", "right"),
  registryEntry("monitor", "bottom"),
];

function registryEntry(
  id: PanelId,
  defaultPosition: "left" | "right" | "bottom",
): PanelWorkspaceRegistryEntry {
  return {
    id,
    defaultPosition,
    minWidth: 80,
    maxWidth: 640,
    defaultWidth: 200,
    minHeight: 60,
    maxHeight: 800,
    defaultHeight: 100,
  };
}

function requireLayout(
  result: ReturnType<typeof createDefaultPanelWorkspaceLayoutV4>,
): PanelWorkspaceLayoutV4 {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

function activate(
  layout: PanelWorkspaceLayoutV4,
  panelId: PanelId,
): PanelWorkspaceLayoutV4 {
  const result = activatePanelWorkspacePanelV4(
    layout,
    REGISTRY,
    panelId,
    SURFACE_RECT,
  );
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result.value.layout;
}

function rowsByColumn(
  layout: PanelWorkspaceLayoutV4,
  zone: PanelWorkspacePlacementZone,
): PanelId[][] {
  const cluster = layout.clusters.find(
    (candidate) => candidate.placementZone === zone,
  );
  return (
    cluster?.columns.map((column) =>
      column.rows
        .filter((row) => layout.visibility[row.panelId] === true)
        .map((row) => row.panelId),
    ) ?? []
  ).filter((rows) => rows.length > 0);
}

function anchorPoint(
  zone: PanelWorkspacePlacementZone,
  frame: { x: number; y: number; width: number; height: number },
): { x: number; y: number } {
  const x =
    zone.endsWith("left") || zone === "left"
      ? frame.x
      : zone.endsWith("right") || zone === "right"
        ? frame.x + frame.width
        : frame.x + frame.width / 2;
  const y =
    zone.startsWith("top") || zone === "top"
      ? frame.y
      : zone.startsWith("bottom") || zone === "bottom"
        ? frame.y + frame.height
        : frame.y + frame.height / 2;
  return { x, y };
}

function singleZoneLayout(
  zone: PanelWorkspacePlacementZone,
): PanelWorkspaceLayoutV4 {
  return {
    version: 4,
    visibility: { properties: true },
    railOrder: {
      left: ["navigator", "components", "settings"],
      right: ["properties", "styles", "history"],
      bottom: ["monitor"],
    },
    clusters: [
      {
        id: `zone:${zone}`,
        placementZone: zone,
        columns: [
          {
            id: `zone:${zone}:column:0`,
            width: 200,
            rows: [{ panelId: "properties", height: 100 }],
          },
        ],
      },
    ],
    clusterFocusOrder: [`zone:${zone}`],
  };
}

describe("ADR-186 G4 v4 panel policy", () => {
  it("right는 아래로 stack한 뒤 왼쪽 column으로 overflow한다", () => {
    let layout = requireLayout(
      createDefaultPanelWorkspaceLayoutV4(REGISTRY, SURFACE_RECT),
    );
    layout = activate(layout, "properties");
    layout = activate(layout, "styles");
    layout = activate(layout, "history");

    expect(rowsByColumn(layout, "top-right")).toEqual([
      ["history"],
      ["properties", "styles"],
    ]);
  });

  it("첫 번째 우측 패널은 숨겨진 패널의 defaultWidth가 아니라 자신의 폭으로 열린다", () => {
    const registry = REGISTRY.map((entry) =>
      entry.id === "properties"
        ? { ...entry, minWidth: 233, defaultWidth: 233 }
        : entry.id === "history"
          ? { ...entry, minWidth: 233, defaultWidth: 320 }
          : entry.id === "styles"
            ? { ...entry, minWidth: 233, defaultWidth: 360 }
            : entry,
    );
    const initial = requireLayout(
      createDefaultPanelWorkspaceLayoutV4(registry, SURFACE_RECT),
    );
    const activated = activatePanelWorkspacePanelV4(
      initial,
      registry,
      "properties",
      SURFACE_RECT,
    );
    expect(activated.ok).toBe(true);
    if (!activated.ok) throw new Error(activated.error);
    const solved = solvePanelWorkspaceLayoutV4(
      activated.value.layout,
      registry,
      SURFACE_RECT,
    );
    expect(solved.ok).toBe(true);
    if (!solved.ok) throw new Error(solved.error);
    expect(solved.value.frameGeometries.get("properties")?.width).toBe(233);
  });

  it("left는 아래로 stack한 뒤 오른쪽 column으로 overflow한다", () => {
    let layout = requireLayout(
      createDefaultPanelWorkspaceLayoutV4(REGISTRY, SURFACE_RECT),
    );
    layout = activate(layout, "navigator");
    layout = activate(layout, "components");
    layout = activate(layout, "settings");

    expect(rowsByColumn(layout, "top-left")).toEqual([
      ["navigator", "components"],
      ["settings"],
    ]);
  });

  it("hidden panel은 마지막 zone/row와 rail identity를 보존해 reopen한다", () => {
    const base = singleZoneLayout("center");
    const hidden = activate(base, "properties");
    const reopened = activate(hidden, "properties");

    expect(reopened.visibility.properties).toBe(true);
    expect(reopened.railOrder.right).toContain("properties");
    expect(
      reopened.clusters.find((cluster) => cluster.placementZone === "center")
        ?.columns[0]?.rows,
    ).toEqual([{ panelId: "properties", height: 100 }]);
    expect(
      reopened.clusters.flatMap((cluster) =>
        cluster.columns.flatMap((column) =>
          column.rows.filter((row) => row.panelId === "properties"),
        ),
      ),
    ).toHaveLength(1);
  });

  it("cross-rail relative snap은 target zone만 승계하고 railOrder는 바꾸지 않는다", () => {
    const layout = requireLayout(
      createDefaultPanelWorkspaceLayoutV4(
        REGISTRY,
        { width: 1200, height: 800 },
        {
          navigator: true,
          properties: true,
        },
      ),
    );
    const beforeRailOrder = JSON.stringify(layout.railOrder);
    const started = beginPanelWorkspaceDragSession(
      layout,
      REGISTRY,
      { width: 1200, height: 800 },
      "properties",
    );
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    const target = started.value.snapTargetFrameGeometries.get("navigator");
    expect(target).toBeDefined();
    if (!target) return;
    const updated = updatePanelWorkspaceDragSession(
      started.value,
      REGISTRY,
      { width: 1200, height: 800 },
      {
        x: target.x,
        y: target.y + target.height + 4,
        width: 200,
        height: 100,
      },
      { x: target.x + 100, y: target.y + target.height + 4 },
    );
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.value.candidate).toEqual({
      kind: "panel-edge",
      panelId: "navigator",
      edge: "bottom",
    });
    const committed = commitPanelWorkspaceDragSession(updated.value, REGISTRY, {
      width: 1200,
      height: 800,
    });
    expect(committed.ok).toBe(true);
    if (!committed.ok) return;

    expect(JSON.stringify(committed.value.layout.railOrder)).toBe(
      beforeRailOrder,
    );
    expect(
      committed.value.layout.clusters.find((cluster) =>
        cluster.columns.some((column) =>
          column.rows.some((row) => row.panelId === "properties"),
        ),
      )?.placementZone,
    ).toBe("top-left");
  });

  it("explicit reset은 registry rail/default zone/default size를 복원하고 visibility는 보존한다", () => {
    const moved = singleZoneLayout("center");
    moved.railOrder = {
      left: ["properties"],
      right: ["navigator", "components", "settings", "styles", "history"],
      bottom: ["monitor"],
    };
    moved.clusters[0]!.columns[0]!.width = 333;
    moved.clusters[0]!.columns[0]!.rows[0]!.height = 177;
    const reset = resetPanelWorkspaceLayoutV4(moved, REGISTRY, {
      width: 1200,
      height: 800,
    });
    expect(reset.ok).toBe(true);
    if (!reset.ok) return;

    expect(reset.value.layout.visibility.properties).toBe(true);
    expect(reset.value.layout.railOrder.right).toEqual([
      "properties",
      "styles",
      "history",
    ]);
    const placement = reset.value.layout.clusters.find(
      (cluster) => cluster.placementZone === "top-right",
    );
    expect(placement?.columns[0]).toMatchObject({
      width: 200,
      rows: expect.arrayContaining([{ panelId: "properties", height: 100 }]),
    });
  });

  it.each(
    ZONES.flatMap((zone) =>
      OUTER_RESIZE_CASES.map((resize) => ({ zone, ...resize })),
    ),
  )(
    "$zone $edge outer resize는 zone anchor를 고정한다",
    ({ zone, edge, deltaX, deltaY, width, height }) => {
      const surfaceRect = { width: 1200, height: 800 } as const;
      const base = singleZoneLayout(zone);
      const before = solvePanelWorkspaceLayoutV4(base, REGISTRY, surfaceRect);
      const resized = resizePanelWorkspaceBoundaryV4(
        base,
        REGISTRY,
        "properties",
        edge,
        deltaX,
        deltaY,
        surfaceRect,
      );
      expect(before.ok).toBe(true);
      expect(resized.ok).toBe(true);
      if (!before.ok || !resized.ok) return;
      const after = solvePanelWorkspaceLayoutV4(
        resized.value.layout,
        REGISTRY,
        surfaceRect,
      );
      expect(after.ok).toBe(true);
      if (!after.ok) return;
      const beforeFrame = before.value.frameGeometries.get("properties");
      const afterFrame = after.value.frameGeometries.get("properties");
      expect(beforeFrame).toBeDefined();
      expect(afterFrame).toBeDefined();
      if (!beforeFrame || !afterFrame) return;

      const horizontallyCentered =
        zone === "top" || zone === "center" || zone === "bottom";
      const verticallyCentered =
        zone === "left" || zone === "center" || zone === "right";
      if (horizontallyCentered && (edge === "left" || edge === "right")) {
        expect(afterFrame.x + afterFrame.width / 2).toBe(
          beforeFrame.x + beforeFrame.width / 2,
        );
        if (edge === "left") {
          expect(afterFrame.x).toBe(beforeFrame.x + deltaX);
          expect(afterFrame.x + afterFrame.width).toBe(
            beforeFrame.x + beforeFrame.width - deltaX,
          );
        } else {
          expect(afterFrame.x).toBe(beforeFrame.x - deltaX);
          expect(afterFrame.x + afterFrame.width).toBe(
            beforeFrame.x + beforeFrame.width + deltaX,
          );
        }
      } else if (verticallyCentered && (edge === "top" || edge === "bottom")) {
        if (edge === "top") {
          expect(afterFrame.y + afterFrame.height).toBe(
            beforeFrame.y + beforeFrame.height,
          );
          expect(afterFrame.y).toBe(beforeFrame.y + deltaY);
        } else {
          expect(afterFrame.y).toBe(beforeFrame.y);
          expect(afterFrame.y + afterFrame.height).toBe(
            beforeFrame.y + beforeFrame.height + deltaY,
          );
        }
      } else {
        expect(anchorPoint(zone, afterFrame)).toEqual(
          anchorPoint(zone, beforeFrame),
        );
      }
      const expectedWidth =
        horizontallyCentered && (edge === "left" || edge === "right")
          ? beforeFrame.width + (edge === "left" ? -2 * deltaX : 2 * deltaX)
          : width;
      expect(afterFrame).toMatchObject({ width: expectedWidth, height });
    },
  );

  it.each(["top", "center", "bottom"] as const)(
    "%s zone outer horizontal resize는 center를 고정하고 pointer edge를 따른다",
    (zone) => {
      const surfaceRect = { width: 1200, height: 800 } as const;
      const base = singleZoneLayout(zone);
      const beforeResult = solvePanelWorkspaceLayoutV4(
        base,
        REGISTRY,
        surfaceRect,
      );
      expect(beforeResult.ok).toBe(true);
      if (!beforeResult.ok) return;
      const before = beforeResult.value.frameGeometries.get("properties");
      expect(before).toBeDefined();
      if (!before) return;

      const resized = resizePanelWorkspaceBoundaryV4(
        base,
        REGISTRY,
        "properties",
        "right",
        40,
        0,
        surfaceRect,
      );
      expect(resized.ok).toBe(true);
      if (!resized.ok) return;
      const afterResult = solvePanelWorkspaceLayoutV4(
        resized.value.layout,
        REGISTRY,
        surfaceRect,
      );
      expect(afterResult.ok).toBe(true);
      if (!afterResult.ok) return;
      const after = afterResult.value.frameGeometries.get("properties");
      expect(after).toBeDefined();
      if (!after) return;

      expect(after.x + after.width / 2).toBe(before.x + before.width / 2);
      expect(after.x).toBe(before.x - 40);
      expect(after.x + after.width).toBe(before.x + before.width + 40);
      expect(after.width).toBe(before.width + 80);
      expect(resized.value.layout.clusters[0]?.originOffset).toBeUndefined();
    },
  );

  it.each([
    { edge: "left", overDelta: -1000, returnDelta: -20 },
    { edge: "right", overDelta: 1000, returnDelta: 20 },
  ] as const)(
    "centered $edge resize는 clamp를 넘겼다가 돌아와도 pointer와 center가 어긋나지 않는다",
    ({ edge, overDelta, returnDelta }) => {
      const surfaceRect = { width: 1200, height: 800 } as const;
      const base = singleZoneLayout("top");
      const beforeResult = solvePanelWorkspaceLayoutV4(
        base,
        REGISTRY,
        surfaceRect,
      );
      const over = resizePanelWorkspaceBoundaryV4(
        base,
        REGISTRY,
        "properties",
        edge,
        overDelta,
        0,
        surfaceRect,
      );
      const returned = resizePanelWorkspaceBoundaryV4(
        base,
        REGISTRY,
        "properties",
        edge,
        returnDelta,
        0,
        surfaceRect,
      );
      expect(beforeResult.ok).toBe(true);
      expect(over.ok).toBe(true);
      expect(returned.ok).toBe(true);
      if (!beforeResult.ok || !over.ok || !returned.ok) return;
      const returnedResult = solvePanelWorkspaceLayoutV4(
        returned.value.layout,
        REGISTRY,
        surfaceRect,
      );
      expect(returnedResult.ok).toBe(true);
      if (!returnedResult.ok) return;
      const before = beforeResult.value.frameGeometries.get("properties");
      const after = returnedResult.value.frameGeometries.get("properties");
      expect(before).toBeDefined();
      expect(after).toBeDefined();
      if (!before || !after) return;

      expect(after.x + after.width / 2).toBe(before.x + before.width / 2);
      expect(after.width).toBe(before.width + 40);
      if (edge === "left") {
        expect(after.x).toBe(before.x + returnDelta);
      } else {
        expect(after.x + after.width).toBe(
          before.x + before.width + returnDelta,
        );
      }
    },
  );

  it.each(ZONES)(
    "%s paired row resize는 합계와 zone anchor를 고정한다",
    (zone) => {
      const surfaceRect = { width: 1200, height: 800 } as const;
      const base = singleZoneLayout(zone);
      base.visibility.styles = true;
      base.clusters[0]!.columns[0]!.rows.push({
        panelId: "styles",
        height: 100,
      });
      const before = solvePanelWorkspaceLayoutV4(base, REGISTRY, surfaceRect);
      const resized = resizePanelWorkspaceBoundaryV4(
        base,
        REGISTRY,
        "properties",
        "bottom",
        0,
        30,
        surfaceRect,
      );
      expect(before.ok).toBe(true);
      expect(resized.ok).toBe(true);
      if (!before.ok || !resized.ok) return;
      const rows = resized.value.layout.clusters[0]!.columns[0]!.rows.filter(
        (row) => resized.value.layout.visibility[row.panelId] === true,
      );
      expect(rows).toEqual([
        { panelId: "properties", height: 130 },
        { panelId: "styles", height: 70 },
      ]);
      expect(rows.reduce((sum, row) => sum + row.height, 0)).toBe(200);
      const after = solvePanelWorkspaceLayoutV4(
        resized.value.layout,
        REGISTRY,
        surfaceRect,
      );
      expect(after.ok).toBe(true);
      if (!after.ok) return;
      const beforeCluster = before.value.clusterGeometries.get(`zone:${zone}`);
      const afterCluster = after.value.clusterGeometries.get(`zone:${zone}`);
      expect(beforeCluster).toBeDefined();
      expect(afterCluster).toBeDefined();
      if (!beforeCluster || !afterCluster) return;
      expect(anchorPoint(zone, afterCluster)).toEqual(
        anchorPoint(zone, beforeCluster),
      );
    },
  );

  it.each(["top-left", "top", "top-right"] as const)(
    "%s short row stack은 paired min 이후 남은 workspace 높이까지 확장한다",
    (zone) => {
      const surfaceRect = { width: 1200, height: 800 } as const;
      const base = singleZoneLayout(zone);
      base.visibility.styles = true;
      base.clusters[0]!.columns[0]!.rows.push({
        panelId: "styles",
        height: 100,
      });

      const resized = resizePanelWorkspaceBoundaryV4(
        base,
        REGISTRY,
        "properties",
        "bottom",
        0,
        700,
        surfaceRect,
      );
      const returned = resizePanelWorkspaceBoundaryV4(
        base,
        REGISTRY,
        "properties",
        "bottom",
        0,
        300,
        surfaceRect,
      );
      expect(resized.ok).toBe(true);
      expect(returned.ok).toBe(true);
      if (!resized.ok || !returned.ok) return;

      expect(
        resized.value.layout.clusters[0]!.columns[0]!.rows.filter(
          (row) => resized.value.layout.visibility[row.panelId] === true,
        ),
      ).toEqual([
        { panelId: "properties", height: 736 },
        { panelId: "styles", height: 60 },
      ]);
      const solved = solvePanelWorkspaceLayoutV4(
        resized.value.layout,
        REGISTRY,
        surfaceRect,
      );
      expect(solved.ok).toBe(true);
      if (!solved.ok) return;
      const lastFrame = solved.value.frameGeometries.get("styles");
      expect(lastFrame).toBeDefined();
      if (!lastFrame) return;
      expect(lastFrame.y + lastFrame.height).toBe(surfaceRect.height);

      expect(
        returned.value.layout.clusters[0]!.columns[0]!.rows.filter(
          (row) => returned.value.layout.visibility[row.panelId] === true,
        ),
      ).toEqual([
        { panelId: "properties", height: 400 },
        { panelId: "styles", height: 60 },
      ]);
    },
  );

  it.each(ZONES)(
    "%s paired column resize는 합계와 zone anchor를 고정한다",
    (zone) => {
      const surfaceRect = { width: 1200, height: 800 } as const;
      const base = singleZoneLayout(zone);
      base.visibility.styles = true;
      base.clusters[0]!.columns.push({
        id: `zone:${zone}:column:1`,
        width: 200,
        rows: [{ panelId: "styles", height: 100 }],
      });
      const before = solvePanelWorkspaceLayoutV4(base, REGISTRY, surfaceRect);
      const resized = resizePanelWorkspaceBoundaryV4(
        base,
        REGISTRY,
        "properties",
        "right",
        30,
        0,
        surfaceRect,
      );
      expect(before.ok).toBe(true);
      expect(resized.ok).toBe(true);
      if (!before.ok || !resized.ok) return;
      const columns = resized.value.layout.clusters[0]!.columns;
      expect(columns.slice(0, 2).map((column) => column.width)).toEqual([
        230, 170,
      ]);
      expect(
        columns.slice(0, 2).reduce((sum, column) => sum + column.width, 0),
      ).toBe(400);
      const after = solvePanelWorkspaceLayoutV4(
        resized.value.layout,
        REGISTRY,
        surfaceRect,
      );
      expect(after.ok).toBe(true);
      if (!after.ok) return;
      const beforeCluster = before.value.clusterGeometries.get(`zone:${zone}`);
      const afterCluster = after.value.clusterGeometries.get(`zone:${zone}`);
      expect(beforeCluster).toBeDefined();
      expect(afterCluster).toBeDefined();
      if (!beforeCluster || !afterCluster) return;
      expect(anchorPoint(zone, afterCluster)).toEqual(
        anchorPoint(zone, beforeCluster),
      );
    },
  );

  it("reference-frame resize는 clamp를 넘겼다가 돌아와도 drift가 없다", () => {
    const surfaceRect = { width: 1200, height: 800 } as const;
    const base = singleZoneLayout("top-right");
    base.visibility.styles = true;
    base.clusters[0]!.columns[0]!.rows.push({
      panelId: "styles",
      height: 100,
    });
    const over = resizePanelWorkspaceBoundaryV4(
      base,
      REGISTRY,
      "properties",
      "bottom",
      0,
      1000,
      surfaceRect,
    );
    const returned = resizePanelWorkspaceBoundaryV4(
      base,
      REGISTRY,
      "properties",
      "bottom",
      0,
      20,
      surfaceRect,
    );
    const zero = resizePanelWorkspaceBoundaryV4(
      base,
      REGISTRY,
      "properties",
      "bottom",
      0,
      0,
      surfaceRect,
    );
    expect(over.ok).toBe(true);
    expect(returned.ok).toBe(true);
    expect(zero.ok).toBe(true);
    if (!over.ok || !returned.ok || !zero.ok) return;
    expect(
      returned.value.layout.clusters[0]!.columns[0]!.rows.filter(
        (row) => returned.value.layout.visibility[row.panelId] === true,
      ),
    ).toEqual([
      { panelId: "properties", height: 120 },
      { panelId: "styles", height: 80 },
    ]);
    expect(
      zero.value.layout.clusters[0]!.columns[0]!.rows.filter(
        (row) => zero.value.layout.visibility[row.panelId] === true,
      ),
    ).toEqual([
      { panelId: "properties", height: 100 },
      { panelId: "styles", height: 100 },
    ]);
  });

  it("config maxHeight보다 큰 브라우저 surface 높이까지 패널을 확장한다", () => {
    const surfaceRect = { width: 1200, height: 800 } as const;
    const registry = REGISTRY.map((entry) =>
      entry.id === "properties" ? { ...entry, maxHeight: 100 } : entry,
    );
    const base = singleZoneLayout("top-right");
    const resized = resizePanelWorkspaceBoundaryV4(
      base,
      registry,
      "properties",
      "bottom",
      0,
      700,
      surfaceRect,
    );

    expect(resized.ok).toBe(true);
    if (!resized.ok) return;
    const solved = solvePanelWorkspaceLayoutV4(
      resized.value.layout,
      registry,
      surfaceRect,
    );
    expect(solved.ok).toBe(true);
    if (!solved.ok) return;
    expect(solved.value.frameGeometries.get("properties")).toMatchObject({
      height: 800,
    });
  });
});

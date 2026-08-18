import { describe, expect, it } from "vitest";
import {
  DEFAULT_PANEL_LAYOUT,
  type PanelId,
  type PanelLayoutState,
} from "../panels/core/types";
import {
  PANEL_WORKSPACE_TEST_REGISTRY,
  createPanelWorkspaceLayoutV2,
} from "./panelWorkspaceLayoutV2.testFixtures";
import {
  migratePanelLayoutV1ToV2,
  parsePanelLayoutV1,
  projectV2ToLegacyView,
} from "./panelWorkspaceLayoutV2Migration";

function createV1Layout(): PanelLayoutState {
  return {
    ...DEFAULT_PANEL_LAYOUT,
    leftPanels: ["nodes", "datatableEditor", "settings"],
    rightPanels: ["properties", "history"],
    activeLeftPanels: ["nodes"],
    activeRightPanels: ["properties"],
    bottomPanels: ["monitor"],
    activeBottomPanels: [],
    showLeft: true,
    showRight: true,
    showBottom: false,
    bottomHeight: 200,
    panelSizes: {},
    modalPanels: [],
    panelClusters: [],
    nextModalZIndex: 1000,
  };
}

function migrate(layout: unknown, migrationId: string = "migration-1") {
  const parsed = parsePanelLayoutV1(
    layout,
    PANEL_WORKSPACE_TEST_REGISTRY,
    createV1Layout(),
  );
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) throw new Error(parsed.error);
  return migratePanelLayoutV1ToV2(
    parsed.value,
    PANEL_WORKSPACE_TEST_REGISTRY,
    migrationId,
  );
}

function placementIds(layout: ReturnType<typeof migrate>): PanelId[] {
  return layout.clusters.flatMap((cluster) =>
    cluster.columns.flatMap((column) => column.rows.map((row) => row.panelId)),
  );
}

describe("ADR-922 v1 -> v2 migration fixtures", () => {
  it("default layout", () => {
    const result = migrate(createV1Layout());

    expect(result.migrationSource).toEqual({
      version: 1,
      migrationId: "migration-1",
    });
    expect(result.visibility.nodes).toBe(true);
    expect(result.visibility.properties).toBe(true);
    expect(result.visibility.monitor).toBe(false);
    expect(new Set(placementIds(result)).size).toBe(
      PANEL_WORKSPACE_TEST_REGISTRY.length,
    );
  });

  it("left/right multi-active", () => {
    const input = createV1Layout();
    input.activeLeftPanels = ["nodes", "settings"];
    input.activeRightPanels = ["properties", "history"];

    const result = migrate(input);

    expect(result.visibility).toMatchObject({
      nodes: true,
      settings: true,
      properties: true,
      history: true,
    });
  });

  it("multi-active side geometry 순서와 폭을 hidden panel min-width 영향 없이 보존한다", () => {
    const input = createV1Layout();
    input.activeLeftPanels = ["nodes", "settings"];
    input.activeRightPanels = ["properties", "history"];

    const result = migrate(input);
    const left = result.clusters.find((cluster) => cluster.anchor === "left");
    const right = result.clusters.find((cluster) => cluster.anchor === "right");

    expect(left?.columns.map((column) => column.width)).toEqual([233, 400]);
    expect(left?.columns.map((column) => column.rows[0]?.panelId)).toEqual([
      "nodes",
      "settings",
    ]);
    expect(right?.columns.map((column) => column.width)).toEqual([320, 233]);
    expect(right?.columns.map((column) => column.rows[0]?.panelId)).toEqual([
      "history",
      "properties",
    ]);

    input.activeLeftPanels = ["settings", "nodes"];
    input.activeRightPanels = ["history", "properties"];
    const reordered = migrate(input);
    const reorderedLeft = reordered.clusters.find(
      (cluster) => cluster.anchor === "left",
    );
    const reorderedRight = reordered.clusters.find(
      (cluster) => cluster.anchor === "right",
    );
    expect(
      reorderedLeft?.columns.map((column) => column.rows[0]?.panelId),
    ).toEqual(["settings", "nodes"]);
    expect(
      reorderedRight?.columns.map((column) => column.rows[0]?.panelId),
    ).toEqual(["properties", "history"]);
  });

  it("side 전체가 hidden이어도 첫 panel의 preferred width를 보존한다", () => {
    const input = createV1Layout();
    input.showLeft = false;
    input.showRight = false;

    const result = migrate(input);
    const left = result.clusters.find((cluster) => cluster.anchor === "left");
    const right = result.clusters.find((cluster) => cluster.anchor === "right");

    expect(left?.columns[0]?.width).toBe(233);
    expect(right?.columns[0]?.width).toBe(233);
  });

  it("Monitor bottom active", () => {
    const input = createV1Layout();
    input.activeBottomPanels = ["monitor"];
    input.showBottom = true;
    input.bottomHeight = 280;

    const result = migrate(input);
    const monitor = result.clusters
      .find((cluster) => cluster.anchor === "bottom")
      ?.columns.flatMap((column) => column.rows)
      .find((row) => row.panelId === "monitor");

    expect(result.visibility.monitor).toBe(true);
    expect(monitor?.height).toBe(280);
  });

  it("floating only", () => {
    const input = createV1Layout();
    input.modalPanels = [
      {
        panelId: "settings",
        mode: "floating",
        position: { x: 120, y: 80 },
        size: { width: 430, height: 510 },
        zIndex: 1010,
      },
    ];
    input.activeLeftPanels = ["nodes", "settings"];

    const result = migrate(input);
    const floating = result.clusters.find(
      (cluster) => cluster.anchor === "floating",
    );

    expect(floating).toMatchObject({
      anchor: "floating",
      position: { x: 120, y: 80 },
      columns: [
        {
          width: 430,
          rows: [{ panelId: "settings", height: 510 }],
        },
      ],
    });
    expect(result.floatingFocusOrder).toEqual([floating?.id]);
  });

  it("snapped two-column", () => {
    const input = createV1Layout();
    input.activeRightPanels = ["properties", "history"];
    input.modalPanels = [
      {
        panelId: "properties",
        mode: "floating",
        position: { x: 400, y: 100 },
        size: { width: 280, height: 500 },
        zIndex: 1001,
      },
      {
        panelId: "history",
        mode: "floating",
        position: { x: 684, y: 100 },
        size: { width: 300, height: 500 },
        zIndex: 1002,
      },
    ];
    input.panelClusters = [
      {
        id: "cluster-1",
        position: { x: 400, y: 100 },
        columns: [
          { width: 280, panelIds: ["properties"] },
          { width: 300, panelIds: ["history"] },
        ],
      },
    ];

    const result = migrate(input);
    const floating = result.clusters.find(
      (cluster) => cluster.anchor === "floating",
    );

    expect(floating?.columns.map((column) => column.width)).toEqual([280, 300]);
    expect(
      floating?.columns.map((column) => column.rows.map((row) => row.panelId)),
    ).toEqual([["properties"], ["history"]]);
  });

  it("invalid/removed/duplicate panel ID", () => {
    const input: Record<string, unknown> = {
      ...createV1Layout(),
      leftPanels: ["nodes", "removed", "nodes", "settings"],
      activeLeftPanels: ["nodes", "removed"],
    };

    const result = migrate(input);

    expect(result.railOrder.left).toEqual([
      "nodes",
      "settings",
      "datatableEditor",
    ]);
    expect(placementIds(result)).not.toContain("removed");
    expect(placementIds(result).filter((id) => id === "nodes")).toHaveLength(1);
  });

  it("legacy singular active panel fields도 current v1 visibility로 승격한다", () => {
    const input: Record<string, unknown> = {
      ...createV1Layout(),
      activeLeftPanels: undefined,
      activeRightPanels: undefined,
      activeLeftPanel: "settings",
      activeRightPanel: "history",
    };

    const result = migrate(input);

    expect(result.visibility.settings).toBe(true);
    expect(result.visibility.history).toBe(true);
  });
});

describe("ADR-922 v2-born emergency legacy projection", () => {
  it("backup 없는 v2의 rail/anchor/floating/size metadata를 default fallback 없이 보존한다", () => {
    const layout = createPanelWorkspaceLayoutV2();
    layout.visibility.settings = true;
    const left = layout.clusters.find((cluster) => cluster.anchor === "left");
    const settingsRow = left?.columns[0]?.rows.find(
      (row) => row.panelId === "settings",
    );
    if (left && settingsRow) {
      left.columns[0]!.rows = left.columns[0]!.rows.filter(
        (row) => row.panelId !== "settings",
      );
      layout.clusters.push({
        id: "floating:settings",
        anchor: "floating",
        position: { x: 88, y: 64 },
        columns: [
          {
            id: "floating:settings:column:0",
            width: 410,
            rows: [{ panelId: "settings", height: 490 }],
          },
        ],
      });
      layout.floatingFocusOrder = ["floating:settings"];
    }

    const view = projectV2ToLegacyView(
      layout,
      PANEL_WORKSPACE_TEST_REGISTRY,
      createV1Layout(),
    );

    expect(view.source).toBe("projected-v2");
    expect(view.layout).not.toEqual(createV1Layout());
    expect(view.layout.modalPanels).toContainEqual(
      expect.objectContaining({
        panelId: "settings",
        position: { x: 88, y: 64 },
        size: { width: 410, height: 490 },
      }),
    );
    expect(view.metadata.railOrder).toEqual(layout.railOrder);
    expect(view.metadata.placements.settings).toBe("floating");
    expect(view.metadata.preferredSizes.settings).toEqual({
      width: 410,
      height: 490,
    });
  });

  it("activity rail과 다른 anchor도 projection metadata에서 손실 없이 보존한다", () => {
    const layout = createPanelWorkspaceLayoutV2();
    const right = layout.clusters.find((cluster) => cluster.anchor === "right");
    const left = layout.clusters.find((cluster) => cluster.anchor === "left");
    const history = right?.columns[0]?.rows.find(
      (row) => row.panelId === "history",
    );
    if (right && left && history) {
      right.columns[0]!.rows = right.columns[0]!.rows.filter(
        (row) => row.panelId !== "history",
      );
      left.columns[0]!.rows.push(history);
    }

    const view = projectV2ToLegacyView(
      layout,
      PANEL_WORKSPACE_TEST_REGISTRY,
      createV1Layout(),
    );

    expect(view.metadata.railOrder.right).toContain("history");
    expect(view.metadata.placements.history).toBe("left");
  });
});

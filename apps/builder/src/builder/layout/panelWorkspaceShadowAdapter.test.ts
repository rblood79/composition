import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PANEL_LAYOUT,
  type PanelFrameGeometry,
  type PanelId,
  type PanelLayoutState,
} from "../panels/core/types";
import {
  PANEL_WORKSPACE_TEST_REGISTRY,
  createPanelWorkspaceLayoutV2,
} from "./panelWorkspaceLayoutV2.testFixtures";
import { migratePanelLayoutV1ToV2 } from "./panelWorkspaceLayoutV2Migration";
import { migratePanelWorkspaceLayoutV2ToV3 } from "./panelWorkspaceLayoutV3Migration";
import { resolvePanelSnap } from "./panelSnap";
import { createPanelWorkspaceLayoutCoordinator } from "./panelWorkspaceLayoutCoordinator";
import {
  comparePanelWorkspaceShadowFrames,
  resolvePanelSnapFromSnapshot,
} from "./panelWorkspaceShadowAdapter";

function createRepresentativeV1Layout(): PanelLayoutState {
  return {
    ...DEFAULT_PANEL_LAYOUT,
    leftPanels: ["nodes", "datatableEditor", "settings"],
    rightPanels: ["properties", "history"],
    activeLeftPanels: ["nodes", "settings"],
    activeRightPanels: ["properties", "history"],
    bottomPanels: ["monitor"],
    activeBottomPanels: ["monitor"],
    showLeft: true,
    showRight: true,
    showBottom: true,
    bottomHeight: 200,
    panelSizes: {},
    modalPanels: [
      {
        panelId: "monitor",
        mode: "floating",
        position: { x: 400, y: 650 },
        size: { width: 600, height: 200 },
        zIndex: 1001,
      },
    ],
    panelClusters: [],
    nextModalZIndex: 1002,
  };
}

function createRepresentativeSnapshot() {
  const layoutV2 = migratePanelLayoutV1ToV2(
    createRepresentativeV1Layout(),
    PANEL_WORKSPACE_TEST_REGISTRY,
    "g2a-shadow",
  );
  const migrated = migratePanelWorkspaceLayoutV2ToV3(
    layoutV2,
    PANEL_WORKSPACE_TEST_REGISTRY,
    {
      surfaceRect: { width: 1400, height: 900 },
      migrationId: "g2a-shadow-v3",
    },
  );
  if (!migrated.ok) throw new Error(migrated.error);
  const result = createPanelWorkspaceLayoutCoordinator({
    layout: migrated.value,
    registry: PANEL_WORKSPACE_TEST_REGISTRY,
    workspaceRect: { width: 1400, height: 900 },
  });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result.value.getSnapshot();
}

function createObservedV3Frames(): ReadonlyMap<PanelId, PanelFrameGeometry> {
  const snapshot = createRepresentativeSnapshot();
  return new Map(
    [...snapshot.frameGeometries].map(([panelId, frame]) => [
      panelId,
      { x: frame.x, y: frame.y, width: frame.width, height: frame.height },
    ]),
  );
}

describe("ADR-922 G2a shadow geometry", () => {
  it("대표 v1 5-panel frame과 shadow snapshot mismatch가 0이다", () => {
    const snapshot = createRepresentativeSnapshot();

    expect(
      comparePanelWorkspaceShadowFrames(snapshot, createObservedV3Frames()),
    ).toEqual([]);
  });

  it("geometry 차이를 allowlist 없이 panel/field 단위로 보고한다", () => {
    const snapshot = createRepresentativeSnapshot();
    const observed = new Map(createObservedV3Frames());
    observed.set("history", {
      ...observed.get("history")!,
      width: observed.get("history")!.width + 1,
    });

    expect(comparePanelWorkspaceShadowFrames(snapshot, observed)).toEqual([
      expect.objectContaining({
        panelId: "history",
        kind: "geometry",
        fields: ["width"],
      }),
    ]);
  });
});

describe("ADR-922 snapshot candidate adapter", () => {
  it("현행 pure snap oracle과 같은 candidate를 DOM query 없이 계산한다", () => {
    const snapshot = createRepresentativeSnapshot();
    const source = snapshot.frameGeometries.get("settings");
    if (!source) throw new Error("settings frame is required");
    const targets = [...createObservedV3Frames()]
      .filter(([panelId]) => panelId !== "settings")
      .map(([panelId, geometry]) => ({ panelId, geometry }));

    expect(resolvePanelSnapFromSnapshot(snapshot, "settings", source)).toEqual(
      resolvePanelSnap(source, targets),
    );
  });

  it("coordinator/candidate production module은 panel DOM geometry API를 참조하지 않는다", () => {
    const sources = [
      "panelWorkspaceLayoutCoordinator.ts",
      "panelWorkspaceShadowAdapter.ts",
    ].map((fileName) => readFileSync(resolve(__dirname, fileName), "utf8"));

    for (const source of sources) {
      expect(source).not.toContain("querySelector");
      expect(source).not.toContain("getBoundingClientRect");
      expect(source).not.toContain("document.");
      expect(source).not.toContain("window.");
    }
  });

  it("Phase 3 production frame은 coordinator로 전환하고 DOM candidate adapter를 직접 우회하지 않는다", () => {
    const panelWorkspace = readFileSync(
      resolve(__dirname, "PanelWorkspace.tsx"),
      "utf8",
    );
    const panelStore = readFileSync(
      resolve(__dirname, "../stores/panelLayout.ts"),
      "utf8",
    );

    expect(panelWorkspace).toContain("panelWorkspaceLayoutCoordinator");
    expect(panelWorkspace).toContain("createPanelWorkspaceRuntime");
    expect(panelWorkspace).not.toContain("panelWorkspaceShadowAdapter");
    expect(panelStore).not.toContain("panelWorkspaceLayoutCoordinator");
    expect(panelStore).not.toContain("panelWorkspaceShadowAdapter");
  });
});

describe("ADR-922 candidate fixture sanity", () => {
  it("v2 fixture는 candidate 계산에 필요한 registry panel을 모두 유지한다", () => {
    const layout = createPanelWorkspaceLayoutV2();
    const placed = layout.clusters.flatMap((cluster) =>
      cluster.columns.flatMap((column) =>
        column.rows.map((row) => row.panelId),
      ),
    );

    expect(new Set(placed).size).toBe(PANEL_WORKSPACE_TEST_REGISTRY.length);
  });
});

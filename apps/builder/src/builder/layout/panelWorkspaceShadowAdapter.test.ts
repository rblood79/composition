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
  const layout = migratePanelLayoutV1ToV2(
    createRepresentativeV1Layout(),
    PANEL_WORKSPACE_TEST_REGISTRY,
    "g2a-shadow",
  );
  const result = createPanelWorkspaceLayoutCoordinator({
    layout,
    registry: PANEL_WORKSPACE_TEST_REGISTRY,
    workspaceRect: { width: 1400, height: 900 },
    railSizes: { left: 48, right: 48, bottom: 48 },
  });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result.value.getSnapshot();
}

function createObservedV1Frames(): ReadonlyMap<PanelId, PanelFrameGeometry> {
  return new Map<PanelId, PanelFrameGeometry>([
    ["nodes", { x: 52, y: 4, width: 233, height: 520 }],
    ["settings", { x: 289, y: 4, width: 400, height: 500 }],
    ["history", { x: 791, y: 4, width: 320, height: 450 }],
    ["properties", { x: 1115, y: 4, width: 233, height: 520 }],
    ["monitor", { x: 400, y: 650, width: 600, height: 200 }],
  ]);
}

describe("ADR-922 G2a shadow geometry", () => {
  it("대표 v1 5-panel frame과 shadow snapshot mismatch가 0이다", () => {
    const snapshot = createRepresentativeSnapshot();

    expect(
      comparePanelWorkspaceShadowFrames(snapshot, createObservedV1Frames()),
    ).toEqual([]);
  });

  it("geometry 차이를 allowlist 없이 panel/field 단위로 보고한다", () => {
    const snapshot = createRepresentativeSnapshot();
    const observed = new Map(createObservedV1Frames());
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
    const source = {
      x: 52,
      y: 528,
      width: 233,
      height: 500,
    };
    const targets = [...createObservedV1Frames()]
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

  it("Phase 2는 기존 production frame/store를 import하지 않는다", () => {
    const panelWorkspace = readFileSync(
      resolve(__dirname, "PanelWorkspace.tsx"),
      "utf8",
    );
    const panelStore = readFileSync(
      resolve(__dirname, "../stores/panelLayout.ts"),
      "utf8",
    );

    expect(panelWorkspace).not.toContain("panelWorkspaceLayoutCoordinator");
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

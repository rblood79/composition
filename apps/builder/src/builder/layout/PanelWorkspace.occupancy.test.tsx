// @vitest-environment jsdom

import { fireEvent, render } from "@testing-library/react";
import { PanelLeft } from "lucide-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PanelConfig } from "../panels/core/types";
import { PanelRegistry } from "../panels/core/PanelRegistry";
import { useStore } from "../stores";
import {
  PANEL_WORKSPACE_TEST_REGISTRY,
  createPanelWorkspaceLayoutV2,
} from "./panelWorkspaceLayoutV2.testFixtures";
import { createPanelWorkspaceRegistryEntry } from "./panelWorkspaceLayoutV2";
import type { PanelWorkspaceLayoutV2 } from "./panelWorkspaceLayoutV2";
import type { PanelWorkspaceLayoutV3 } from "./panelWorkspaceLayoutV3";
import { migratePanelWorkspaceLayoutV2ToV3 } from "./panelWorkspaceLayoutV3Migration";
import {
  beginPanelWorkspaceDragSession,
  commitPanelWorkspaceDragSession,
  updatePanelWorkspaceDragSession,
} from "./panelWorkspaceZoneDrop";
import { PanelWorkspace } from "./PanelWorkspace";

const TEST_CONFIGS: PanelConfig[] = PANEL_WORKSPACE_TEST_REGISTRY.map(
  (entry): PanelConfig => ({
    id: entry.id,
    name: entry.id,
    icon: PanelLeft,
    component: () => null,
    category: "editor",
    defaultPosition: entry.defaultPosition,
    defaultWidth: entry.defaultWidth,
    minWidth: entry.minWidth,
    maxWidth: entry.maxWidth,
    defaultHeight: entry.defaultHeight,
    minHeight: entry.minHeight,
    maxHeight: entry.maxHeight,
  }),
);

const STYLES_TEST_CONFIG: PanelConfig = {
  id: "styles",
  name: "styles",
  icon: PanelLeft,
  component: () => null,
  category: "editor",
  defaultPosition: "right",
  defaultWidth: 320,
  minWidth: 233,
  maxWidth: 640,
  defaultHeight: 300,
  minHeight: 160,
  maxHeight: 800,
};

const TEST_REGISTRY = [...TEST_CONFIGS, STYLES_TEST_CONFIG].map((config) =>
  createPanelWorkspaceRegistryEntry(config),
);

function migrateFixture(
  source: PanelWorkspaceLayoutV2 = createPanelWorkspaceLayoutV2(),
): PanelWorkspaceLayoutV3 {
  const migrated = migratePanelWorkspaceLayoutV2ToV3(source, TEST_REGISTRY, {
    surfaceRect: { width: 1600, height: 852 },
    migrationId: "panel-workspace-occupancy-fixture",
  });
  if (!migrated.ok) throw new Error(migrated.error);
  return migrated.value;
}

function RepresentativePanel() {
  return (
    <div className="panel representative-panel">
      <div className="panel-header">
        <span className="panel-title">Nodes</span>
        <div className="panel-actions" />
      </div>
      <div className="panel-contents" />
    </div>
  );
}

describe("ADR-922 PanelWorkspace occupiedInsets shell", () => {
  beforeEach(() => {
    vi.spyOn(PanelRegistry, "getAllPanels").mockReturnValue([
      ...TEST_CONFIGS,
      STYLES_TEST_CONFIG,
    ]);
    vi.spyOn(PanelRegistry, "getPanel").mockImplementation((panelId) =>
      [...TEST_CONFIGS, STYLES_TEST_CONFIG].find(
        (config) => config.id === panelId,
      ),
    );
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1600,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 900,
    });
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1600);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(852);
    useStore.getState().initializePanelWorkspaceLayout(TEST_REGISTRY, {
      width: 1592,
      height: 844,
    });
    useStore.setState({
      panelWorkspaceLayout: migrateFixture(),
      panelWorkspaceHydrationStatus: "memory-fallback",
      panelWorkspaceHydrationError: null,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("v3 zone cluster를 overlay로 배치해 Canvas 전체 track을 유지한다", () => {
    const { container } = render(
      <PanelWorkspace>
        <div data-testid="canvas-content" />
      </PanelWorkspace>,
    );
    const host = container.querySelector<HTMLElement>(".panel-workspace-host");
    const main = container.querySelector<HTMLElement>(".panel-workspace-main");
    const dock = container.querySelector<HTMLElement>(".panel-dock");
    const dockSurface = container.querySelector<HTMLElement>(
      ".panel-dock-surface",
    );
    const nodesFrame = container.querySelector<HTMLElement>(
      '.workspace-panel-frame[data-panel="nodes"]',
    );
    const propertiesFrame = container.querySelector<HTMLElement>(
      '.workspace-panel-frame[data-panel="properties"]',
    );

    expect(host?.style.getPropertyValue("--panel-workspace-inset-left")).toBe(
      "0px",
    );
    expect(host?.style.getPropertyValue("--panel-workspace-inset-right")).toBe(
      "0px",
    );
    expect(host?.style.getPropertyValue("--panel-workspace-inset-bottom")).toBe(
      "0px",
    );
    expect(main?.getAttribute("data-main-x")).toBe("0");
    expect(main?.getAttribute("data-main-width")).toBe("1600");
    expect(main?.getAttribute("data-main-height")).toBe("852");
    expect(main?.getAttribute("data-layout-version")).toBe(
      host?.getAttribute("data-layout-version"),
    );
    expect(dock?.getAttribute("data-layout-type")).toBe("floating");
    expect(dock?.getAttribute("data-column-limit")).toBe("2");
    expect(dockSurface?.style.inset).toBe("0px");
    expect(dockSurface?.parentElement).toBe(dock);
    expect(dock?.querySelectorAll(":scope > .panel-nav")).toHaveLength(2);
    expect(
      dock?.querySelectorAll(":scope > .panel-activity-rail"),
    ).toHaveLength(0);
    expect(nodesFrame?.parentElement).toBe(dockSurface);
    expect(propertiesFrame?.parentElement).toBe(dockSurface);
    expect(nodesFrame?.style.left).toBe("0px");
    expect(propertiesFrame?.style.left).toBe("");
    expect(propertiesFrame?.style.right).toBe("0px");
    expect(dockSurface?.querySelectorAll(".panel-dock-rail")).toHaveLength(2);
    expect(dockSurface?.querySelectorAll(".panel-dock-dropper")).toHaveLength(
      0,
    );
    expect(dockSurface?.querySelector(".panel-zone-overlay")).toBeNull();
    expect(dock?.querySelectorAll(".workspace-panel-frame")).toHaveLength(
      TEST_CONFIGS.length + 1,
    );

    expect(
      container.querySelector('.panel-nav[data-side="bottom"]'),
    ).toBeNull();
    expect(
      container
        .querySelector('.workspace-panel-frame[data-panel="nodes"]')
        ?.getAttribute("data-zone"),
    ).toBe("top-left");
    expect(
      container
        .querySelector('.workspace-panel-frame[data-panel="properties"]')
        ?.getAttribute("data-zone"),
    ).toBe("top-right");
  });

  it("shell이 기존 panel header/action/content DOM을 복제하지 않는다", () => {
    vi.mocked(PanelRegistry.getAllPanels).mockReturnValue(
      TEST_CONFIGS.map((config) =>
        config.id === "nodes"
          ? { ...config, component: RepresentativePanel }
          : config,
      ),
    );

    const { container } = render(
      <PanelWorkspace>
        <div />
      </PanelWorkspace>,
    );
    const frame = container.querySelector(
      '.workspace-panel-frame[data-panel="nodes"]',
    );

    expect(frame?.querySelectorAll(".workspace-panel-content")).toHaveLength(1);
    expect(frame?.querySelectorAll(".panel-header")).toHaveLength(1);
    expect(frame?.querySelectorAll(".panel-title")).toHaveLength(1);
    expect(frame?.querySelectorAll(".panel-actions")).toHaveLength(1);
    expect(frame?.querySelectorAll(".panel-contents")).toHaveLength(1);

    const splitter = frame?.querySelector('[role="separator"]');
    const controlledPaneId = splitter?.getAttribute("aria-controls");
    const controlledPane = frame?.querySelector(".workspace-panel-content");
    expect(controlledPaneId).toBe("panel-nodes-content");
    expect(controlledPane?.id).toBe(controlledPaneId);
  });

  it("bottom placement는 유지하되 rail order가 비면 빈 rail DOM을 만들지 않는다", () => {
    const layout = migrateFixture();
    layout.railOrder.bottom = [];
    layout.railOrder.right.push("monitor");
    useStore.setState({ panelWorkspaceLayout: layout });

    const { container } = render(
      <PanelWorkspace>
        <div />
      </PanelWorkspace>,
    );

    expect(
      container.querySelector('.panel-nav[data-side="bottom"]'),
    ).toBeNull();
    expect(
      container.querySelector(
        '.panel-nav[data-side="right"] button[aria-label="monitor"]',
      ),
    ).not.toBeNull();
    expect(
      container.querySelector('.workspace-panel-frame[data-panel="monitor"]'),
    ).not.toBeNull();
  });

  it("right/left rail activation은 floating-first launch에서도 stack과 반대쪽 column을 유지한다", () => {
    const layout = createPanelWorkspaceLayoutV2();
    const left = layout.clusters.find((cluster) => cluster.anchor === "left");
    const right = layout.clusters.find((cluster) => cluster.anchor === "right");
    if (!left || !right) throw new Error("anchored clusters are required");

    left.columns[0]!.rows = [
      { panelId: "nodes", height: 350 },
      { panelId: "datatableEditor", height: 300 },
      { panelId: "settings", height: 300 },
    ];
    right.columns[0]!.rows = [
      { panelId: "properties", height: 350 },
      { panelId: "history", height: 300 },
      { panelId: "styles", height: 300 },
    ];
    layout.railOrder.right.push("styles");
    layout.visibility = {
      ...layout.visibility,
      datatableEditor: false,
      history: false,
      settings: false,
      styles: false,
    };
    useStore.setState({ panelWorkspaceLayout: migrateFixture(layout) });

    const { container } = render(
      <PanelWorkspace>
        <div />
      </PanelWorkspace>,
    );

    const clickRailButton = (side: "left" | "right", panelId: string) => {
      const button = container.querySelector<HTMLButtonElement>(
        `.panel-nav[data-side="${side}"] button[aria-label="${panelId}"]`,
      );
      if (!button) throw new Error(`${panelId} rail button is required`);
      fireEvent.click(button);
    };

    clickRailButton("right", "history");
    clickRailButton("right", "styles");
    clickRailButton("left", "datatableEditor");
    clickRailButton("left", "settings");

    const updated = useStore.getState().panelWorkspaceLayout!;
    const updatedRight = updated.clusters.find(
      (cluster) => cluster.placementZone === "top-right",
    );
    const updatedLeft = updated.clusters.find(
      (cluster) => cluster.placementZone === "top-left",
    );
    expect(updated.version).toBe(3);
    expect(
      updatedRight?.columns.map((column) =>
        column.rows.map((row) => row.panelId),
      ),
    ).toEqual([["styles"], ["properties", "history"]]);
    expect(
      updatedLeft?.columns.map((column) =>
        column.rows.map((row) => row.panelId),
      ),
    ).toEqual([["nodes", "datatableEditor"], ["settings"]]);
  });

  it("cross-rail snap은 anchor 기준 outer edge와 shared column splitter 하나를 렌더링한다", () => {
    const layout = migrateFixture();
    layout.visibility.settings = true;
    const started = beginPanelWorkspaceDragSession(
      layout,
      TEST_REGISTRY,
      { width: 1600, height: 852 },
      "settings",
    );
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    const target = started.value.candidateFrameGeometries.get("properties");
    if (!target) throw new Error("properties frame is required");
    const updated = updatePanelWorkspaceDragSession(
      started.value,
      TEST_REGISTRY,
      { width: 1600, height: 852 },
      {
        x: target.x - 404,
        y: target.y,
        width: 400,
        height: 500,
      },
      { x: target.x - 4, y: target.y + 250 },
    );
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.value.candidate).toEqual({
      kind: "panel-edge",
      panelId: "properties",
      edge: "left",
    });
    const committed = commitPanelWorkspaceDragSession(
      updated.value,
      TEST_REGISTRY,
      { width: 1600, height: 852 },
    );
    expect(committed.ok).toBe(true);
    if (!committed.ok) return;
    useStore.setState({ panelWorkspaceLayout: committed.value.layout });

    const { container } = render(
      <PanelWorkspace>
        <div />
      </PanelWorkspace>,
    );
    const settingsFrame = container.querySelector<HTMLElement>(
      '.workspace-panel-frame[data-panel="settings"]',
    );

    expect(settingsFrame?.getAttribute("data-side")).toBe("left");
    expect(settingsFrame?.getAttribute("data-zone")).toBe("top-right");
    expect(settingsFrame?.style.left).toBe("");
    expect(settingsFrame?.style.right).not.toBe("");
    expect(
      [...(settingsFrame?.querySelectorAll(".panel-resize-handle") ?? [])].map(
        (handle) => handle.getAttribute("data-edge"),
      ),
    ).toEqual(["left", "bottom"]);
    expect(
      container.querySelectorAll(
        '.panel-cluster-splitter[data-splitter-kind="column"]',
      ),
    ).toHaveLength(1);
  });

  it("우측 rail 패널을 좌측 zone에 배치하면 좌측 anchor로 렌더링한다", () => {
    const layout = migrateFixture();
    const rightCluster = layout.clusters.find(
      (cluster) => cluster.placementZone === "top-right",
    );
    const leftCluster = layout.clusters.find(
      (cluster) => cluster.placementZone === "top-left",
    );
    if (!rightCluster || !leftCluster) {
      throw new Error("anchored clusters are required");
    }

    const rightColumn = rightCluster.columns[0];
    const leftColumn = leftCluster.columns[0];
    if (!rightColumn || !leftColumn) {
      throw new Error("anchored columns are required");
    }
    const propertiesRowIndex = rightColumn.rows.findIndex(
      (row) => row.panelId === "properties",
    );
    const propertiesRow = rightColumn.rows.splice(propertiesRowIndex, 1)[0];
    if (!propertiesRow) throw new Error("properties row is required");
    leftColumn.rows.push(propertiesRow);

    useStore.setState({ panelWorkspaceLayout: layout });
    const { container } = render(
      <PanelWorkspace>
        <div />
      </PanelWorkspace>,
    );
    const propertiesFrame = container.querySelector<HTMLElement>(
      '.workspace-panel-frame[data-panel="properties"]',
    );

    expect(propertiesFrame?.getAttribute("data-side")).toBe("right");
    expect(propertiesFrame?.getAttribute("data-zone")).toBe("top-left");
    expect(propertiesFrame?.style.left).not.toBe("");
    expect(propertiesFrame?.style.right).toBe("");
  });
});

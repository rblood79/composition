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
import { snapPanelWorkspacePanel } from "./panelWorkspaceLayoutInteraction";
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
    useStore
      .getState()
      .initializePanelWorkspaceLayout(
        [...TEST_CONFIGS, STYLES_TEST_CONFIG].map(
          createPanelWorkspaceRegistryEntry,
        ),
      );
    useStore.setState({
      panelWorkspaceLayout: createPanelWorkspaceLayoutV2(),
      panelWorkspaceHydrationStatus: "memory-fallback",
      panelWorkspaceHydrationError: null,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("cache-clear legacy anchor를 floating overlay로 승격해 Canvas 전체 track을 유지한다", () => {
    const { container } = render(
      <PanelWorkspace>
        <div data-testid="canvas-content" />
      </PanelWorkspace>,
    );
    const host = container.querySelector<HTMLElement>(".panel-workspace-host");
    const main = container.querySelector<HTMLElement>(".panel-workspace-main");

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

    const bottomRail = container.querySelector(
      '.panel-activity-rail[data-side="bottom"]',
    );
    expect(bottomRail?.querySelectorAll(".panel-nav button")).toHaveLength(1);
    expect(
      bottomRail
        ?.querySelector(".panel-nav button")
        ?.getAttribute("aria-label"),
    ).toBe("monitor");
    expect(container.querySelector(".panel-trace-driver")).toBeNull();
    expect(
      container
        .querySelector('.workspace-panel-frame[data-panel="nodes"]')
        ?.getAttribute("data-anchor"),
    ).toBe("floating");
    expect(
      container
        .querySelector('.workspace-panel-frame[data-panel="properties"]')
        ?.getAttribute("data-anchor"),
    ).toBe("floating");
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
    const layout = createPanelWorkspaceLayoutV2();
    layout.railOrder.bottom = [];
    layout.railOrder.right.push("monitor");
    useStore.setState({ panelWorkspaceLayout: layout });

    const { container } = render(
      <PanelWorkspace>
        <div />
      </PanelWorkspace>,
    );

    expect(
      container.querySelector('.panel-activity-rail[data-side="bottom"]'),
    ).toBeNull();
    expect(
      container.querySelector(
        '.panel-activity-rail[data-side="right"] button[aria-label="monitor"]',
      ),
    ).not.toBeNull();
    expect(
      container.querySelector('.workspace-panel-frame[data-panel="monitor"]'),
    ).not.toBeNull();
  });

  it("right/left rail activation은 legacy anchor를 되살리지 않고 floating placement를 유지한다", () => {
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
    useStore.setState({ panelWorkspaceLayout: layout });

    const { container } = render(
      <PanelWorkspace>
        <div />
      </PanelWorkspace>,
    );

    const clickRailButton = (side: "left" | "right", panelId: string) => {
      const button = container.querySelector<HTMLButtonElement>(
        `.panel-activity-rail[data-side="${side}"] button[aria-label="${panelId}"]`,
      );
      if (!button) throw new Error(`${panelId} rail button is required`);
      fireEvent.click(button);
    };

    clickRailButton("right", "history");
    clickRailButton("left", "settings");

    const updated = useStore.getState().panelWorkspaceLayout!;
    expect(updated.visibility.history).toBe(true);
    expect(updated.visibility.settings).toBe(true);
    expect(
      updated.clusters.every((cluster) => cluster.anchor === "floating"),
    ).toBe(true);
  });

  it("cross-rail snap은 anchor 기준 outer edge와 shared column splitter 하나를 렌더링한다", () => {
    const layout = createPanelWorkspaceLayoutV2();
    layout.visibility.settings = true;
    const snapped = snapPanelWorkspacePanel(
      layout,
      PANEL_WORKSPACE_TEST_REGISTRY,
      "settings",
      "properties",
      "left",
    );
    expect(snapped.ok).toBe(true);
    if (!snapped.ok) return;
    useStore.setState({ panelWorkspaceLayout: snapped.value.layout });

    const { container } = render(
      <PanelWorkspace>
        <div />
      </PanelWorkspace>,
    );
    const settingsFrame = container.querySelector(
      '.workspace-panel-frame[data-panel="settings"]',
    );

    expect(settingsFrame?.getAttribute("data-side")).toBe("left");
    expect(settingsFrame?.getAttribute("data-anchor")).toBe("floating");
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
});

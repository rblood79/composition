// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { PanelLeft } from "lucide-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PanelConfig } from "../panels/core/types";
import { PanelRegistry } from "../panels/core/PanelRegistry";
import { useStore } from "../stores";
import {
  PANEL_WORKSPACE_TEST_REGISTRY,
  createPanelWorkspaceLayoutV2,
} from "./panelWorkspaceLayoutV2.testFixtures";
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
    vi.spyOn(PanelRegistry, "getAllPanels").mockReturnValue(TEST_CONFIGS);
    vi.spyOn(PanelRegistry, "getPanel").mockImplementation((panelId) =>
      TEST_CONFIGS.find((config) => config.id === panelId),
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

  it("anchored left/right demand와 rail을 같은 snapshot의 Grid track 변수로 적용한다", () => {
    const { container } = render(
      <PanelWorkspace>
        <div data-testid="canvas-content" />
      </PanelWorkspace>,
    );
    const host = container.querySelector<HTMLElement>(".panel-workspace-host");
    const main = container.querySelector<HTMLElement>(".panel-workspace-main");

    expect(host?.style.getPropertyValue("--panel-workspace-inset-left")).toBe(
      "542px",
    );
    expect(host?.style.getPropertyValue("--panel-workspace-inset-right")).toBe(
      "372px",
    );
    expect(host?.style.getPropertyValue("--panel-workspace-inset-bottom")).toBe(
      "48px",
    );
    expect(main?.getAttribute("data-main-x")).toBe("542");
    expect(main?.getAttribute("data-main-width")).toBe("686");
    expect(main?.getAttribute("data-main-height")).toBe("804");
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
});

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

describe("ADR-922 PanelWorkspace occupiedInsets shell", () => {
  beforeEach(() => {
    vi.spyOn(PanelRegistry, "getAllPanels").mockReturnValue(TEST_CONFIGS);
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
  });
});

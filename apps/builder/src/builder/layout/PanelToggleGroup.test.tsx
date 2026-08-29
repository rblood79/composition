// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/react";
import { PanelLeft } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../i18n";
import { PanelRegistry } from "../panels/core/PanelRegistry";
import type { PanelConfig, PanelId } from "../panels/core/types";
import { PanelToggleGroup } from "./PanelToggleGroup";

function panelConfig(
  id: PanelId,
  overrides: Partial<PanelConfig> = {},
): PanelConfig {
  return {
    id,
    name: id,
    icon: PanelLeft,
    component: () => null,
    category: "editor",
    defaultPosition: id === "nodes" ? "left" : "right",
    defaultWidth: 320,
    minWidth: 233,
    maxWidth: 640,
    defaultHeight: 300,
    minHeight: 160,
    maxHeight: 800,
    ...overrides,
  };
}

function renderGroup(
  activePanels: PanelId[],
  onPanelToggle = vi.fn<(panelId: PanelId) => void>(),
) {
  const configs = [
    panelConfig("nodes"),
    panelConfig("properties"),
    panelConfig("settings", { hiddenFromRail: true }),
  ];
  vi.spyOn(PanelRegistry, "getPanel").mockImplementation((panelId) =>
    configs.find((config) => config.id === panelId),
  );

  return {
    ...render(
      <I18nProvider initialLocale="en-US">
        <PanelToggleGroup
          side="left"
          panelIds={["nodes", "properties", "settings"]}
          activePanels={activePanels}
          onPanelToggle={onPanelToggle}
        />
      </I18nProvider>,
    ),
    onPanelToggle,
  };
}

describe("PanelToggleGroup", () => {
  Object.defineProperty(Element.prototype, "getAnimations", {
    configurable: true,
    value: () => [],
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("nav/list 흔적 없이 vertical multiple ToggleButtonGroup을 렌더한다", () => {
    const { container, getByRole, queryByRole } = renderGroup(["nodes"]);
    const group = getByRole("toolbar", { name: "Left panel controls" });

    expect(group.getAttribute("data-orientation")).toBe("vertical");
    expect(group.getAttribute("data-indicator")).toBe("true");
    expect(group.classList.contains("builder-control-group")).toBe(true);
    expect(container.querySelector("nav, ul, li")).toBeNull();
    expect(queryByRole("button", { name: "Settings" })).toBeNull();
  });

  it("workspace visibility를 aria-pressed로 투영한다", () => {
    const { getByRole } = renderGroup(["nodes"]);

    expect(
      getByRole("button", { name: "Navigator" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      getByRole("button", { name: "Properties" }).getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("RAC의 다음 Set에서 달라진 panelId 하나만 workspace 명령으로 전달한다", () => {
    const { getByRole, onPanelToggle } = renderGroup(["nodes"]);

    fireEvent.click(getByRole("button", { name: "Properties" }));

    expect(onPanelToggle).toHaveBeenCalledTimes(1);
    expect(onPanelToggle).toHaveBeenCalledWith("properties");
  });
});

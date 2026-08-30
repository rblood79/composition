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
    defaultPosition: id === "navigator" ? "left" : "right",
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
    panelConfig("navigator"),
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
          panelIds={["navigator", "properties", "settings"]}
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

  it("모든 rail 버튼이 아이콘을 그린다 (statePair 유무와 무관)", () => {
    const { container } = renderGroup(["navigator"]);
    const buttons = [...container.querySelectorAll(".panel-toggle-rail button")];
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect(button.querySelectorAll("svg")).toHaveLength(1);
    }
  });

  it("statePair 를 가진 패널은 열림/닫힘 형태가 다르고, 없는 패널은 같다", () => {
    const withStatePair = (activePanels: PanelId[]) => {
      const configs = [
        panelConfig("navigator", { statePair: "ai" }),
        panelConfig("properties"),
      ];
      vi.spyOn(PanelRegistry, "getPanel").mockImplementation((panelId) =>
        configs.find((config) => config.id === panelId),
      );
      return render(
        <I18nProvider initialLocale="en-US">
          <PanelToggleGroup
            side="left"
            panelIds={["navigator", "properties"]}
            activePanels={activePanels}
            onPanelToggle={vi.fn()}
          />
        </I18nProvider>,
      ).container;
    };
    // rail 버튼은 panelIds 순서대로 렌더된다 (0 = statePair 있는 navigator).
    const d = (root: HTMLElement, index: number) =>
      root
        .querySelectorAll(".panel-toggle-rail button")
        [index]?.querySelector("svg path")
        ?.getAttribute("d");

    const closedRoot = withStatePair([]);
    const closedPair = d(closedRoot, 0);
    const closedPlain = d(closedRoot, 1);
    expect(closedPair).toBeTruthy();
    cleanup();
    vi.restoreAllMocks();

    const openRoot = withStatePair(["navigator", "properties"]);
    expect(d(openRoot, 0)).not.toBe(closedPair);
    expect(d(openRoot, 1)).toBe(closedPlain);
  });

  it("nav/list 흔적 없이 vertical multiple ToggleButtonGroup을 렌더한다", () => {
    const { container, getByRole, queryByRole } = renderGroup(["navigator"]);
    const group = getByRole("toolbar", { name: "Left panel controls" });

    expect(group.getAttribute("data-orientation")).toBe("vertical");
    expect(group.getAttribute("data-indicator")).toBe("true");
    expect(group.classList.contains("builder-control-group")).toBe(true);
    expect(container.querySelector("nav, ul, li")).toBeNull();
    expect(queryByRole("button", { name: "Settings" })).toBeNull();
  });

  it("workspace visibility를 aria-pressed로 투영한다", () => {
    const { getByRole } = renderGroup(["navigator"]);

    expect(
      getByRole("button", { name: "Navigator" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      getByRole("button", { name: "Properties" }).getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("RAC의 다음 Set에서 달라진 panelId 하나만 workspace 명령으로 전달한다", () => {
    const { getByRole, onPanelToggle } = renderGroup(["navigator"]);

    fireEvent.click(getByRole("button", { name: "Properties" }));

    expect(onPanelToggle).toHaveBeenCalledTimes(1);
    expect(onPanelToggle).toHaveBeenCalledWith("properties");
  });
});

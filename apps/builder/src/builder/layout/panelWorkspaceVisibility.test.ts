// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  configs: [{ id: "codeView" }, { id: "navigator" }],
  createRegistryEntry: vi.fn((config: { id: string }) => ({ id: config.id })),
  dispatchActivation: vi.fn(() => true),
  activatePolicy: vi.fn(() => ({ ok: true, value: { layout: "next" } })),
  initializeLayout: vi.fn(),
  setLayout: vi.fn(),
  storeState: {
    panelWorkspaceLayout: {
      visibility: { codeView: false },
    } as { visibility: Record<string, boolean> } | null,
  },
}));

vi.mock("../panels/core/PanelRegistry", () => ({
  PanelRegistry: { getAllPanels: () => mocks.configs },
}));
vi.mock("./panelWorkspaceActivationDispatcher", () => ({
  dispatchPanelWorkspaceActivation: mocks.dispatchActivation,
}));
vi.mock("./panelWorkspaceLayoutV2", () => ({
  createPanelWorkspaceRegistryEntry: mocks.createRegistryEntry,
}));
vi.mock("./panelWorkspacePolicyV4", () => ({
  activatePanelWorkspacePanelV4: mocks.activatePolicy,
}));
vi.mock("../stores/builderUiStore", () => ({
  useBuilderUiStore: {
    getState: () => ({
      ...mocks.storeState,
      initializePanelWorkspaceLayout: mocks.initializeLayout,
      setPanelWorkspaceLayout: mocks.setLayout,
    }),
  },
}));

import {
  dismissCanvasSelectionPanels,
  setPanelWorkspacePanelVisibility,
} from "./panelWorkspaceVisibility";

describe("setPanelWorkspacePanelVisibility (ADR-212 UI-8)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    for (const fn of Object.values(mocks)) {
      if (typeof fn === "function" && "mockClear" in fn) fn.mockClear();
    }
    mocks.storeState.panelWorkspaceLayout = {
      visibility: { codeView: false },
    };
  });

  it("측정한 panel-dock-stage rect 로 registry 를 만들고 dispatcher 에 (id, visible) 을 넘긴다", () => {
    const stage = document.createElement("div");
    stage.className = "panel-dock-stage";
    Object.defineProperties(stage, {
      clientWidth: { configurable: true, value: 1234 },
      clientHeight: { configurable: true, value: 567 },
    });
    document.body.appendChild(stage);

    setPanelWorkspacePanelVisibility("codeView", true);

    expect(mocks.createRegistryEntry).toHaveBeenNthCalledWith(
      1,
      mocks.configs[0],
      { width: 1234, height: 567 },
    );
    expect(mocks.dispatchActivation).toHaveBeenCalledWith(
      "codeView",
      true,
    );
    expect(mocks.activatePolicy).not.toHaveBeenCalled();
    expect(mocks.setLayout).not.toHaveBeenCalled();
  });

  it("이미 같은 상태면 아무것도 하지 않는다", () => {
    setPanelWorkspacePanelVisibility("codeView", false);
    expect(mocks.dispatchActivation).not.toHaveBeenCalled();
    expect(mocks.setLayout).not.toHaveBeenCalled();
  });

  it("dispatcher 가 없으면 같은 정책 함수 (activatePanelWorkspacePanelV4) 로 폴백한다 — visibility 직접 쓰기 0", () => {
    mocks.dispatchActivation.mockReturnValueOnce(false);
    setPanelWorkspacePanelVisibility("codeView", true);
    expect(mocks.activatePolicy).toHaveBeenCalledTimes(1);
    expect(mocks.setLayout).toHaveBeenCalledWith("next");
  });

  it("Canvas 빈 공간은 page/selection 문맥 패널만 닫고 project/app 패널은 유지한다", () => {
    mocks.configs.splice(
      0,
      mocks.configs.length,
      ...[
        "navigator",
        "components",
        "datatable",
        "codeView",
        "theme",
        "ai",
        "properties",
        "styles",
        "events",
        "history",
        "settings",
        "site",
      ].map((id) => ({ id })),
    );
    mocks.storeState.panelWorkspaceLayout = {
      visibility: Object.fromEntries(mocks.configs.map(({ id }) => [id, true])),
    };

    dismissCanvasSelectionPanels();

    expect(mocks.dispatchActivation.mock.calls).toEqual(
      [
        "navigator",
        "components",
        "codeView",
        "ai",
        "properties",
        "styles",
        "events",
        "history",
      ].map((panelId) => [panelId, false]),
    );
  });
});

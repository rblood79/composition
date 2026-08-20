import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  configs: [{ id: "datatableEditor" }, { id: "nodes" }],
  createRegistryEntry: vi.fn((config: { id: string }, rect: unknown) => ({
    config,
    rect,
  })),
  dispatchActivation: vi.fn(() => true),
  initializeLayout: vi.fn(),
  setLayout: vi.fn(),
  storeState: {
    panelWorkspaceLayout: {
      visibility: { datatableEditor: false },
    },
  },
}));

vi.mock("../../core/PanelRegistry", () => ({
  PanelRegistry: {
    getAllPanels: () => mocks.configs,
  },
}));

vi.mock("../../../layout/panelWorkspaceActivationDispatcher", () => ({
  dispatchPanelWorkspaceActivation: mocks.dispatchActivation,
}));

vi.mock("../../../layout/panelWorkspaceLayoutV2", () => ({
  createPanelWorkspaceRegistryEntry: mocks.createRegistryEntry,
}));

vi.mock("../../../stores", () => ({
  useStore: {
    getState: () => ({
      ...mocks.storeState,
      initializePanelWorkspaceLayout: mocks.initializeLayout,
      setPanelWorkspaceLayout: mocks.setLayout,
    }),
  },
}));

import { useDataTableEditorStore } from "./dataTableEditorStore";

describe("DataTableEditorStore panel activation", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    mocks.createRegistryEntry.mockClear();
    mocks.dispatchActivation.mockClear();
    mocks.initializeLayout.mockClear();
    mocks.setLayout.mockClear();
    useDataTableEditorStore.setState({ mode: null });
  });

  it("uses the measured panel-dock rect before activating the editor panel", () => {
    const dock = document.createElement("div");
    dock.className = "panel-dock";
    Object.defineProperties(dock, {
      clientWidth: { configurable: true, value: 1234 },
      clientHeight: { configurable: true, value: 567 },
    });
    document.body.appendChild(dock);

    useDataTableEditorStore.getState().openTableCreator("project-1");

    expect(mocks.createRegistryEntry).toHaveBeenCalledTimes(2);
    expect(mocks.createRegistryEntry).toHaveBeenNthCalledWith(
      1,
      mocks.configs[0],
      { width: 1234, height: 567 },
    );
    expect(mocks.dispatchActivation).toHaveBeenCalledWith("datatableEditor");
    expect(mocks.setLayout).not.toHaveBeenCalled();
    expect(useDataTableEditorStore.getState().mode).toEqual({
      type: "table-create",
      projectId: "project-1",
    });
  });
});

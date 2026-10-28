// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ADR-212 UI-8 → ADR-288 — the Data panel is one surface: `open*` sets the body's mode and shows
 * the `datatable` panel through `setPanelWorkspacePanelVisibility` (the one path); `close` only
 * empties the body (the panel stays). There is no editor or field panel to show or hide.
 */
const mocks = vi.hoisted(() => ({
  setVisibility: vi.fn(),
}));

vi.mock("../../../layout/panelWorkspaceVisibility", () => ({
  setPanelWorkspacePanelVisibility: mocks.setVisibility,
}));

import { useDataTableEditorStore } from "./dataTableEditorStore";

describe("DataTableEditorStore (ADR-288 — one data surface)", () => {
  beforeEach(() => {
    mocks.setVisibility.mockClear();
    useDataTableEditorStore.setState({ mode: null });
  });

  it("open* 은 일반 open(mode) 을 지나 datatable 패널을 보이게 한다", () => {
    useDataTableEditorStore.getState().openTableCreator("project-1");
    expect(mocks.setVisibility).toHaveBeenCalledWith("datatable", true);
    expect(useDataTableEditorStore.getState().mode).toEqual({
      type: "table-create",
      projectId: "project-1",
    });
    useDataTableEditorStore.getState().openApiEditor("ep-1", "response");
    expect(useDataTableEditorStore.getState().mode).toEqual({
      type: "api-edit",
      endpointId: "ep-1",
      initialTab: "response",
    });
    useDataTableEditorStore.getState().openVariables("project-1");
    expect(useDataTableEditorStore.getState().mode).toEqual({
      type: "variables",
      projectId: "project-1",
    });
    expect(
      mocks.setVisibility.mock.calls.every(
        ([id, visible]) => id === "datatable" && visible === true,
      ),
    ).toBe(true);
  });

  it("close 는 본문만 비운다 — 패널 표시는 건드리지 않는다", () => {
    useDataTableEditorStore.getState().openTableEditor("col-1");
    mocks.setVisibility.mockClear();
    useDataTableEditorStore.getState().close();
    expect(useDataTableEditorStore.getState().mode).toBeNull();
    expect(mocks.setVisibility).not.toHaveBeenCalled();
  });
});

// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ADR-212 UI-8 — 편집 패널 생명주기는 `setPanelWorkspacePanelVisibility` 한 경로다.
 * 여기서는 store 가 그 경로를 어떤 순서·인자로 부르는지, 필드 패널이 편집기 대상과 같이
 * 열리고 닫히는지를 본다. 정책 (스냅 · overflow) 은 `panelWorkspacePolicyV4.test.ts`.
 */
const mocks = vi.hoisted(() => ({
  setVisibility: vi.fn(),
}));

vi.mock("../../../layout/panelWorkspaceVisibility", () => ({
  setPanelWorkspacePanelVisibility: mocks.setVisibility,
}));

import { useDataTableEditorStore } from "./dataTableEditorStore";

describe("DataTableEditorStore panel activation", () => {
  beforeEach(() => {
    mocks.setVisibility.mockClear();
    useDataTableEditorStore.setState({ mode: null, fieldPanel: null });
  });

  it("open* 은 일반 open(mode) 을 지나 편집 패널을 보이게 한다", () => {
    useDataTableEditorStore.getState().openTableCreator("project-1");
    expect(mocks.setVisibility).toHaveBeenCalledWith("datatableEditor", true);
    expect(useDataTableEditorStore.getState().mode).toEqual({
      type: "table-create",
      projectId: "project-1",
    });
    useDataTableEditorStore.getState().openApiEditor("ep-1", "run");
    expect(useDataTableEditorStore.getState().mode).toEqual({
      type: "api-edit",
      endpointId: "ep-1",
      initialTab: "run",
    });
  });

  it("필드 패널은 대상 테이블 편집기와 함께 열리고, 다른 모드로 바뀌면 닫힌다", () => {
    const store = useDataTableEditorStore.getState();
    store.openFieldPanel("col-1", "f-1");
    expect(useDataTableEditorStore.getState().mode).toEqual({
      type: "table-edit",
      tableId: "col-1",
    });
    expect(useDataTableEditorStore.getState().fieldPanel).toEqual({
      collectionId: "col-1",
      fieldId: "f-1",
    });
    expect(mocks.setVisibility).toHaveBeenLastCalledWith(
      "datatableField",
      true,
    );

    // 같은 테이블이면 필드 패널 유지
    mocks.setVisibility.mockClear();
    useDataTableEditorStore.getState().openTableEditor("col-1");
    expect(useDataTableEditorStore.getState().fieldPanel).not.toBeNull();
    expect(mocks.setVisibility).not.toHaveBeenCalledWith(
      "datatableField",
      false,
    );

    // 다른 테이블이면 닫힘
    useDataTableEditorStore.getState().openTableEditor("col-2");
    expect(useDataTableEditorStore.getState().fieldPanel).toBeNull();
    expect(mocks.setVisibility).toHaveBeenCalledWith("datatableField", false);
  });

  it("close 는 필드 패널과 편집 패널을 모두 닫는다", () => {
    useDataTableEditorStore.getState().openFieldPanel("col-1");
    mocks.setVisibility.mockClear();
    useDataTableEditorStore.getState().close();
    expect(useDataTableEditorStore.getState()).toMatchObject({
      mode: null,
      fieldPanel: null,
    });
    expect(mocks.setVisibility.mock.calls).toEqual([
      ["datatableField", false],
      ["datatableEditor", false],
    ]);
  });
});

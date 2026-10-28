// @vitest-environment jsdom
/**
 * Data 본문 shell (table-edit, ADR-288 — 옛 편집 패널의 shell 그대로): 탭 없음 — 격자가 유일한
 * 뷰. 설정은 G6 수정 9 로 목록 행 ⋮ → «Edit table…» 팝오버로 갔으니 헤더에는 gear 가 없고
 * 액션은 Close 하나다. 제목은 더블클릭/Enter 로 인라인 rename (updateCollection { name }).
 * 본문은 stub — shell 계약만 본다.
 */
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { updateCollection } = vi.hoisted(() => ({
  updateCollection: vi.fn(async () => ({})),
}));

const collection = {
  id: "c1",
  name: "Users",
  project_id: "p",
  schema: [{ id: "f-id", key: "id", type: "string" }],
  mockData: [],
  useMockData: true,
};

vi.mock("../../stores/data", () => ({
  useDataStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      collections: new Map([["c1", collection]]),
      apiEndpoints: new Map(),
      variables: new Map(),
      updateCollection,
    }),
}));
vi.mock("./editors", () => ({
  DataTableEditor: () => <div data-testid="table-editor" />,
  DataTableCreator: () => null,
  ApiEndpointEditor: () => null,
  ApiEndpointCreator: () => null,
  VariableCreator: () => null,
}));
vi.mock("./components/VariableList", () => ({ VariableList: () => null }));
vi.mock("../../hooks/usePanelLayout", () => ({
  togglePanelWorkspace: vi.fn(),
}));

import type { ReactNode } from "react";
import { I18nProvider } from "@/i18n";
import { CatalogWorkspaceProvider } from "../../catalogRuntime/react";
import type { CatalogWorkspace } from "../../catalogRuntime/workspace";
import { DataSurfaceBody } from "./DataSurfaceBody";

// (An open project — the panel waits for the workspace; its body reads only the hosts.)
const wrap = (node: ReactNode) => (
  <I18nProvider initialLocale="en-US">
    <CatalogWorkspaceProvider workspace={{} as CatalogWorkspace}>
      {node}
    </CatalogWorkspaceProvider>
  </I18nProvider>
);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const close = vi.fn();
const body = () => (
  <DataSurfaceBody mode={{ type: "table-edit", tableId: "c1" }} close={close} />
);

describe("DataSurfaceBody · table-edit shell", () => {
  it("탭 없음 · gear 없음 — 헤더 액션은 Close 하나, 본문은 격자", () => {
    const { container, queryByRole, getByTestId } = render(wrap(body()));
    expect(container.querySelector('[role="tablist"]')).toBeNull();
    expect(container.querySelector(".panel-tab")).toBeNull();
    expect(getByTestId("table-editor")).not.toBeNull();

    // G6 수정 9: the gear (settings view toggle) is gone — settings live in the list row's ⋮.
    expect(queryByRole("button", { name: "Settings" })).toBeNull();
    const actions = Array.from(
      container.querySelectorAll(".panel-actions button"),
    );
    expect(actions.map((b) => b.getAttribute("aria-label"))).toEqual([
      "Close",
    ]);
    expect(container.querySelector(".panel-title-text")?.textContent).toBe(
      "Users",
    );
  });

  it("제목 더블클릭 → 인라인 입력 → Enter = updateCollection({ name }) · Esc 취소 · 빈 값 무시", () => {
    const { container } = render(wrap(body()));
    const title = container.querySelector(
      ".panel-title-renamable",
    ) as HTMLElement;
    expect(title.getAttribute("role")).toBe("button");
    fireEvent.doubleClick(title);
    const input = container.querySelector(
      ".panel-title-input",
    ) as HTMLInputElement;
    expect(input.value).toBe("Users");
    fireEvent.change(input, { target: { value: "Members" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(updateCollection).toHaveBeenCalledWith("c1", { name: "Members" });
    expect(container.querySelector(".panel-title-input")).toBeNull();

    // Enter 로도 열리고 Esc 는 commit 없이 닫는다
    fireEvent.keyDown(
      container.querySelector(".panel-title-renamable") as HTMLElement,
      { key: "Enter" },
    );
    const input2 = container.querySelector(
      ".panel-title-input",
    ) as HTMLInputElement;
    fireEvent.change(input2, { target: { value: "" } });
    fireEvent.keyDown(input2, { key: "Escape" });
    expect(updateCollection).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".panel-title-input")).toBeNull();
  });
});

// @vitest-environment jsdom
/**
 * 테이블 편집기 shell (table-edit): 탭 없음 — 격자가 유일한 뷰, 설정은 헤더 gear 토글
 * (aria-pressed) 로 같은 자리에서 본문만 바뀐다. 제목은 더블클릭/Enter 로 인라인 rename
 * (updateCollection { name }). 편집기 본문은 stub — shell 계약만 본다.
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
  DataTableEditor: ({ view }: { view: string }) => (
    <div data-testid="table-editor" data-view={view} />
  ),
  DataTableCreator: () => null,
  ApiEndpointEditor: () => null,
  VariableEditor: () => null,
  ApiEndpointCreator: () => null,
  VariableCreator: () => null,
}));
vi.mock("../../hooks/usePanelLayout", () => ({
  togglePanelWorkspace: vi.fn(),
}));

import type { ReactNode } from "react";
import { I18nProvider } from "@/i18n";
import { DataTableEditorPanel } from "./DataTableEditorPanel";
import { useDataTableEditorStore } from "./stores/dataTableEditorStore";

const wrap = (node: ReactNode) => (
  <I18nProvider initialLocale="en-US">{node}</I18nProvider>
);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DataTableEditorPanel · table-edit shell", () => {
  it("탭 없음 · gear 토글이 격자 ↔ 설정을 같은 자리에서 바꾼다 (aria-pressed)", () => {
    useDataTableEditorStore.setState({
      mode: { type: "table-edit", tableId: "c1" },
    });
    const { container, getByRole, getByTestId } = render(
      wrap(<DataTableEditorPanel />),
    );
    expect(container.querySelector('[role="tablist"]')).toBeNull();
    expect(container.querySelector(".panel-tab")).toBeNull();
    expect(getByTestId("table-editor").getAttribute("data-view")).toBe("grid");

    const gear = getByRole("button", { name: "Settings" });
    expect(gear.getAttribute("aria-pressed")).toBe("false");
    // gear 는 close 왼쪽 (같은 .panel-actions 안, close 가 마지막)
    const actions = Array.from(
      container.querySelectorAll(".panel-actions button"),
    );
    expect(actions.at(-1)?.getAttribute("aria-label")).toBe("Close");
    expect(actions.indexOf(gear)).toBe(actions.length - 2);

    fireEvent.click(gear);
    expect(gear.getAttribute("aria-pressed")).toBe("true");
    expect(getByTestId("table-editor").getAttribute("data-view")).toBe(
      "settings",
    );
    // 제목은 그대로
    expect(container.querySelector(".panel-title-text")?.textContent).toBe(
      "Users",
    );
    fireEvent.click(gear);
    expect(getByTestId("table-editor").getAttribute("data-view")).toBe("grid");
  });

  it("제목 더블클릭 → 인라인 입력 → Enter = updateCollection({ name }) · Esc 취소 · 빈 값 무시", () => {
    useDataTableEditorStore.setState({
      mode: { type: "table-edit", tableId: "c1" },
    });
    const { container } = render(wrap(<DataTableEditorPanel />));
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

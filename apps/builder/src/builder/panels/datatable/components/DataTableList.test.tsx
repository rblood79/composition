// @vitest-environment jsdom
/**
 * ADR-212 Phase 1 — 목록 항목은 RAC GridList 행 (A5: 키보드로 열림) 이고 배지가
 * 필드 · 행 · 소스 · 사용처 N · 마지막 실행 오류를 낸다 (UI-6). 삭제는 role=status 로 알린다.
 */
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const deleteCollection = vi.fn(async () => {});
const state = {
  collections: new Map([
    [
      "c1",
      {
        id: "c1",
        name: "Users",
        schema: [
          { key: "id", type: "string" },
          { key: "name", type: "string" },
        ],
        mockData: [{ id: 1 }, { id: 2 }],
        useMockData: true,
      },
    ],
    [
      "c2",
      {
        id: "c2",
        name: "Orders",
        schema: [{ key: "id", type: "string" }],
        mockData: [],
        runtimeData: [],
        useMockData: false,
      },
    ],
  ]),
  apiEndpoints: new Map([
    [
      "orders-api",
      {
        id: "ep1",
        name: "orders-api",
        targetCollectionId: "c2",
        method: "GET",
      },
    ],
  ]),
  apiRuns: new Map([
    [
      "ep1",
      { ok: false, response: { status: 401 }, durationMs: 88, startedAt: "" },
    ],
  ]),
  deleteCollection,
};

vi.mock("../../../stores/data", () => ({
  useDataStore: (selector: (s: typeof state) => unknown) => selector(state),
}));
import type { ReactNode } from "react";
import { I18nProvider } from "@/i18n";
import { DataTableList } from "./DataTableList";
import { useDataPanelStatusStore } from "../stores/dataPanelStatusStore";
import {
  DataUsageSourceContext,
  type DataUsageSource,
} from "../usage/dataUsageSource";

/** ADR-248 4e-9 C: the document's usage — two nodes bind Users (c1). */
const USAGE: DataUsageSource = {
  useCollectionUsage: () => new Map([["c1", 2]]),
  useFieldUsage: () => [],
};

const wrap = (node: ReactNode) => (
  <I18nProvider initialLocale="en-US">
    <DataUsageSourceContext.Provider value={USAGE}>
      {node}
    </DataUsageSourceContext.Provider>
  </I18nProvider>
);

afterEach(() => {
  cleanup();
  useDataPanelStatusStore.setState({ status: null });
});

describe("DataTableList (ADR-212 Phase 1)", () => {
  it("행은 role=row 이고 Enter 로 열리며 메타 한 줄이 소스 · 필드 · 행 · 사용처 · 오류를 낸다", () => {
    const onEditingChange = vi.fn();
    const { container } = render(
      wrap(
        <DataTableList
          projectId="p"
          editingId={null}
          onEditingChange={onEditingChange}
          onCreateClick={() => {}}
        />,
      ),
    );
    const rows = container.querySelectorAll('[role="row"]');
    expect(rows).toHaveLength(2);
    expect(container.querySelector('[role="grid"]')).not.toBeNull();
    // c2: 0행 → data-empty, 마지막 실행 401 → data-error + 메타 첫 칸이 오류
    expect(rows[1].getAttribute("data-empty")).toBe("true");
    expect(rows[1].getAttribute("data-error")).toBe("true");
    expect(rows[1].getAttribute("data-source")).toBe("api");
    expect(rows[0].getAttribute("data-source")).toBe("local");
    // ADR-288 G6 수정 10 — Navigator Pages 행: 이름만 글자, 메타는 title (hover) 로
    expect(rows[0].querySelector(".elementItem")).not.toBeNull();
    expect(rows[0].querySelector(".datatable-tree-meta")).toBeNull();
    expect(
      rows[0].querySelector(".elementItemLabel")?.getAttribute("title"),
    ).toMatch(/Sample · 2 fields · 2 rows · used by 2/);
    expect(
      rows[1].querySelector(".elementItemLabel")?.getAttribute("title"),
    ).toMatch(/401/);
    // 행 액션 = 설정 · 삭제 아이콘 (Pages 와 같은 자리)
    expect(
      rows[0].querySelector('button[aria-label="Table settings Users"]'),
    ).not.toBeNull();
    expect(
      rows[0].querySelector('button[aria-label="Delete Users"]'),
    ).not.toBeNull();

    // 키보드 열림 — 행에 포커스 후 Enter
    (rows[0] as HTMLElement).focus();
    fireEvent.keyDown(rows[0], { key: "Enter" });
    fireEvent.keyUp(rows[0], { key: "Enter" });
    expect(onEditingChange).toHaveBeenCalledWith("c1");
    // G6 — 편집 버튼 없음, 행 선택 (클릭) 이 곧 열기
    expect(
      container.querySelector('button[aria-label^="Edit"]'),
    ).toBeNull();
    // G6 — 「New table」 은 목록 아래 버튼이 아니라 섹션 헤더 액션 (Navigator Pages 패턴)
    expect(container.querySelector('.control-button[data-variant="add"]')).toBeNull();
    expect(
      container.querySelector('.section-header button[aria-label="New table"]'),
    ).not.toBeNull();
    onEditingChange.mockClear();
    fireEvent.pointerDown(rows[1], { pointerType: "mouse", button: 0 });
    fireEvent.pointerUp(rows[1], { pointerType: "mouse", button: 0 });
    fireEvent.click(rows[1]);
    expect(onEditingChange).toHaveBeenCalledWith("c2");
  });

  it("삭제는 ConfirmDialog 뒤 wrapper 를 부르고 role=status 로 알린다", async () => {
    const { container, getByRole } = render(
      wrap(
        <DataTableList
          projectId="p"
          editingId={null}
          onEditingChange={() => {}}
          onCreateClick={() => {}}
        />,
      ),
    );
    const del = container.querySelector(
      'button[aria-label="Delete Users"]',
    ) as HTMLElement;
    expect(del).not.toBeNull();
    // RAC usePress — pointer 시퀀스로 눌러야 onPress 가 난다
    fireEvent.pointerDown(del, { pointerType: "mouse", button: 0 });
    fireEvent.pointerUp(del, { pointerType: "mouse", button: 0 });
    fireEvent.click(del);
    const confirm = await vi.waitFor(() => getByRole("alertdialog"));
    const buttons = confirm.querySelectorAll("button");
    const ok = buttons[buttons.length - 1];
    fireEvent.pointerDown(ok, { pointerType: "mouse", button: 0 });
    fireEvent.pointerUp(ok, { pointerType: "mouse", button: 0 });
    fireEvent.click(ok);
    await vi.waitFor(() => expect(deleteCollection).toHaveBeenCalledWith("c1"));
    await vi.waitFor(() =>
      expect(useDataPanelStatusStore.getState().status?.message).toMatch(
        /Users/,
      ),
    );
  });

  it("설정 아이콘은 행 아래 표 설정 팝오버 (이름 · Use Table Data · API endpoint · Execution policy)", async () => {
    const { container, getByRole } = render(
      wrap(
        <DataTableList
          projectId="p"
          editingId={null}
          onEditingChange={() => {}}
          onCreateClick={() => {}}
        />,
      ),
    );
    expect(container.querySelector(".datatable-settings-popover")).toBeNull();
    const edit = container.querySelector(
      'button[aria-label="Table settings Users"]',
    ) as HTMLElement;
    fireEvent.pointerDown(edit, { pointerType: "mouse", button: 0 });
    fireEvent.pointerUp(edit, { pointerType: "mouse", button: 0 });
    fireEvent.click(edit);
    const dialog = await vi.waitFor(() =>
      getByRole("dialog", { name: "Table settings Users" }),
    );
    // G6 수정 12 — panel Section + inspector rows (no local form classes)
    expect(dialog.querySelector(".section .section-content")).not.toBeNull();
    expect(dialog.querySelectorAll(".fieldset-row").length).toBe(4);
    expect(dialog.querySelector(".settings-editor, .settings-input")).toBeNull();
    const name = [...dialog.querySelectorAll("fieldset")].find(
      (f) => f.querySelector("legend")?.textContent === "Table Name",
    );
    expect((name?.querySelector("input") as HTMLInputElement).value).toBe(
      "Users",
    );
    expect(dialog.textContent).toContain("Use Table Data");
    expect(dialog.textContent).toContain("API endpoint");
    expect(dialog.textContent).toContain("Execution policy");
  });
});

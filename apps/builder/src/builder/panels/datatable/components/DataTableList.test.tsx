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
vi.mock("../../../stores", () => ({
  useStore: (selector: (s: { elements: unknown[] }) => unknown) =>
    selector({ elements: [] }),
}));
vi.mock("../../../../services/ai/tools/canonicalToolReadModel", () => ({
  getAiToolReadModel: () => ({
    elements: [
      {
        id: "e1",
        props: { dataBinding: { source: "dataTable", collectionId: "c1" } },
      },
      {
        id: "e2",
        props: { dataBinding: { source: "dataTable", collectionId: "c1" } },
      },
    ],
  }),
}));

import type { ReactNode } from "react";
import { I18nProvider } from "@/i18n";
import { DataTableList } from "./DataTableList";
import { useDataPanelStatusStore } from "../stores/dataPanelStatusStore";

const wrap = (node: ReactNode) => (
  <I18nProvider initialLocale="en-US">{node}</I18nProvider>
);

afterEach(() => {
  cleanup();
  useDataPanelStatusStore.setState({ status: null });
});

describe("DataTableList (ADR-212 Phase 1)", () => {
  it("행은 role=row 이고 Enter 로 열리며 배지가 사용처 · 소스 · 오류를 낸다", () => {
    const onEditingChange = vi.fn();
    const { container, getByText } = render(
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
    // 사용처 2 (c1) · 0 (c2)
    expect(getByText(/used by 2/)).toBeTruthy();
    expect(rows[0].textContent).toContain("2");
    // c2: 0행 → data-empty, 마지막 실행 401 → error 배지
    expect(rows[1].getAttribute("data-empty")).toBe("true");
    expect(rows[1].getAttribute("data-error")).toBe("true");
    expect(rows[1].querySelector(".list-item-badge.error")).not.toBeNull();
    expect(rows[0].querySelector(".list-item-badge.local")).not.toBeNull();

    // 키보드 열림 — 행에 포커스 후 Enter
    (rows[0] as HTMLElement).focus();
    fireEvent.keyDown(rows[0], { key: "Enter" });
    fireEvent.keyUp(rows[0], { key: "Enter" });
    expect(onEditingChange).toHaveBeenCalledWith("c1");
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
      'button[aria-label$="Users"][aria-label^="Delete"], button[aria-label$="Users"][aria-label^="삭제"]',
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
});

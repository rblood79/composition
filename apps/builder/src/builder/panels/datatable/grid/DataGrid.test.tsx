// @vitest-environment jsdom
/**
 * ADR-212 Phase 2 (G1 unit) — DataGrid: RAC Table role=grid, 셀 편집 (Enter 진입 · Enter commit +
 * 아래 · Tab commit + 오른쪽 · Esc 취소 · 타이핑 진입), 쓰기는 전부 `applyDataChange` (HC1),
 * 강제 실패는 aria-invalid + 오류 토스트, 붙여넣기 → set_cell/insert_rows, 넘치는 열은 ConfirmDialog, 행 추가.
 * Virtualizer 는 jsdom 뷰포트가 0 이라 끈다 (`virtualized={false}`) — 가상화 경로는 G1 live.
 */
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { applyDataChange, toastError } = vi.hoisted(() => ({
  applyDataChange: vi.fn(async () => ({})),
  toastError: vi.fn(),
}));

vi.mock("../../../stores/data", () => ({
  useDataStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ applyDataChange }),
}));
// 오류는 토스트 (Phase 1 결정 — role=status 는 결과만), 결과는 Data 패널 status 영역
vi.mock("../../../stores/toast", () => ({
  globalToast: { error: toastError, success: vi.fn(), warning: vi.fn() },
}));

import type { ReactNode } from "react";
import { I18nProvider } from "@/i18n";
import type { DataTable } from "../../../../types/builder/data.types";
import { useDataPanelStatusStore } from "../stores/dataPanelStatusStore";
import { DataGrid } from "./DataGrid";

const table: DataTable = {
  id: "c1",
  name: "Users",
  project_id: "p",
  schema: [
    { id: "f-id", key: "id", type: "number" },
    { id: "f-name", key: "name", type: "string" },
    { id: "f-age", key: "age", type: "number" },
    { id: "f-tags", key: "tags", type: "array" },
  ],
  mockData: [
    { id: 1, name: "Ann", age: 30, tags: ["a"] },
    { id: 2, name: "Bob", age: 41, tags: [] },
  ],
  useMockData: true,
} as unknown as DataTable;

const wrap = (node: ReactNode) => (
  <I18nProvider initialLocale="en-US">{node}</I18nProvider>
);

function cell(container: HTMLElement, rowIndex: number, key: string) {
  const el = container.querySelector<HTMLElement>(
    `[data-row-index="${rowIndex}"][data-field-key="${key}"]`,
  );
  if (!el) throw new Error(`cell ${rowIndex}:${key} 없음`);
  return el;
}

function lastOps() {
  const call = applyDataChange.mock.calls.at(-1) as unknown as
    [{ ops: unknown[] }] | undefined;
  return call?.[0].ops;
}

beforeEach(() => {
  // RAC Popover/Table 이 읽는 레이아웃 API — jsdom 에 없다
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  useDataPanelStatusStore.setState({ status: null });
});

describe("DataGrid (ADR-212 Phase 2)", () => {
  it("role=grid · 열 헤더 · 셀에 data-row-index/data-field-key · id 셀은 aria-readonly", () => {
    const { container, getByRole } = render(
      wrap(<DataGrid table={table} virtualized={false} />),
    );
    const grid = getByRole("grid", { name: "Users" });
    expect(grid).toBeTruthy();
    expect(container.querySelectorAll("[role=columnheader]").length).toBe(6); // 선택 + 4 + 추가
    expect(cell(container, 0, "id").getAttribute("aria-readonly")).toBe("true");
    expect(cell(container, 0, "name").getAttribute("aria-readonly")).toBeNull();
    expect(cell(container, 0, "name").textContent).toBe("Ann");
  });

  it("Enter → input (aria-labelledby = 열 헤더) → 수정 → Enter commit = set_cell 1 + 아래 셀 포커스", async () => {
    const { container } = render(
      wrap(<DataGrid table={table} virtualized={false} />),
    );
    const target = cell(container, 0, "name");
    target.focus();
    fireEvent.keyDown(target, { key: "Enter" });
    const input = container.querySelector<HTMLInputElement>(
      "input[data-grid-editor=inline]",
    );
    expect(input).toBeTruthy();
    expect(input!.value).toBe("Ann");
    const labelledBy = input!.getAttribute("aria-labelledby");
    expect(labelledBy && document.getElementById(labelledBy)?.textContent).toBe(
      "name",
    );

    fireEvent.change(input!, { target: { value: "Anna" } });
    fireEvent.keyDown(input!, { key: "Enter" });
    await waitFor(() => expect(applyDataChange).toHaveBeenCalledTimes(1));
    expect(lastOps()).toEqual([
      {
        op: "set_cell",
        collectionId: "c1",
        rowIndex: 0,
        fieldId: "f-name",
        value: "Anna",
      },
    ]);
    expect((applyDataChange.mock.calls[0] as unknown[])[0]).toMatchObject({
      origin: "user",
    });
    await waitFor(() =>
      expect(document.activeElement).toBe(cell(container, 1, "name")),
    );
    expect(container.querySelector("input[data-grid-editor]")).toBeNull();
  });

  it("타이핑으로 진입하면 그 글자가 초안, Tab commit 은 오른쪽 셀로", async () => {
    const { container } = render(
      wrap(<DataGrid table={table} virtualized={false} />),
    );
    const target = cell(container, 1, "name");
    target.focus();
    fireEvent.keyDown(target, { key: "Z" });
    const input = container.querySelector<HTMLInputElement>(
      "input[data-grid-editor=inline]",
    )!;
    expect(input.value).toBe("Z");
    fireEvent.change(input, { target: { value: "Zed" } });
    fireEvent.keyDown(input, { key: "Tab" });
    await waitFor(() => expect(applyDataChange).toHaveBeenCalledTimes(1));
    expect(lastOps()).toEqual([
      {
        op: "set_cell",
        collectionId: "c1",
        rowIndex: 1,
        fieldId: "f-name",
        value: "Zed",
      },
    ]);
    await waitFor(() =>
      expect(document.activeElement).toBe(cell(container, 1, "age")),
    );
  });

  it("Esc 는 취소 — 쓰기 0, 포커스는 셀로 · 값이 같으면 commit 해도 쓰기 0", async () => {
    const { container } = render(
      wrap(<DataGrid table={table} virtualized={false} />),
    );
    const target = cell(container, 0, "name");
    target.focus();
    fireEvent.keyDown(target, { key: "F2" });
    const input = container.querySelector<HTMLInputElement>(
      "input[data-grid-editor=inline]",
    )!;
    fireEvent.change(input, { target: { value: "changed" } });
    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() =>
      expect(container.querySelector("input[data-grid-editor]")).toBeNull(),
    );
    expect(document.activeElement).toBe(cell(container, 0, "name"));
    expect(applyDataChange).not.toHaveBeenCalled();

    fireEvent.keyDown(target, { key: "Enter" });
    const again = container.querySelector<HTMLInputElement>(
      "input[data-grid-editor=inline]",
    )!;
    fireEvent.keyDown(again, { key: "Enter" });
    await waitFor(() =>
      expect(container.querySelector("input[data-grid-editor]")).toBeNull(),
    );
    expect(applyDataChange).not.toHaveBeenCalled();
  });

  it("number 셀에 글자를 commit 하면 aria-invalid + 오류 토스트, 쓰기 0 (0 으로 바꾸지 않음)", async () => {
    const { container } = render(
      wrap(<DataGrid table={table} virtualized={false} />),
    );
    const target = cell(container, 0, "age");
    target.focus();
    fireEvent.keyDown(target, { key: "Enter" });
    const input = container.querySelector<HTMLInputElement>(
      "input[data-grid-editor=inline]",
    )!;
    fireEvent.change(input, { target: { value: "abc" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() =>
      expect(input.getAttribute("aria-invalid")).toBe("true"),
    );
    expect(applyDataChange).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(String(toastError.mock.calls[0][0])).toContain("number");
    expect(useDataPanelStatusStore.getState().status).toBeNull();
  });

  it("id 셀은 편집 진입 0 · Delete 는 셀 비우기 set_cell null", async () => {
    const { container } = render(
      wrap(<DataGrid table={table} virtualized={false} />),
    );
    const idCell = cell(container, 0, "id");
    idCell.focus();
    fireEvent.keyDown(idCell, { key: "Enter" });
    expect(container.querySelector("input[data-grid-editor]")).toBeNull();

    const ageCell = cell(container, 0, "age");
    ageCell.focus();
    fireEvent.keyDown(ageCell, { key: "Delete" });
    await waitFor(() => expect(applyDataChange).toHaveBeenCalledTimes(1));
    expect(lastOps()).toEqual([
      {
        op: "set_cell",
        collectionId: "c1",
        rowIndex: 0,
        fieldId: "f-age",
        value: null,
      },
    ]);
  });

  it("array 셀은 Popover 편집기 (textarea) — ⌘Enter commit 은 JSON 으로", async () => {
    const { container } = render(
      wrap(<DataGrid table={table} virtualized={false} />),
    );
    const target = cell(container, 0, "tags");
    target.focus();
    fireEvent.keyDown(target, { key: "Enter" });
    const textarea = await waitFor(() => {
      const el = document.querySelector<HTMLTextAreaElement>(
        "[data-grid-editor=popover] textarea",
      );
      if (!el) throw new Error("popover 없음");
      return el;
    });
    expect(textarea.value).toBe('["a"]');
    fireEvent.change(textarea, { target: { value: '["a","b"]' } });
    fireEvent.keyDown(textarea, { key: "Enter", metaKey: true });
    await waitFor(() => expect(applyDataChange).toHaveBeenCalledTimes(1));
    expect(lastOps()).toEqual([
      {
        op: "set_cell",
        collectionId: "c1",
        rowIndex: 0,
        fieldId: "f-tags",
        value: ["a", "b"],
      },
    ]);
  });

  it("붙여넣기 (셀 포커스, TSV 2×2) → set_cell + 넘치는 행 insert_rows 한 DataChange", async () => {
    const { container } = render(
      wrap(<DataGrid table={table} virtualized={false} />),
    );
    const target = cell(container, 1, "name");
    target.focus();
    fireEvent.paste(target, {
      clipboardData: { getData: () => "Cy\t50\nDee\t60" },
    });
    await waitFor(() => expect(applyDataChange).toHaveBeenCalledTimes(1));
    expect(lastOps()).toEqual([
      {
        op: "set_cell",
        collectionId: "c1",
        rowIndex: 1,
        fieldId: "f-name",
        value: "Cy",
      },
      {
        op: "set_cell",
        collectionId: "c1",
        rowIndex: 1,
        fieldId: "f-age",
        value: 50,
      },
      {
        op: "insert_rows",
        collectionId: "c1",
        rows: [{ id: null, name: "Dee", age: 60, tags: null }],
        at: 2,
      },
    ]);
    expect(useDataPanelStatusStore.getState().status?.message).toContain(
      "Pasted 2 rows",
    );
  });

  it("붙여넣기 열이 넘치면 ConfirmDialog — 확인이면 add_field 가 앞에 붙는다", async () => {
    const { container, getByRole } = render(
      wrap(<DataGrid table={table} virtualized={false} />),
    );
    const target = cell(container, 0, "tags");
    target.focus();
    fireEvent.paste(target, {
      clipboardData: { getData: () => '["x"]\tNYC' },
    });
    const dialog = await waitFor(() => getByRole("alertdialog"));
    expect(dialog.textContent).toContain("col_5");
    expect(applyDataChange).not.toHaveBeenCalled();
    const confirm = getByRole("button", { name: "Add fields" });
    fireEvent.pointerDown(confirm, { pointerType: "mouse", button: 0 });
    fireEvent.pointerUp(confirm, { pointerType: "mouse", button: 0 });
    fireEvent.click(confirm);
    await waitFor(() => expect(applyDataChange).toHaveBeenCalledTimes(1));
    expect(lastOps()).toEqual([
      {
        op: "add_field",
        collectionId: "c1",
        field: { key: "col_5", type: "string" },
      },
      {
        op: "set_cell",
        collectionId: "c1",
        rowIndex: 0,
        fieldId: "f-tags",
        value: ["x"],
      },
      {
        op: "set_cell",
        collectionId: "c1",
        rowIndex: 0,
        fieldId: "col_5",
        value: "NYC",
      },
    ]);
  });

  it("행 추가 = insert_rows (id 자동, 나머지 null) + role=status", async () => {
    const { container, getByRole } = render(
      wrap(<DataGrid table={table} virtualized={false} />),
    );
    const button = getByRole("button", { name: "Add row" });
    await act(async () => {
      fireEvent.pointerDown(button, { pointerType: "mouse", button: 0 });
      fireEvent.pointerUp(button, { pointerType: "mouse", button: 0 });
      fireEvent.click(button);
    });
    await waitFor(() => expect(applyDataChange).toHaveBeenCalledTimes(1));
    expect(lastOps()).toEqual([
      {
        op: "insert_rows",
        collectionId: "c1",
        rows: [{ id: 3, name: null, age: null, tags: null }],
        at: 2,
      },
    ]);
    expect(useDataPanelStatusStore.getState().status?.message).toBe(
      "Row added.",
    );
    expect(container.querySelector("[data-testid=datagrid]")).toBeTruthy();
  });
});

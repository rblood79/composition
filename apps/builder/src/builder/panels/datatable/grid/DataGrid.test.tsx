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
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { applyDataChange, toastError } = vi.hoisted(() => ({
  applyDataChange: vi.fn(async () => ({})),
  toastError: vi.fn(),
}));

vi.mock("../../../stores/data", () => ({
  // ADR-289 — the row form reads `getState()` at save (the latest rows · the Update target).
  useDataStore: Object.assign(
    (selector: (s: Record<string, unknown>) => unknown) =>
      selector({ applyDataChange, collections: new Map() }),
    { getState: () => ({ applyDataChange, collections: new Map() }) },
  ),
}));
// 오류는 토스트 (Phase 1 결정 — role=status 는 결과만), 결과는 Data 패널 status 영역
vi.mock("../../../stores/toast", () => ({
  globalToast: { error: toastError, success: vi.fn(), warning: vi.fn() },
}));

import type { ReactNode } from "react";
import { I18nProvider } from "@/i18n";
import type { DataTable } from "../../../../types/builder/data.types";
import { useDataPanelStatusStore } from "../stores/dataPanelStatusStore";
import { useDataTableEditorStore } from "../stores/dataTableEditorStore";
import {
  DataUsageSourceContext,
  type DataUsageSource,
} from "../usage/dataUsageSource";
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

/** ADR-288: the column editor popover reads field usage from the Data usage host. */
const USAGE: DataUsageSource = {
  useCollectionUsage: () => new Map(),
  useFieldUsage: () => [],
};
const wrap = (node: ReactNode) => (
  <I18nProvider initialLocale="en-US">
    <DataUsageSourceContext.Provider value={USAGE}>
      {node}
    </DataUsageSourceContext.Provider>
  </I18nProvider>
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
  useDataTableEditorStore.setState({ mode: null });
});

const press = async (el: Element) => {
  await act(async () => {
    fireEvent.pointerDown(el, { pointerType: "mouse", button: 0 });
    fireEvent.pointerUp(el, { pointerType: "mouse", button: 0 });
    fireEvent.click(el);
  });
};

describe("DataGrid (ADR-212 Phase 2)", () => {
  it("role=grid · 열 헤더 · 셀에 data-row-index/data-field-key · id 셀은 aria-readonly", () => {
    const { container, getByRole } = render(
      wrap(<DataGrid table={table} virtualized={false} />),
    );
    const grid = getByRole("grid", { name: "Users" });
    expect(grid).toBeTruthy();
    // 선택 + 4 — 새 필드 `+` 는 격자 열이 아니라 스크롤 컨테이너 위 슬롯 (aria-colcount 밖)
    expect(container.querySelectorAll("[role=columnheader]").length).toBe(5);
    expect(
      container.querySelector(".datagrid-add-field-slot .datagrid-add-field"),
    ).not.toBeNull();
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

  it("array 셀은 Popover 편집기 (textarea) — 키 안내 · ⏎ commit 은 JSON 으로 · ⇧⏎ 는 줄 바꿈", async () => {
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
    // Key hints (Supabase 어법) beside the buttons: ⏎ Save · ⇧⏎ New line · Esc Cancel.
    const keys = [...container.ownerDocument.querySelectorAll(".datagrid-popover-key")].map(
      (el) => el.textContent,
    );
    expect(keys).toEqual(["⏎Save changes", "⇧⏎New line", "EscCancel changes"]);
    fireEvent.change(textarea, { target: { value: '["a","b"]' } });
    // ⇧⏎ keeps the newline (no commit) · plain ⏎ commits.
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(applyDataChange).not.toHaveBeenCalled();
    fireEvent.keyDown(textarea, { key: "Enter" });
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

  it("선택 체크박스 = 공용 Checkbox (체크 · 대시) — 한 행 선택이면 헤더는 indeterminate, 바에 Delete N rows", async () => {
    const { container, getByRole, queryByRole } = render(
      wrap(<DataGrid table={table} virtualized={false} />),
    );
    const head = getByRole("checkbox", { name: "Select all rows" });
    const headLabel = head.closest(".react-aria-Checkbox") as HTMLElement;
    // The shared part's indicator (`div.checkbox > svg`), not a bare span.
    expect(headLabel.querySelector(".checkbox svg")).not.toBeNull();
    expect(container.querySelector(".datagrid-checkbox-box")).toBeNull();
    expect(headLabel.hasAttribute("data-indeterminate")).toBe(false);

    const first = container.querySelectorAll(
      '.datagrid-cell-select .react-aria-Checkbox input[type="checkbox"]',
    )[0] as HTMLInputElement;
    await act(async () => {
      fireEvent.click(first);
    });
    await waitFor(() =>
      expect(headLabel.hasAttribute("data-indeterminate")).toBe(true),
    );
    expect(headLabel.querySelector("svg.lucide-minus")).not.toBeNull();
    expect(getByRole("button", { name: "Delete 1 rows" })).toBeTruthy();
    expect(queryByRole("button", { name: "Insert" })).toBeNull();

    await act(async () => {
      fireEvent.click(head);
    });
    await waitFor(() =>
      expect(headLabel.hasAttribute("data-selected")).toBe(true),
    );
    expect(headLabel.hasAttribute("data-indeterminate")).toBe(false);
    expect(headLabel.querySelector("svg.lucide-check")).not.toBeNull();
    expect(getByRole("button", { name: "Delete 2 rows" })).toBeTruthy();
  });

  it("행 2 선택 → 복사 ▾ CSV = 머리글 + 2 행 클립보드 · JSON = 배열 2 · 내보내기 ▾ 선택 행 · 해제 → Insert ▾ 복귀 (ADR-289 Decision 4)", async () => {
    const writeText = vi.fn(async (_text: string) => {});
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    const createObjectURL = vi.fn(() => "blob:x");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, configurable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectURL, configurable: true });
    const clicks: string[] = [];
    const origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      clicks.push(this.download);
    };
    try {
      const { container, getByRole, queryByRole } = render(
        wrap(<DataGrid table={table} virtualized={false} />),
      );
      // No selection: Export ▾ (CSV · JSON) beside Insert ▾, no Copy.
      expect(queryByRole("button", { name: "Copy" })).toBeNull();
      expect(getByRole("button", { name: "Export" })).toBeTruthy();
      const boxes = container.querySelectorAll<HTMLInputElement>(
        '.datagrid-cell-select .react-aria-Checkbox input[type="checkbox"]',
      );
      await act(async () => {
        fireEvent.click(boxes[0]);
        fireEvent.click(boxes[1]);
      });
      await waitFor(() => expect(getByRole("button", { name: "Delete 2 rows" })).toBeTruthy());
      expect(queryByRole("button", { name: "Insert" })).toBeNull();

      fireEvent.click(getByRole("button", { name: "Copy" }));
      await press(await waitFor(() => getByRole("menuitem", { name: "Copy as CSV" })));
      await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
      expect(writeText.mock.calls[0][0]).toBe('id,name,age,tags\r\n1,Ann,30,"[""a""]"\r\n2,Bob,41,[]');
      expect(useDataPanelStatusStore.getState().status?.message).toBe("Copied 2 rows.");

      fireEvent.click(getByRole("button", { name: "Copy" }));
      await press(await waitFor(() => getByRole("menuitem", { name: "Copy as JSON" })));
      await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
      expect(JSON.parse(writeText.mock.calls[1][0])).toEqual(table.mockData);

      fireEvent.click(getByRole("button", { name: "Export" }));
      await press(await waitFor(() => getByRole("menuitem", { name: "Export selected rows as JSON" })));
      await waitFor(() => expect(clicks).toEqual(["Users-selected.json"]));
      expect(applyDataChange).not.toHaveBeenCalled();

      // Deselect → Insert ▾ and the whole-table Export ▾ return.
      await act(async () => {
        fireEvent.click(boxes[0]);
        fireEvent.click(boxes[1]);
      });
      await waitFor(() => expect(getByRole("button", { name: "Insert" })).toBeTruthy());
      expect(queryByRole("button", { name: "Copy" })).toBeNull();
      fireEvent.click(getByRole("button", { name: "Export" }));
      await press(await waitFor(() => getByRole("menuitem", { name: "Export CSV" })));
      await waitFor(() => expect(clicks).toEqual(["Users-selected.json", "Users.csv"]));
    } finally {
      HTMLAnchorElement.prototype.click = origClick;
    }
  });

  it("Insert ▾ → Insert row… = 행 양식 (ADR-289) · 빈 저장 = insert_rows (id 자동, 나머지 기본값 · null) + role=status", async () => {
    const { container, getByRole, queryByRole } = render(
      wrap(<DataGrid table={table} virtualized={false} />),
    );
    // G6 수정 8: no footer Add row — the toolbar's Insert menu (row · column · CSV).
    expect(queryByRole("button", { name: "Add row" })).toBeNull();
    expect(queryByRole("button", { name: "Import CSV" })).toBeNull();
    fireEvent.click(getByRole("button", { name: "Insert" }));
    await waitFor(() => expect(queryByRole("menu")).not.toBeNull());
    expect(getByRole("menu").querySelectorAll("[role=menuitem]").length).toBe(3);
    const button = getByRole("menuitem", { name: "Insert row…" });
    await act(async () => {
      fireEvent.pointerDown(button, { pointerType: "mouse", button: 0 });
      fireEvent.pointerUp(button, { pointerType: "mouse", button: 0 });
      fireEvent.click(button);
    });
    // The form opens beside the grid (the grid stays) — nothing is written yet.
    const dialog = await waitFor(() => getByRole("dialog", { name: "Add a row to Users" }));
    expect(applyDataChange).not.toHaveBeenCalled();
    expect(container.querySelector(".datagrid-split")?.getAttribute("data-form")).toBe("true");
    expect(container.querySelector("[role=grid]")).not.toBeNull();
    // The first editable field has focus; an empty save is the old empty row.
    expect(dialog.contains(document.activeElement)).toBe(true);
    await press(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(applyDataChange).toHaveBeenCalledTimes(1));
    expect(lastOps()).toEqual([
      {
        op: "insert_rows",
        collectionId: "c1",
        rows: [{ id: 3, name: null, age: null, tags: null }],
        at: 2,
      },
    ]);
    expect(useDataPanelStatusStore.getState().status?.message).toBe("Row added.");
    // Saved without 「Create more」 → the form closes and the new row's first cell takes focus.
    await waitFor(() => expect(queryByRole("dialog")).toBeNull());
  });

  it("셀 클릭 = 그 셀 포커스만 — 행은 선택되지 않고 (data-selected 없음 · 선택 바 없음) 체크박스로만 (Supabase 어법)", async () => {
    const { container, queryByRole } = render(
      wrap(<DataGrid table={table} virtualized={false} />),
    );
    const target = cell(container, 1, "name");
    await press(target);
    expect(container.querySelector(".datagrid-row[data-checked]")).toBeNull();
    expect(container.querySelector('[role="row"][aria-selected="true"]')).toBeNull();
    expect(queryByRole("button", { name: /Delete \d+ rows/ })).toBeNull();

    const second = container.querySelectorAll(
      '.datagrid-cell-select .react-aria-Checkbox input[type="checkbox"]',
    )[1] as HTMLInputElement;
    await act(async () => {
      fireEvent.click(second);
    });
    await waitFor(() =>
      expect(container.querySelectorAll(".datagrid-row[data-checked]")).toHaveLength(1),
    );
    expect(
      container.querySelector(".datagrid-row[data-checked] [data-field-key='name']")!.textContent,
    ).toBe("Bob");
  });

  it("행 ↗ · 셀 Shift+Enter = 그 행의 Update 양식 (ADR-289 사용자 결정 4)", async () => {
    const { container, getByRole, queryByRole } = render(
      wrap(<DataGrid table={table} virtualized={false} />),
    );
    const open = container.querySelectorAll<HTMLElement>(".datagrid-row-open")[1]!;
    expect(open.getAttribute("aria-label")).toBe("Open row");
    expect(open.getAttribute("tabindex")).toBe("-1");
    await press(open);
    const dialog = await waitFor(() => getByRole("dialog", { name: "Update a row of Users" }));
    expect(within(dialog).getByRole("group", { name: "name" }).querySelector("textarea")!.value).toBe("Bob");
    await act(async () => {
      fireEvent.keyDown(dialog.querySelector(".datatable-row-form-body")!, { key: "Escape" });
    });
    await waitFor(() => expect(queryByRole("dialog")).toBeNull());

    const target = cell(container, 0, "age");
    target.focus();
    fireEvent.keyDown(target, { key: "Enter", shiftKey: true });
    const again = await waitFor(() => getByRole("dialog", { name: "Update a row of Users" }));
    expect(within(again).getByRole("group", { name: "name" }).querySelector("textarea")!.value).toBe("Ann");
    expect(container.querySelector("input[data-grid-editor]")).toBeNull();
  });

  it("Insert ▾ → Insert column… = 열 편집기 만들기 모드 (팝오버 「New column」) — `+` 인라인 길과 별개 (ADR-289)", async () => {
    const { getByRole, queryByRole } = render(
      wrap(<DataGrid table={table} virtualized={false} />),
    );
    fireEvent.click(getByRole("button", { name: "Insert" }));
    const item = await waitFor(() => getByRole("menuitem", { name: "Insert column…" }));
    await press(item);
    const dialog = await waitFor(() => getByRole("dialog", { name: "New column" }));
    expect(dialog.querySelector(".datatable-field-form[data-mode=create]")).not.toBeNull();
    expect(queryByRole("textbox", { name: "New field" })).toBeNull();
    await act(async () => {
      fireEvent.keyDown(dialog, { key: "Escape" });
    });
    await waitFor(() => expect(queryByRole("dialog")).toBeNull());
    expect(applyDataChange).not.toHaveBeenCalled();
  });

  it("헤더 + → 인라인 입력 → Enter = add_field(string), 입력은 연속 추가로 유지", async () => {
    const { container, getByRole } = render(
      wrap(<DataGrid table={table} virtualized={false} />),
    );
    const addBtn = getByRole("button", { name: "New field" });
    await act(async () => {
      fireEvent.pointerDown(addBtn, { pointerType: "mouse", button: 0 });
      fireEvent.pointerUp(addBtn, { pointerType: "mouse", button: 0 });
      fireEvent.click(addBtn);
    });
    const input = container.querySelector<HTMLInputElement>(
      ".datagrid-add-field-input",
    );
    expect(input).not.toBeNull();
    fireEvent.change(input!, { target: { value: "email" } });
    await act(async () => {
      fireEvent.keyDown(input!, { key: "Enter" });
    });
    await waitFor(() => expect(applyDataChange).toHaveBeenCalledTimes(1));
    expect(lastOps()).toEqual([
      {
        op: "add_field",
        collectionId: "c1",
        field: { key: "email", type: "string" },
      },
    ]);
    // 성공 후에도 입력이 남아 연속 추가할 수 있다
    expect(container.querySelector(".datagrid-add-field-input")).not.toBeNull();
  });

  it("헤더 인라인 입력 중복 키 → 경고, 쓰기 0 · Esc = 취소", async () => {
    const { container, getByRole } = render(
      wrap(<DataGrid table={table} virtualized={false} />),
    );
    const addBtn = getByRole("button", { name: "New field" });
    await act(async () => {
      fireEvent.pointerDown(addBtn, { pointerType: "mouse", button: 0 });
      fireEvent.pointerUp(addBtn, { pointerType: "mouse", button: 0 });
      fireEvent.click(addBtn);
    });
    const input = container.querySelector<HTMLInputElement>(
      ".datagrid-add-field-input",
    )!;
    fireEvent.change(input, { target: { value: "name" } });
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });
    expect(applyDataChange).not.toHaveBeenCalled();
    // Esc 는 입력을 닫는다
    await act(async () => {
      fireEvent.keyDown(input, { key: "Escape" });
    });
    expect(container.querySelector(".datagrid-add-field-input")).toBeNull();
  });

  // ── 컬럼 정보 수정 3단 (빈도별 진입점) ──

  it("헤더 더블클릭 → 인라인 rename → Enter = update_field { key } (필드 패널 안 거침)", async () => {
    const { container } = render(
      wrap(<DataGrid table={table} virtualized={false} />),
    );
    const head = container.querySelector<HTMLElement>(
      '.datagrid-column-head[data-field-type="string"]',
    )!;
    expect(head.querySelector(".datagrid-column-type")).not.toBeNull();
    // 격자 밖에서 곧장 더블클릭 (포커스 관리자 꺼진 상태) — input 이 포커스를 지켜야 한다
    await act(async () => {
      fireEvent.doubleClick(head);
    });
    const input = container.querySelector<HTMLInputElement>(
      ".datagrid-column-rename-input",
    )!;
    expect(input.value).toBe("name");
    // 라벨 버튼은 input 으로 교체 — 격자 tab 순서에 버튼이 늘지 않는다
    expect(head.querySelector(".datagrid-column-label")).toBeNull();
    fireEvent.change(input, { target: { value: "fullName" } });
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });
    expect(lastOps()).toEqual([
      {
        op: "update_field",
        collectionId: "c1",
        fieldId: "f-name",
        patch: { key: "fullName" },
      },
    ]);
    expect(container.querySelector(".datagrid-column-rename-input")).toBeNull();
  });

  it("라벨 포커스 + F2 = rename · Esc 취소 (쓰기 0) · 중복 키는 경고만", async () => {
    const { container, getByRole } = render(
      wrap(<DataGrid table={table} virtualized={false} />),
    );
    const label = getByRole("button", { name: "name" });
    label.focus();
    await act(async () => {
      fireEvent.keyDown(label, { key: "F2" });
    });
    let input = container.querySelector<HTMLInputElement>(
      ".datagrid-column-rename-input",
    )!;
    expect(input).not.toBeNull();
    await act(async () => {
      fireEvent.keyDown(input, { key: "Escape" });
    });
    expect(applyDataChange).not.toHaveBeenCalled();
    expect(container.querySelector(".datagrid-column-rename-input")).toBeNull();

    await act(async () => {
      fireEvent.keyDown(getByRole("button", { name: "name" }), { key: "F2" });
    });
    input = container.querySelector<HTMLInputElement>(
      ".datagrid-column-rename-input",
    )!;
    fireEvent.change(input, { target: { value: "age" } });
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });
    expect(applyDataChange).not.toHaveBeenCalled();
  });

  it("타입 아이콘 클릭 → 머리글 팝오버 (타입 검색 포커스) · 라벨 클릭 → 그 열의 팝오버 (ADR-288) · ⌄ 는 동작 메뉴", async () => {
    const { container, getByRole, queryByRole } = render(
      wrap(<DataGrid table={table} virtualized={false} />),
    );
    const head = container.querySelector<HTMLElement>(
      '.datagrid-column-head[data-field-type="string"]',
    )!;
    const typeBtn = head.querySelector<HTMLElement>(".datagrid-column-type")!;
    expect(typeBtn.getAttribute("aria-label")).toBe("Type: String");
    // 아이콘·⌄ 는 tab 순서 밖
    expect(typeBtn.getAttribute("tabindex")).toBe("-1");
    const menuBtn = head.querySelector<HTMLElement>(".datagrid-column-menu")!;
    expect(menuBtn.getAttribute("tabindex")).toBe("-1");
    expect(menuBtn.getAttribute("aria-label")).toBe("name column actions");
    expect(queryByRole("dialog")).toBeNull();

    await press(typeBtn);
    const dialog = getByRole("dialog", { name: "name" });
    expect(head.getAttribute("data-editor-open")).toBe("true");
    expect(document.activeElement).toBe(
      dialog.querySelector(".datatable-field-type .react-aria-Button"),
    );
    await act(async () => {
      fireEvent.keyDown(dialog, { key: "Escape" });
    });
    expect(queryByRole("dialog")).toBeNull();

    await press(getByRole("button", { name: "age" }));
    expect(
      getByRole("dialog", { name: "age" }).querySelector<HTMLInputElement>(
        ".datatable-field-key input",
      )!.value,
    ).toBe("age");
    await act(async () => {
      fireEvent.keyDown(getByRole("dialog", { name: "age" }), { key: "Escape" });
    });

    // ⌄ = the column's actions (Supabase 어법), not a third way to the editor.
    await press(menuBtn);
    const menu = await waitFor(() => getByRole("menu", { name: "name column actions" }));
    expect(within(menu).getAllByRole("menuitem").map((el) => el.textContent)).toEqual([
      "Sort ascending",
      "Sort descending",
      "Copy name",
      "Edit column",
      "Freeze column",
      "Delete column",
    ]);
    await press(within(menu).getByRole("menuitem", { name: "Edit column" }));
    await waitFor(() => expect(getByRole("dialog", { name: "name" })).toBeTruthy());
  });

  it("열 ⌄ → 내림차순 정렬 = 보기만 (문서 쓰기 없음) · 정렬 해제 · 열 고정 · 열 삭제는 확인 뒤 remove_field 한 번", async () => {
    const { container, getByRole, queryByRole } = render(
      wrap(<DataGrid table={table} virtualized={false} />),
    );
    const names = () =>
      [...container.querySelectorAll(".datagrid-cell[data-field-key='name']")].map(
        (el) => el.textContent,
      );
    expect(names()).toEqual(["Ann", "Bob"]);
    const openMenu = async (key: string) => {
      await press(getByRole("button", { name: `${key} column actions` }));
      return waitFor(() => getByRole("menu", { name: `${key} column actions` }));
    };

    await press(within(await openMenu("age")).getByRole("menuitem", { name: "Sort descending" }));
    await waitFor(() => expect(names()).toEqual(["Bob", "Ann"]));
    expect(container.querySelector(".datagrid-column-sort[data-direction='descending']")).not.toBeNull();
    // Bob keeps its stored index — the cell still addresses row 1.
    expect(cell(container, 1, "name").textContent).toBe("Bob");
    expect(applyDataChange).not.toHaveBeenCalled();
    await press(within(await openMenu("age")).getByRole("menuitem", { name: "Remove sort" }));
    await waitFor(() => expect(names()).toEqual(["Ann", "Bob"]));

    await press(within(await openMenu("age")).getByRole("menuitem", { name: "Freeze column" }));
    await waitFor(() =>
      expect(container.querySelector(".datagrid-cell[data-field-key='age'][data-frozen='last']")).not.toBeNull(),
    );
    expect(
      within(await openMenu("age")).getByRole("menuitem", { name: "Unfreeze column" }),
    ).toBeTruthy();
    await act(async () => {
      fireEvent.keyDown(getByRole("menu", { name: "age column actions" }), { key: "Escape" });
    });

    await press(within(await openMenu("tags")).getByRole("menuitem", { name: "Delete column" }));
    const confirm = await waitFor(() => getByRole("alertdialog"));
    expect(confirm.textContent).toContain('Deletes column "tags"');
    expect(applyDataChange).not.toHaveBeenCalled();
    await press(within(confirm).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(applyDataChange).toHaveBeenCalledTimes(1));
    expect(lastOps()).toEqual([{ op: "remove_field", collectionId: "c1", fieldId: "f-tags" }]);
    await waitFor(() => expect(queryByRole("alertdialog")).toBeNull());
  });
});

// 2026-10-05 감사 — 문자열 id 테이블의 새 행 id 는 기존 행과 겹치지 않는다 (row_${n+1} 은 행을
// 지운 뒤 기존 id 와 겹쳤다).
describe("nextRowId", () => {
  it("a string id skips the ids in use", async () => {
    const { nextRowId } = await import("./DataGrid");
    expect(nextRowId([{ id: "row_1" }, { id: "row_3" }], "string")).toBe("row_4");
    expect(nextRowId([{ id: "row_2" }, { id: "a" }], "string")).toBe("row_3");
    expect(nextRowId([{ id: 4 }, { id: 9 }], "number")).toBe(10);
  });
});

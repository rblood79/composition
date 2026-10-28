// @vitest-environment jsdom
/**
 * ADR-288 Decision 2 (the ADR-212 Phase 3 field panel body, now under the column head): rename
 * (update_field { key }) · type change preview (clear / keep on coerce failures) · delete
 * (immediate at 0 uses · ConfirmDialog above) · required / label patch · the type icon entry
 * focuses the type search. Every write is applyDataChange (HC1); usage is the field-level back
 * reference. The popover shell (RAC Popover · Esc · outside) is exercised in DataGrid.test.
 */
import { within, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { applyDataChange, toastWarn } = vi.hoisted(() => ({
  applyDataChange: vi.fn(async () => ({})),
  toastWarn: vi.fn(),
}));

const collection = {
  id: "c1",
  name: "Users",
  project_id: "p",
  schema: [
    { id: "f-id", key: "id", type: "string" },
    { id: "f-age", key: "age", type: "string" },
  ],
  mockData: [
    { id: "1", age: "30" },
    { id: "2", age: "x" },
    { id: "3", age: "" },
  ],
  useMockData: true,
};

vi.mock("../../../stores/data", () => ({
  useDataStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      applyDataChange,
      collections: new Map([["c1", collection]]),
    }),
}));
vi.mock("../../../stores/toast", () => ({
  globalToast: { warning: toastWarn, error: vi.fn(), success: vi.fn() },
}));

import type { ReactNode } from "react";
import { I18nProvider } from "@/i18n";
import type {
  DataField,
  DataTable,
} from "../../../../types/builder/data.types";
import {
  DataUsageSourceContext,
  type DataUsageSource,
} from "../usage/dataUsageSource";
import { ColumnCreator, ColumnEditor } from "./ColumnEditorPopover";

/** ADR-248 4e-9 C: no node uses the collection. */
const USAGE: DataUsageSource = {
  useCollectionUsage: () => new Map(),
  useFieldUsage: () => [],
};

const table = collection as unknown as DataTable;
const age = table.schema[1]!;

const wrap = (node: ReactNode) => (
  <I18nProvider initialLocale="en-US">
    <DataUsageSourceContext.Provider value={USAGE}>
      {node}
    </DataUsageSourceContext.Provider>
  </I18nProvider>
);

const keyInput = (c: HTMLElement) =>
  c.querySelector(".datatable-field-key input") as HTMLInputElement;

function lastOps() {
  const call = applyDataChange.mock.calls.at(-1) as unknown as
    [{ ops: unknown[] }] | undefined;
  return call?.[0].ops;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ColumnEditor (ADR-288 — the column head popover's body)", () => {
  it("shows the field (key = the column's key)", () => {
    const { container } = render(
      wrap(<ColumnEditor table={table} field={age} onClose={() => {}} />),
    );
    expect(keyInput(container).value).toBe("age");
  });

  it("rename → update_field { key } 한 op (152 적용기가 행 이전)", async () => {
    const { container } = render(
      wrap(<ColumnEditor table={table} field={age} onClose={() => {}} />),
    );
    const input = keyInput(container);
    fireEvent.change(input, { target: { value: "years" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(applyDataChange).toHaveBeenCalledTimes(1));
    expect(lastOps()).toEqual([
      {
        op: "update_field",
        collectionId: "c1",
        fieldId: "f-age",
        patch: { key: "years" },
      },
    ]);
  });

  it("빈 key · 중복 key 는 경고 + 쓰기 0", async () => {
    const { container } = render(
      wrap(<ColumnEditor table={table} field={age} onClose={() => {}} />),
    );
    const input = keyInput(container);
    fireEvent.change(input, { target: { value: "id" } }); // 중복
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(toastWarn).toHaveBeenCalled());
    expect(applyDataChange).not.toHaveBeenCalled();
  });

  it("타입 변경 — 강제 실패 행이 있으면 ConfirmDialog, '비움' 은 update_field + set_cell null", async () => {
    const { getByRole } = render(
      wrap(<ColumnEditor table={table} field={age} onClose={() => {}} />),
    );
    // G6 수정 12 — the type is a Builder PropertySelect: open it, pick the option.
    fireEvent.click(
      within(getByRole("group", { name: "Type" })).getByRole("button"),
    );
    fireEvent.click(await waitFor(() => getByRole("option", { name: "Number" })));
    const dialog = await waitFor(() => getByRole("alertdialog"));
    expect(dialog.textContent).toContain("1 of 3 rows"); // "x" 하나
    const clear = getByRole("button", { name: "Clear (empty those cells)" });
    fireEvent.pointerDown(clear, { pointerType: "mouse", button: 0 });
    fireEvent.pointerUp(clear, { pointerType: "mouse", button: 0 });
    fireEvent.click(clear);
    await waitFor(() => expect(applyDataChange).toHaveBeenCalledTimes(1));
    expect(lastOps()).toEqual([
      {
        op: "update_field",
        collectionId: "c1",
        fieldId: "f-age",
        patch: { type: "number" },
      },
      {
        op: "set_cell",
        collectionId: "c1",
        rowIndex: 0,
        fieldId: "f-age",
        value: 30,
      },
      {
        op: "set_cell",
        collectionId: "c1",
        rowIndex: 1,
        fieldId: "f-age",
        value: null,
      },
    ]);
  });

  it("삭제 — 사용처 0 이면 즉시 remove_field, 그리고 팝오버를 닫는다", async () => {
    const onClose = vi.fn();
    const { getByRole } = render(
      wrap(<ColumnEditor table={table} field={age} onClose={onClose} />),
    );
    const del = getByRole("button", { name: /Delete field/ });
    fireEvent.pointerDown(del, { pointerType: "mouse", button: 0 });
    fireEvent.pointerUp(del, { pointerType: "mouse", button: 0 });
    fireEvent.click(del);
    await waitFor(() => expect(applyDataChange).toHaveBeenCalledTimes(1));
    expect(lastOps()).toEqual([
      { op: "remove_field", collectionId: "c1", fieldId: "f-age" },
    ]);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("required 토글 → update_field { required }", async () => {
    const { getByRole } = render(
      wrap(<ColumnEditor table={table} field={age} onClose={() => {}} />),
    );
    fireEvent.click(getByRole("switch"));
    await waitFor(() => expect(applyDataChange).toHaveBeenCalledTimes(1));
    expect(lastOps()).toEqual([
      {
        op: "update_field",
        collectionId: "c1",
        fieldId: "f-age",
        patch: { required: true },
      },
    ]);
  });

  it("타입 아이콘 진입 (focus: type) → 타입 Select 트리거에 포커스", () => {
    const { container } = render(
      wrap(
        <ColumnEditor
          table={table}
          field={age}
          focus="type"
          onClose={() => {}}
        />,
      ),
    );
    expect(document.activeElement).toBe(
      container.querySelector(".datatable-field-type .react-aria-Button"),
    );
  });

  // ── ADR-289 Decision 3 — four sections · type hints · typed defaults · create mode ──

  it("ADR-289: four sections (Name · Type · Rules · Usage) and every type option carries a one-line hint", async () => {
    const { container, getByRole } = render(
      wrap(<ColumnEditor table={table} field={age} onClose={() => {}} />),
    );
    expect(
      [...container.querySelectorAll(".section-title")].map((el) => el.textContent),
    ).toEqual(["Name", "Type", "Rules", "Usage"]);
    fireEvent.click(
      within(getByRole("group", { name: "Type" })).getByRole("button"),
    );
    const listbox = await waitFor(() => getByRole("listbox"));
    const options = within(listbox).getAllByRole("option");
    expect(options.length).toBe(11);
    const number = within(listbox).getByRole("option", { name: /Number/ });
    expect(number.querySelector(".property-select__option-description")!.textContent).toBe(
      "Number — for math and sorting",
    );
    expect(
      within(listbox).getByRole("option", { name: /Reference/ }).textContent,
    ).toContain("Points at a row of another table");
  });

  it("ADR-289: the default is stored in the column's type — a boolean column's default is a boolean, text that does not fit is refused", async () => {
    const active = {
      id: "f-active",
      key: "active",
      type: "boolean",
      defaultValue: "true",
    } as unknown as DataField;
    const { getByRole, queryByRole } = render(
      wrap(<ColumnEditor table={table} field={active} onClose={() => {}} />),
    );
    // The legacy text default "true" shows as the typed value (On).
    const trigger = within(getByRole("group", { name: "Default value" })).getByRole("button");
    expect(trigger.textContent).toContain("On");
    expect(queryByRole("alert")).toBeNull();
    fireEvent.click(trigger);
    fireEvent.click(await waitFor(() => getByRole("option", { name: "Off" })));
    await waitFor(() => expect(applyDataChange).toHaveBeenCalledTimes(1));
    expect(lastOps()).toEqual([
      {
        op: "update_field",
        collectionId: "c1",
        fieldId: "f-active",
        patch: { defaultValue: false },
      },
    ]);
  });

  it("ADR-289: a number column's default — text commits coerced on Enter, letters show the mismatch and write 0", async () => {
    const amount = {
      id: "f-amount",
      key: "amount",
      type: "number",
      defaultValue: "3",
    } as unknown as DataField;
    const { getByRole } = render(
      wrap(<ColumnEditor table={table} field={amount} onClose={() => {}} />),
    );
    const input = within(getByRole("group", { name: "Default value" })).getByRole(
      "textbox",
    ) as HTMLInputElement;
    expect(input.value).toBe("3");
    fireEvent.change(input, { target: { value: "abc" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(getByRole("alert").textContent).toBe("The default is not a value of this type.");
    expect(applyDataChange).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "7" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(applyDataChange).toHaveBeenCalledTimes(1));
    expect(lastOps()).toEqual([
      {
        op: "update_field",
        collectionId: "c1",
        fieldId: "f-amount",
        patch: { defaultValue: 7 },
      },
    ]);
  });

  it("ADR-289: a type change re-reads the default — kept when it fits, cleared with a note when it does not", async () => {
    const flag = {
      id: "f-flag",
      key: "flag",
      type: "string",
      defaultValue: "yes",
    } as unknown as DataField;
    const tableWithFlag = {
      ...collection,
      schema: [...collection.schema, flag],
      mockData: collection.mockData.map((row) => ({ ...row, flag: "yes" })),
    } as unknown as DataTable;
    const { getByRole, container } = render(
      wrap(<ColumnEditor table={tableWithFlag} field={flag} onClose={() => {}} />),
    );
    fireEvent.click(within(getByRole("group", { name: "Type" })).getByRole("button"));
    fireEvent.click(await waitFor(() => getByRole("option", { name: /Boolean/ })));
    await waitFor(() => expect(applyDataChange).toHaveBeenCalledTimes(1));
    // "yes" is a boolean text → kept as `true` in the same op; rows ("yes") coerce too → no dialog.
    expect(lastOps()).toEqual([
      {
        op: "update_field",
        collectionId: "c1",
        fieldId: "f-flag",
        patch: { type: "boolean", defaultValue: true },
      },
    ]);
    expect(container.querySelector(".datatable-field-note")).toBeNull();
  });

  it("ADR-289: create mode — name · type · default · required → one add_field; Create more keeps the form", async () => {
    const onClose = vi.fn();
    const { getByRole, container } = render(
      wrap(<ColumnCreator table={table} onClose={onClose} />),
    );
    expect(container.querySelector(".section-title")!.textContent).toBe("New column");
    const key = keyInput(container);
    fireEvent.change(key, { target: { value: "active" } });
    fireEvent.keyDown(key, { key: "Enter" });
    fireEvent.click(within(getByRole("group", { name: "Type" })).getByRole("button"));
    fireEvent.click(await waitFor(() => getByRole("option", { name: /Boolean/ })));
    const defaultTrigger = await waitFor(() =>
      within(getByRole("group", { name: "Default value" })).getByRole("button"),
    );
    fireEvent.click(defaultTrigger);
    fireEvent.click(await waitFor(() => getByRole("option", { name: "On" })));
    fireEvent.click(getByRole("switch", { name: "Required" }));
    fireEvent.click(getByRole("switch", { name: "Create more" }));
    const create = getByRole("button", { name: "Create" });
    fireEvent.pointerDown(create, { pointerType: "mouse", button: 0 });
    fireEvent.pointerUp(create, { pointerType: "mouse", button: 0 });
    fireEvent.click(create);
    await waitFor(() => expect(applyDataChange).toHaveBeenCalledTimes(1));
    expect(lastOps()).toEqual([
      {
        op: "add_field",
        collectionId: "c1",
        field: { key: "active", type: "boolean", required: true, defaultValue: true },
      },
    ]);
    // Create more → cleared, still open
    await waitFor(() => expect(keyInput(container).value).toBe(""));
    expect(onClose).not.toHaveBeenCalled();
    // A duplicate key is refused (warning, write 0)
    fireEvent.change(keyInput(container), { target: { value: "age" } });
    fireEvent.keyDown(keyInput(container), { key: "Enter" });
    fireEvent.click(create);
    await waitFor(() => expect(toastWarn).toHaveBeenCalled());
    expect(applyDataChange).toHaveBeenCalledTimes(1);
  });
});

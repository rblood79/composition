// @vitest-environment jsdom
/**
 * ADR-289 Decision 1 (G1 unit) — RowForm: required → error + focus · insert = one `insert_rows`
 * with defaults (typed) · Create more keeps the form · update writes only the touched · changed
 * cells as one change, an emptied cell is `null` (not the default) · a changed row set is a
 * conflict (refused, input kept, Close) · Esc with input → ConfirmDialog.
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

const { applyDataChange, store } = vi.hoisted(() => {
  const store = { collections: new Map<string, unknown>() };
  return { applyDataChange: vi.fn(async () => ({})), store };
});

vi.mock("../../../stores/data", () => ({
  useDataStore: Object.assign(
    (selector: (s: Record<string, unknown>) => unknown) =>
      selector({ applyDataChange, collections: store.collections }),
    {
      getState: () => ({ applyDataChange, collections: store.collections }),
    },
  ),
}));
vi.mock("../../../stores/toast", () => ({
  globalToast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

import type { ReactNode } from "react";
import { I18nProvider } from "@/i18n";
import type { DataTable } from "../../../../types/builder/data.types";
import { useDataPanelStatusStore } from "../stores/dataPanelStatusStore";
import { RowForm } from "./RowForm";
import { openRowFormTarget } from "./rowFormTarget";

const makeTable = (): DataTable =>
  ({
    id: "c1",
    name: "Users",
    project_id: "p",
    schema: [
      { id: "f-id", key: "id", type: "string" },
      { id: "f-name", key: "name", type: "string", required: true },
      { id: "f-age", key: "age", type: "number" },
      { id: "f-active", key: "active", type: "boolean", defaultValue: "true" },
      { id: "f-tags", key: "tags", type: "array", defaultValue: [] },
      { id: "f-note", key: "note", type: "string", defaultValue: "hi" },
    ],
    mockData: [
      {
        id: "row_1",
        name: "Ann",
        age: 30,
        active: true,
        tags: ["a"],
        note: "n1",
      },
      {
        id: "row_2",
        name: "Bob",
        age: 41,
        active: false,
        tags: [],
        note: null,
      },
    ],
    useMockData: true,
  }) as unknown as DataTable;

const wrap = (node: ReactNode) => (
  <I18nProvider initialLocale="en-US">{node}</I18nProvider>
);

const press = async (el: Element) => {
  await act(async () => {
    fireEvent.pointerDown(el, { pointerType: "mouse", button: 0 });
    fireEvent.pointerUp(el, { pointerType: "mouse", button: 0 });
    fireEvent.click(el);
  });
};

const control = (dialog: HTMLElement, name: string) =>
  within(dialog)
    .getByRole("group", { name })
    .querySelector<HTMLInputElement | HTMLTextAreaElement>("textarea, input")!;

function lastChange() {
  const call = applyDataChange.mock.calls.at(-1) as unknown as
    [{ ops: unknown[]; origin: string }] | undefined;
  return call?.[0];
}

let table: DataTable;
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  table = makeTable();
  store.collections = new Map([["c1", table]]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  useDataPanelStatusStore.setState({ status: null });
});

describe("RowForm — insert", () => {
  it("required first · optional section · id read-only · placeholders show the default · first field focused", () => {
    const { getByRole } = render(
      wrap(
        <RowForm table={table} mode={{ kind: "insert" }} onClose={() => {}} />,
      ),
    );
    const dialog = getByRole("dialog", { name: "Add a row to Users" });
    const sections = [...dialog.querySelectorAll(".section-title")].map(
      (el) => el.textContent,
    );
    expect(sections).toEqual([
      "Automatic",
      "Required fields",
      "Optional fields — empty takes the default",
    ]);
    expect(dialog.querySelector(".datatable-value-readonly")!.textContent).toBe(
      "Auto: row_3",
    );
    expect(document.activeElement).toBe(control(dialog, "name"));
    expect(control(dialog, "note").getAttribute("placeholder")).toBe(
      "Default: hi",
    );
    expect(control(dialog, "age").getAttribute("placeholder")).toBe("No value");
    expect(control(dialog, "tags").getAttribute("placeholder")).toBe(
      "Default: []",
    );
  });

  it("required empty → inline error (role=alert) + focus, write 0 · then filled → one insert_rows with typed defaults", async () => {
    const onClose = vi.fn();
    const { getByRole } = render(
      wrap(
        <RowForm table={table} mode={{ kind: "insert" }} onClose={onClose} />,
      ),
    );
    const dialog = getByRole("dialog");
    control(dialog, "age").focus();
    await press(within(dialog).getByRole("button", { name: "Save" }));
    expect(applyDataChange).not.toHaveBeenCalled();
    const alert = within(dialog).getByRole("alert");
    expect(alert.textContent).toBe("Required.");
    expect(document.activeElement).toBe(control(dialog, "name"));

    fireEvent.change(control(dialog, "name"), { target: { value: "Cy" } });
    expect(within(dialog).queryByRole("alert")).toBeNull();
    fireEvent.keyDown(control(dialog, "age"), { key: "Enter" });
    await waitFor(() => expect(applyDataChange).toHaveBeenCalledTimes(1));
    expect(lastChange()).toEqual({
      origin: "user",
      ops: [
        {
          op: "insert_rows",
          collectionId: "c1",
          rows: [
            // active: the text default "true" → boolean · tags: [] kept (a copy) · age: null
            {
              id: "row_3",
              name: "Cy",
              age: null,
              active: true,
              tags: [],
              note: "hi",
            },
          ],
          at: 2,
        },
      ],
    });
    expect(useDataPanelStatusStore.getState().status?.message).toBe(
      "Row added.",
    );
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("a number field with text → error of the type, write 0", async () => {
    const { getByRole } = render(
      wrap(
        <RowForm table={table} mode={{ kind: "insert" }} onClose={() => {}} />,
      ),
    );
    const dialog = getByRole("dialog");
    fireEvent.change(control(dialog, "name"), { target: { value: "Cy" } });
    fireEvent.change(control(dialog, "age"), { target: { value: "abc" } });
    await press(within(dialog).getByRole("button", { name: "Save" }));
    expect(applyDataChange).not.toHaveBeenCalled();
    expect(within(dialog).getByRole("alert").textContent).toBe(
      "Not a valid number.",
    );
    expect(document.activeElement).toBe(control(dialog, "age"));
  });

  it("Create more keeps the form open, cleared, first field focused — two rows in a row", async () => {
    const onClose = vi.fn();
    const { getByRole } = render(
      wrap(
        <RowForm table={table} mode={{ kind: "insert" }} onClose={onClose} />,
      ),
    );
    const dialog = getByRole("dialog");
    fireEvent.click(getByRole("switch", { name: "Create more" }));
    fireEvent.change(control(dialog, "name"), { target: { value: "Cy" } });
    fireEvent.keyDown(control(dialog, "age"), { key: "Enter" });
    await waitFor(() => expect(applyDataChange).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(control(dialog, "name").value).toBe(""));
    expect(onClose).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(control(dialog, "name"));
    fireEvent.change(control(dialog, "name"), { target: { value: "Dee" } });
    fireEvent.keyDown(control(dialog, "age"), { key: "Enter" });
    await waitFor(() => expect(applyDataChange).toHaveBeenCalledTimes(2));
    expect((lastChange()!.ops[0] as { rows: unknown[] }).rows[0]).toMatchObject(
      {
        name: "Dee",
      },
    );
  });

  it("Esc with input → ConfirmDialog (Discard closes · Cancel keeps) · Esc without input closes", async () => {
    const onClose = vi.fn();
    const { getByRole, queryByRole } = render(
      wrap(
        <RowForm table={table} mode={{ kind: "insert" }} onClose={onClose} />,
      ),
    );
    const dialog = getByRole("dialog", { name: "Add a row to Users" });
    const body = dialog.querySelector(".datatable-row-form-body")!;
    await act(async () => {
      fireEvent.keyDown(body, { key: "Escape" });
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.change(control(dialog, "name"), { target: { value: "x" } });
    await act(async () => {
      fireEvent.keyDown(body, { key: "Escape" });
    });
    const confirm = await waitFor(() => getByRole("alertdialog"));
    expect(confirm.textContent).toContain("Discard changes?");
    await press(within(confirm).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(queryByRole("alertdialog")).toBeNull());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(control(dialog, "name").value).toBe("x");
    await act(async () => {
      fireEvent.keyDown(body, { key: "Escape" });
    });
    await press(
      within(await waitFor(() => getByRole("alertdialog"))).getByRole(
        "button",
        { name: "Discard" },
      ),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(2));
  });
});

describe("RowForm — update", () => {
  const openUpdate = (rowIndex: number) =>
    ({
      kind: "update",
      rowIndex,
      opened: openRowFormTarget(table, rowIndex),
    }) as const;

  it("fields start at the row's values · only touched + changed cells are written, as one change", async () => {
    const onClose = vi.fn();
    const onSaved = vi.fn();
    const { getByRole } = render(
      wrap(
        <RowForm
          table={table}
          mode={openUpdate(0)}
          onClose={onClose}
          onSaved={onSaved}
        />,
      ),
    );
    const dialog = getByRole("dialog", { name: "Update a row of Users" });
    expect(dialog.querySelector(".datatable-value-readonly")).toBeNull();
    expect(control(dialog, "name").value).toBe("Ann");
    expect(control(dialog, "tags").value).toBe('["a"]');
    expect(control(dialog, "note").getAttribute("placeholder")).toBe(
      "No value",
    );
    fireEvent.change(control(dialog, "name"), { target: { value: "Anna" } });
    fireEvent.change(control(dialog, "age"), { target: { value: "31" } });
    // touched but the same value → not written
    fireEvent.change(control(dialog, "tags"), { target: { value: '["a"]' } });
    await press(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(applyDataChange).toHaveBeenCalledTimes(1));
    expect(lastChange()!.ops).toEqual([
      {
        op: "set_cell",
        collectionId: "c1",
        rowIndex: 0,
        fieldId: "f-name",
        value: "Anna",
      },
      {
        op: "set_cell",
        collectionId: "c1",
        rowIndex: 0,
        fieldId: "f-age",
        value: 31,
      },
    ]);
    expect(useDataPanelStatusStore.getState().status?.message).toBe(
      "Row updated.",
    );
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onSaved).toHaveBeenCalledWith(0);
  });

  it("an emptied field with a default → null (the default is not applied) · untouched required null → error", async () => {
    const { getByRole } = render(
      wrap(<RowForm table={table} mode={openUpdate(0)} onClose={() => {}} />),
    );
    const dialog = getByRole("dialog");
    fireEvent.change(control(dialog, "note"), { target: { value: "" } });
    await press(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(applyDataChange).toHaveBeenCalledTimes(1));
    expect(lastChange()!.ops).toEqual([
      {
        op: "set_cell",
        collectionId: "c1",
        rowIndex: 0,
        fieldId: "f-note",
        value: null,
      },
    ]);
  });

  it("the required current value null (untouched) blocks the save", async () => {
    table.mockData[1] = { ...table.mockData[1], name: null };
    const { getByRole } = render(
      wrap(<RowForm table={table} mode={openUpdate(1)} onClose={() => {}} />),
    );
    const dialog = getByRole("dialog");
    fireEvent.change(control(dialog, "age"), { target: { value: "42" } });
    await press(within(dialog).getByRole("button", { name: "Save" }));
    expect(applyDataChange).not.toHaveBeenCalled();
    expect(within(dialog).getByRole("alert").textContent).toBe("Required.");
  });

  it("no change → closes without writing", async () => {
    const onClose = vi.fn();
    const { getByRole } = render(
      wrap(<RowForm table={table} mode={openUpdate(0)} onClose={onClose} />),
    );
    await press(
      within(getByRole("dialog")).getByRole("button", { name: "Save" }),
    );
    expect(applyDataChange).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("the row set changed after opening (A deleted, index 1 is now C) → conflict: refused, input kept, Close", async () => {
    table.mockData.push({
      id: "row_3",
      name: "Cy",
      age: 1,
      active: true,
      tags: [],
      note: null,
    });
    const onClose = vi.fn();
    const { getByRole } = render(
      wrap(<RowForm table={table} mode={openUpdate(1)} onClose={onClose} />),
    );
    const dialog = getByRole("dialog");
    fireEvent.change(control(dialog, "name"), {
      target: { value: "Bob edited" },
    });
    // Another place deleted row 0 — the store now holds a re-projected table.
    const latest = {
      ...table,
      mockData: table.mockData.slice(1).map((row) => ({ ...row })),
    };
    store.collections = new Map([["c1", latest]]);
    await press(within(dialog).getByRole("button", { name: "Save" }));
    expect(applyDataChange).not.toHaveBeenCalled();
    const alert = within(dialog).getByRole("alert");
    expect(alert.textContent).toContain("rows changed after the form opened");
    expect(control(dialog, "name").value).toBe("Bob edited");
    expect(
      within(dialog)
        .getByRole("button", { name: "Save" })
        .hasAttribute("disabled"),
    ).toBe(true);
    await press(within(alert).getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("the table renamed meanwhile (same rows, new array) → the write lands on the opened index", async () => {
    const { getByRole } = render(
      wrap(<RowForm table={table} mode={openUpdate(1)} onClose={() => {}} />),
    );
    const dialog = getByRole("dialog");
    fireEvent.change(control(dialog, "name"), { target: { value: "Bobby" } });
    store.collections = new Map([
      [
        "c1",
        {
          ...table,
          name: "People",
          mockData: JSON.parse(JSON.stringify(table.mockData)),
        },
      ],
    ]);
    await press(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(applyDataChange).toHaveBeenCalledTimes(1));
    expect(lastChange()!.ops).toEqual([
      {
        op: "set_cell",
        collectionId: "c1",
        rowIndex: 1,
        fieldId: "f-name",
        value: "Bobby",
      },
    ]);
  });
});

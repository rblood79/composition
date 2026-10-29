// @vitest-environment jsdom
/**
 * ADR-288 G2 — the one variable table: name (a grid cell — 2026-10-29: click focuses, Enter · F2 ·
 * typing · double-click edits in place, Enter commits · Escape cancels), type (Select),
 * default by type (Switch · input · JSON popover — the project's only; a page · element structured
 * default is "set by a rule"), persist (project only), usage (hidden when dense → ⋮), a RAC state
 * row is name-only, a read-only index row goes to its owner.
 */
import type { ReactNode } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n";
import { VariableTable, type VariableTableRow } from "./VariableTable";

const wrap = (node: ReactNode) => (
  <I18nProvider initialLocale="en-US">{node}</I18nProvider>
);
const TYPES = ["string", "number", "boolean", "object", "array"].map((v) => ({
  value: v,
  label: v,
}));
const rows: VariableTableRow[] = [
  { id: "a", name: "count", type: "number", defaultValue: 3, usage: 2 },
  { id: "b", name: "open", type: "boolean", defaultValue: false, usage: 0 },
  {
    id: "c",
    name: "items",
    type: "array",
    defaultValue: [1],
    usage: 1,
    persist: true,
  },
  {
    id: "s",
    name: "selected",
    type: "string",
    defaultValue: "",
    usage: 0,
    source: { prop: "selectedKey" },
  },
];
const handlers = () => ({
  onRename: vi.fn(),
  onType: vi.fn(),
  onDefault: vi.fn(),
  onJsonDefault: vi.fn(),
  onPersist: vi.fn(),
  onRemove: vi.fn(),
  onGoToOwner: vi.fn(),
});

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => cleanup());

describe("VariableTable", () => {
  it("project owner: name commits on Enter, Escape restores; boolean is cell text; JSON popover commits valid JSON only; persist column", async () => {
    const h = handlers();
    const { container, getByRole, getAllByRole, queryByRole } = render(
      wrap(
        <VariableTable
          owner="project"
          rows={rows}
          label="Variables"
          typeOptions={TYPES}
          {...h}
        />,
      ),
    );
    expect(getByRole("grid", { name: "Variables" })).toBeTruthy();
    const headers = getAllByRole("columnheader").map((c) => c.textContent);
    expect(headers).toEqual([
      "Name",
      "Type",
      "Default value",
      "Persist",
      "Used",
      "Row actions",
    ]);

    // The name is cell text; double-click edits it in place, Enter commits once.
    const nameCell = container.querySelector<HTMLElement>(
      '[data-variable-id="a"] .variable-table__cell-name',
    )!;
    expect(nameCell.querySelector("input")).toBeNull();
    expect(nameCell.textContent).toBe("count");
    // (A click focuses the cell first — the grid's pointer focus.)
    act(() => nameCell.focus());
    fireEvent.doubleClick(nameCell);
    let name = nameCell.querySelector<HTMLInputElement>("input")!;
    expect(nameCell.getAttribute("data-editing")).toBe("inline");
    fireEvent.change(name, { target: { value: "total" } });
    fireEvent.keyDown(name, { key: "Enter" });
    expect(h.onRename).toHaveBeenCalledWith("a", "total");
    expect(nameCell.querySelector("input")).toBeNull();
    // Escape cancels: nothing written, the text stays.
    fireEvent.doubleClick(nameCell);
    name = nameCell.querySelector<HTMLInputElement>("input")!;
    fireEvent.change(name, { target: { value: "zzz" } });
    fireEvent.keyDown(name, { key: "Escape" });
    expect(h.onRename).toHaveBeenCalledTimes(1);
    expect(nameCell.textContent).toBe("count");
    // A typed key on the focused cell starts the edit with that key (the grid's rule).
    fireEvent.keyDown(nameCell, { key: "x" });
    name = nameCell.querySelector<HTMLInputElement>("input")!;
    expect(name.value).toBe("x");
    fireEvent.blur(name);
    expect(h.onRename).toHaveBeenLastCalledWith("a", "x");

    // A boolean default is cell text (true · false), not a switch — its list is the next test.
    const boolCell = container.querySelector<HTMLElement>(
      '[data-variable-id="b"] .variable-table__cell-default',
    )!;
    expect(boolCell.querySelector("input")).toBeNull();
    expect(boolCell.textContent).toBe("false");

    const persist = container.querySelector<HTMLInputElement>(
      '[data-variable-id="c"] .variable-table__cell-persist input[type="checkbox"]',
    )!;
    expect(persist.checked).toBe(true);
    fireEvent.click(persist);
    expect(h.onPersist).toHaveBeenCalledWith("c", false);

    // Delete is the row's only action here — a button, no one-item ⋮ menu (2026-10-29).
    expect(queryByRole("button", { name: "count actions" })).toBeNull();
    fireEvent.click(getByRole("button", { name: "Delete count" }));
    expect(h.onRemove).toHaveBeenCalledWith("a");

    // JSON default: the grid's popover editor on the cell (Enter opens it); ⏎ saves valid JSON,
    // a half-typed value stays open marked invalid.
    const jsonCell = container.querySelector<HTMLElement>(
      '[data-variable-id="c"] .variable-table__cell-default',
    )!;
    expect(jsonCell.textContent).toBe("[1]");
    expect(jsonCell.getAttribute("data-edit-kind")).toBe("popover");
    act(() => jsonCell.focus());
    fireEvent.keyDown(jsonCell, { key: "Enter" });
    expect(jsonCell.getAttribute("data-editing")).toBe("popover");
    let textarea = getByRole("textbox", {
      name: /items Default value/,
    }) as HTMLTextAreaElement;
    expect(textarea.value).toBe("[1]");
    fireEvent.change(textarea, { target: { value: "[1," } });
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(h.onJsonDefault).not.toHaveBeenCalled();
    // (The editor's save is async — the invalid mark lands a tick later.)
    await waitFor(() =>
      expect(textarea.getAttribute("aria-invalid")).toBe("true"),
    );
    fireEvent.change(textarea, { target: { value: "[1, 2]" } });
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(h.onJsonDefault).toHaveBeenCalledWith("c", [1, 2]);
    expect(queryByRole("textbox", { name: /items Default value/ })).toBeNull();
    // One JSON type on screen: an object value is accepted on an array row too — the owner stores
    // the type from the value (2026-10-29); a bare scalar is not JSON here.
    fireEvent.doubleClick(jsonCell);
    textarea = getByRole("textbox", {
      name: /items Default value/,
    }) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '{"a":1}' } });
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(h.onJsonDefault).toHaveBeenLastCalledWith("c", { a: 1 });
    fireEvent.doubleClick(jsonCell);
    textarea = getByRole("textbox", {
      name: /items Default value/,
    }) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "3" } });
    fireEvent.keyDown(textarea, { key: "Enter" });
    await waitFor(() =>
      expect(textarea.getAttribute("aria-invalid")).toBe("true"),
    );
    expect(h.onJsonDefault).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(textarea, { key: "Escape" });

    // A RAC state row: name input only — type and default are text.
    const sourceRow = container.querySelector('[data-variable-id="s"]')!;
    expect(sourceRow.getAttribute("data-source")).toBe("true");
    expect(
      sourceRow.querySelector(".variable-table__cell-type .react-aria-Select"),
    ).toBeNull();
    expect(
      sourceRow.querySelector(".variable-table__cell-default")?.textContent,
    ).toContain("selectedKey");
  });

  it("a boolean default cell: Enter opens true · false on the cell, a typed key does not, a pick writes", async () => {
    const h = handlers();
    const { container, findByRole, queryByRole } = render(
      wrap(
        <VariableTable
          owner="project"
          rows={rows}
          label="Variables"
          typeOptions={TYPES}
          {...h}
        />,
      ),
    );
    const cell = container.querySelector<HTMLElement>(
      '[data-variable-id="b"] .variable-table__cell-default',
    )!;
    expect(cell.getAttribute("data-edit-kind")).toBe("list");
    act(() => cell.focus());
    fireEvent.keyDown(cell, { key: "t" });
    expect(queryByRole("listbox")).toBeNull();
    fireEvent.keyDown(cell, { key: "Enter" });
    expect(cell.getAttribute("data-editing")).toBe("popover");
    const list = await findByRole("listbox", { name: "open Default value" });
    expect(
      [...list.querySelectorAll('[role="option"]')].map((o) => o.textContent),
    ).toEqual(["true", "false"]);
    fireEvent.click(await findByRole("option", { name: "true" }));
    expect(h.onDefault).toHaveBeenCalledWith("b", "true");
    expect(queryByRole("listbox")).toBeNull();
  });

  it("a date default: Enter · double-click open the browser's date picker on the cell, a typed key edits the ISO text; dense rows get the picker field", async () => {
    const h = handlers();
    const dateRows: VariableTableRow[] = [
      {
        id: "d",
        name: "due",
        type: "date",
        defaultValue: "2026-10-29",
        usage: 0,
      },
      { id: "t", name: "at", type: "date", defaultValue: "10:30", usage: 0 },
    ];
    const { container, rerender } = render(
      wrap(
        <VariableTable
          owner="project"
          rows={dateRows}
          label="Variables"
          typeOptions={TYPES}
          {...h}
        />,
      ),
    );
    const cell = container.querySelector<HTMLElement>(
      '[data-variable-id="d"] .variable-table__cell-default',
    )!;
    expect(cell.textContent).toBe("2026-10-29");
    act(() => cell.focus());
    fireEvent.keyDown(cell, { key: "Enter" });
    let input = cell.querySelector<HTMLInputElement>("input")!;
    expect(input.type).toBe("date");
    expect(input.value).toBe("2026-10-29");
    fireEvent.change(input, { target: { value: "2026-11-01" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(h.onDefault).toHaveBeenCalledWith("d", "2026-11-01");
    // A typed key edits the ISO text (another precision can be typed).
    fireEvent.keyDown(cell, { key: "2" });
    input = cell.querySelector<HTMLInputElement>("input")!;
    expect(input.type).toBe("text");
    expect(input.value).toBe("2");
    fireEvent.keyDown(input, { key: "Escape" });
    // A time's picker is a time field.
    const timeCell = container.querySelector<HTMLElement>(
      '[data-variable-id="t"] .variable-table__cell-default',
    )!;
    act(() => timeCell.focus());
    fireEvent.doubleClick(timeCell);
    input = timeCell.querySelector<HTMLInputElement>("input")!;
    expect(input.type).toBe("time");
    expect(input.value).toBe("10:30");
    fireEvent.keyDown(input, { key: "Escape" });

    rerender(
      wrap(
        <VariableTable
          owner="page"
          dense
          rows={dateRows}
          label="State"
          typeOptions={TYPES}
          {...h}
        />,
      ),
    );
    const dense = container.querySelector<HTMLInputElement>(
      '[data-variable-id="d"] .variable-row__default input',
    )!;
    expect(dense.type).toBe("date");
    expect(dense.value).toBe("2026-10-29");
  });

  it("the JSON editor: Escape · Cancel drop the draft, a typed key starts it with the key", async () => {
    const h = handlers();
    const { container, findByRole, getByRole, queryByRole } = render(
      wrap(
        <VariableTable
          owner="project"
          rows={rows}
          label="Variables"
          typeOptions={TYPES}
          {...h}
        />,
      ),
    );
    const cell = container.querySelector<HTMLElement>(
      '[data-variable-id="c"] .variable-table__cell-default',
    )!;
    act(() => cell.focus());
    fireEvent.keyDown(cell, { key: "Enter" });
    let textarea = (await findByRole("textbox", {
      name: /items Default value/,
    })) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "[9]" } });
    fireEvent.keyDown(textarea, { key: "Escape" });
    expect(h.onJsonDefault).not.toHaveBeenCalled();
    expect(queryByRole("textbox", { name: /items Default value/ })).toBeNull();
    fireEvent.keyDown(cell, { key: "Enter" });
    textarea = (await findByRole("textbox", {
      name: /items Default value/,
    })) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "[9]" } });
    fireEvent.click(getByRole("button", { name: "Cancel" }));
    expect(h.onJsonDefault).not.toHaveBeenCalled();
    // A typed key opens the editor with the key as the draft (the grid's rule).
    fireEvent.keyDown(cell, { key: "[" });
    textarea = (await findByRole("textbox", {
      name: /items Default value/,
    })) as HTMLTextAreaElement;
    expect(textarea.value).toBe("[");
    fireEvent.click(getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(textarea.getAttribute("aria-invalid")).toBe("true"),
    );
  });

  it("object and array show as one JSON type; picking JSON stores object, and keeps a structured type", async () => {
    const h = handlers();
    const { container, findByRole, queryByRole } = render(
      wrap(
        <VariableTable
          owner="project"
          rows={rows}
          label="Variables"
          typeOptions={TYPES}
          {...h}
        />,
      ),
    );
    const typeOf = (id: string) =>
      container.querySelector<HTMLElement>(
        `[data-variable-id="${id}"] .variable-table__cell-type`,
      )!;
    expect(typeOf("c").textContent).toBe("JSON");
    act(() => typeOf("a").focus());
    fireEvent.keyDown(typeOf("a"), { key: "Enter" });
    const list = await findByRole("listbox", { name: "Type" });
    expect(
      [...list.querySelectorAll('[role="option"]')].map(
        (o) =>
          o.querySelector(".property-select__option-text > :first-child")
            ?.textContent,
      ),
    ).toEqual(["String", "Number", "Boolean", "JSON"]);
    // The column editor's hints under each name (the one type list, 2026-10-29).
    expect(
      list.querySelector(".property-select__option-description")?.textContent,
    ).toBe("Text — names, titles, descriptions");
    fireEvent.click(await findByRole("option", { name: "JSON" }));
    expect(h.onType).toHaveBeenCalledWith("a", "object");
    expect(queryByRole("listbox")).toBeNull();
    // An array row picking JSON again changes nothing.
    act(() => typeOf("c").focus());
    fireEvent.keyDown(typeOf("c"), { key: "Enter" });
    fireEvent.click(await findByRole("option", { name: "JSON" }));
    expect(h.onType).toHaveBeenCalledTimes(1);
  });

  it("the type cell: a click only focuses it; Enter · double-click open the type list on the cell; a pick writes and closes", async () => {
    const h = handlers();
    const { container, findByRole, queryByRole } = render(
      wrap(
        <VariableTable
          owner="project"
          rows={rows}
          label="Variables"
          typeOptions={TYPES}
          {...h}
        />,
      ),
    );
    const typeCell = container.querySelector<HTMLElement>(
      '[data-variable-id="a"] .variable-table__cell-type',
    )!;
    // No picker button inside — the click lands on the cell.
    expect(typeCell.querySelector("button")).toBeNull();
    fireEvent.click(typeCell);
    expect(queryByRole("listbox")).toBeNull();
    act(() => typeCell.focus());
    fireEvent.keyDown(typeCell, { key: "Enter" });
    expect(typeCell.getAttribute("data-editing")).toBe("popover");
    fireEvent.click(await findByRole("option", { name: "String" }));
    expect(h.onType).toHaveBeenCalledWith("a", "string");
    expect(queryByRole("listbox")).toBeNull();
    // A typed letter does not open the list (it is not a text cell).
    fireEvent.keyDown(typeCell, { key: "s" });
    expect(queryByRole("listbox")).toBeNull();
    fireEvent.doubleClick(typeCell);
    expect(await findByRole("listbox", { name: "Type" })).toBeTruthy();
  });

  it("page owner · dense: a panel field row per variable, structured default is set by a rule, ⋮ holds usage and delete", () => {
    const h = handlers();
    const { container, getAllByRole, getByRole } = render(
      wrap(
        <VariableTable
          owner="page"
          dense
          rows={rows}
          label="State"
          typeOptions={TYPES}
          onRename={h.onRename}
          onType={h.onType}
          onDefault={h.onDefault}
          onRemove={h.onRemove}
        />,
      ),
    );
    // The Design panel: no table — a panel field row per variable (2026-10-29 「Design 패널 State
    // 절은 변수마다 패널행」): [name + type][default][⋮], the row's ⋮ in the action column.
    expect(container.querySelector("table")).toBeNull();
    expect(
      container.querySelector(".variable-rows")?.getAttribute("data-look"),
    ).toBe("fields");
    const row = container.querySelector('[data-variable-id="a"]')!;
    expect(row.classList.contains("fieldset-row")).toBe(true);
    expect(row.querySelector(".variable-row__name input")).not.toBeNull();
    expect(
      row.querySelector(".variable-row__name .variable-row__type"),
    ).not.toBeNull();
    expect(
      getByRole("button", { name: "count actions" }).closest(
        ".fieldset-actions",
      )?.parentElement,
    ).toBe(row);
    expect(container.querySelector("[data-edit-column]")).toBeNull();
    // A boolean's default is a true · false Select, not a switch (2026-10-29).
    const boolRow = container.querySelector('[data-variable-id="b"]')!;
    expect(boolRow.querySelector(".react-aria-Switch")).toBeNull();
    expect(
      boolRow.querySelector(".variable-row__default .react-aria-Button")
        ?.textContent,
    ).toContain("false");
    fireEvent.change(boolRow.querySelector(".variable-row__default select")!, {
      target: { value: "true" },
    });
    expect(h.onDefault).toHaveBeenCalledWith("b", "true");
    expect(
      container.querySelector('[data-variable-id="c"] .variable-row__default')
        ?.textContent,
    ).toBe("set by a rule");
    expect(container.querySelector("[data-edit-kind]")).toBeNull();

    fireEvent.click(getByRole("button", { name: "count actions" }));
    const items = getAllByRole("menuitem").map((i) => i.textContent);
    expect(items).toEqual(["Used in 2", "Delete"]);
    fireEvent.click(getByRole("menuitem", { name: "Delete" }));
    expect(h.onRemove).toHaveBeenCalledWith("a");
  });

  it("dense · a JSON default with an owner handler is a field button that opens the grid's editor (the State section, 2026-10-29)", async () => {
    const h = handlers();
    const { container, findByRole, getByRole } = render(
      wrap(
        <VariableTable
          owner="page"
          dense
          rows={rows}
          label="State"
          typeOptions={TYPES}
          {...h}
        />,
      ),
    );
    const row = container.querySelector('[data-variable-id="c"]')!;
    const button = row.querySelector<HTMLButtonElement>(
      ".variable-row__default .variable-row__json",
    )!;
    expect(button.textContent).toBe("[1]");
    fireEvent.click(button);
    const textarea = (await findByRole("textbox", {
      name: /items Default value/,
    })) as HTMLTextAreaElement;
    expect(textarea.value).toBe("[1]");
    fireEvent.change(textarea, { target: { value: '{"k": 1}' } });
    fireEvent.click(getByRole("button", { name: "Save" }));
    expect(h.onJsonDefault).toHaveBeenCalledWith("c", { k: 1 });
    await waitFor(() =>
      expect(row.querySelector(".variable-row__default textarea")).toBeNull(),
    );
  });

  it("a read-only index row shows its owner and goes to it", () => {
    const h = handlers();
    const { container, getByRole } = render(
      wrap(
        <VariableTable
          owner="project"
          rows={[
            {
              id: "x",
              name: "filter",
              type: "string",
              defaultValue: "a",
              usage: 1,
              readOnly: { owner: "Home" },
            },
          ]}
          label="Variables"
          typeOptions={TYPES}
          {...h}
        />,
      ),
    );
    const row = container.querySelector('[data-variable-id="x"]')!;
    expect(row.getAttribute("data-read-only")).toBe("true");
    expect(row.querySelector("input")).toBeNull();
    expect(row.textContent).toContain("Home");
    fireEvent.click(getByRole("button", { name: "Edit at owner" }));
    expect(h.onGoToOwner).toHaveBeenCalledWith("x");
  });
});

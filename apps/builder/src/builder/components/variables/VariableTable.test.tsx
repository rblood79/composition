// @vitest-environment jsdom
/**
 * ADR-288 G2 — the one variable table: name (Enter commits · Escape restores), type (Select),
 * default by type (Switch · input · JSON popover — the project's only; a page · element structured
 * default is "set by a rule"), persist (project only), usage (hidden when dense → ⋮), a RAC state
 * row is name-only, a read-only index row goes to its owner.
 */
import type { ReactNode } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
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
  it("project owner: name commits on Enter, Escape restores; boolean is a switch; JSON popover commits valid JSON only; persist column", () => {
    const h = handlers();
    const { container, getByRole, getAllByRole } = render(
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

    const name = container.querySelector<HTMLInputElement>(
      '[data-variable-id="a"] .variable-table__cell-name input',
    )!;
    fireEvent.change(name, { target: { value: "total" } });
    fireEvent.keyDown(name, { key: "Enter" });
    fireEvent.blur(name);
    expect(h.onRename).toHaveBeenCalledWith("a", "total");
    fireEvent.change(name, { target: { value: "zzz" } });
    fireEvent.keyDown(name, { key: "Escape" });
    fireEvent.blur(name);
    expect(h.onRename).toHaveBeenCalledTimes(1);
    expect(name.value).toBe("count");

    const toggle = container.querySelector<HTMLInputElement>(
      '[data-variable-id="b"] .variable-table__cell-default input[type="checkbox"]',
    )!;
    fireEvent.click(toggle);
    expect(h.onDefault).toHaveBeenCalledWith("b", "true");

    const persist = container.querySelector<HTMLInputElement>(
      '[data-variable-id="c"] .variable-table__cell-persist input[type="checkbox"]',
    )!;
    expect(persist.checked).toBe(true);
    fireEvent.click(persist);
    expect(h.onPersist).toHaveBeenCalledWith("c", false);

    // JSON default: a popover textarea; a half-typed value writes nothing.
    const jsonTrigger = container.querySelector<HTMLButtonElement>(
      '[data-variable-id="c"] .variable-table__json-trigger',
    )!;
    expect(jsonTrigger.textContent).toContain("[1]");
    fireEvent.click(jsonTrigger);
    const textarea = getByRole("textbox", {
      name: /items Default value/,
    }) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "[1," } });
    fireEvent.blur(textarea);
    expect(h.onJsonDefault).not.toHaveBeenCalled();
    expect(textarea.getAttribute("aria-invalid")).toBe("true");
    fireEvent.change(textarea, { target: { value: "[1, 2]" } });
    fireEvent.blur(textarea);
    expect(h.onJsonDefault).toHaveBeenCalledWith("c", [1, 2]);

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

  it("page owner · dense: no persist · usage columns, structured default is set by a rule, ⋮ holds usage and delete", () => {
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
    const headers = getAllByRole("columnheader").map((c) => c.textContent);
    expect(headers).toEqual(["Name", "Type", "Default value", "Row actions"]);
    expect(
      container.querySelector(
        '[data-variable-id="c"] .variable-table__cell-default',
      )?.textContent,
    ).toBe("set by a rule");
    expect(
      container.querySelector(
        '[data-variable-id="c"] .variable-table__json-trigger',
      ),
    ).toBeNull();

    fireEvent.click(getByRole("button", { name: "count actions" }));
    const items = getAllByRole("menuitem").map((i) => i.textContent);
    expect(items).toEqual(["Used in 2", "Delete"]);
    fireEvent.click(getByRole("menuitem", { name: "Delete" }));
    expect(h.onRemove).toHaveBeenCalledWith("a");
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

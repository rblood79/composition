/**
 * The Value field's 「값 고르기」 — the rule's own sources (its When's arguments, the selected
 * item's fields on a bound owner, the variables in reach) in one searchable list; a pick stores a
 * whole-value reference and shows as a chip; a source of another shape than the slot says so.
 */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n";
import { ValueField } from "../ValueField";
import {
  catalogValueFits,
  catalogValueOptions,
  type CatalogValueSources,
} from "../valueOptions";

afterEach(cleanup);

const wrap = (ui: React.ReactNode) =>
  render(<I18nProvider initialLocale="en-US">{ui}</I18nProvider>);

const SOURCES: CatalogValueSources = {
  eventArgs: ["value", "keys"],
  items: {
    fields: [
      { key: "name", type: "string" },
      { key: "age", type: "number" },
    ],
    single: true,
  },
  variables: [{ id: "project:stateVariable:t", name: "TEMP", type: "string" }],
};

describe("Value field — the sources a rule can name", () => {
  it("lists the When's arguments, the selected item (whole · fields) and the variables", () => {
    expect(
      catalogValueOptions(SOURCES).map((option) => [option.value, option.type]),
    ).toEqual([
      ["!event.value", undefined],
      ["!event.keys", "array"],
      ["!item.keys", "object"],
      ["!item.keys.name", "string"],
      ["!item.keys.age", "number"],
      ["!var.project:stateVariable:t", "string"],
    ]);
    // (A multiple selection's item reads are lists; an unbound owner has no item.)
    expect(
      catalogValueOptions({
        ...SOURCES,
        items: { ...SOURCES.items!, single: false },
      })
        .filter((option) => option.group === "item")
        .map((option) => option.type),
    ).toEqual(["array", "array", "array"]);
    expect(
      catalogValueOptions({ ...SOURCES, items: undefined }).some(
        (option) => option.group === "item",
      ),
    ).toBe(false);
  });

  it("a fit: same shape, or a number · boolean into a text", () => {
    const [, keys, whole, name, age] = catalogValueOptions(SOURCES);
    expect(catalogValueFits(name!, "string")).toBe(true);
    expect(catalogValueFits(age!, "string")).toBe(true);
    expect(catalogValueFits(whole!, "object")).toBe(true);
    expect(catalogValueFits(whole!, "string")).toBe(false);
    expect(catalogValueFits(keys!, "string")).toBe(false);
  });

  it("pick → the reference; a chip shows it; clear returns to the literal", () => {
    const onChange = vi.fn();
    const view = wrap(
      <ValueField
        label="Value"
        kind="text"
        value="hello"
        sources={SOURCES}
        expectedType="string"
        onChange={onChange}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Value: Pick a value" }),
    );
    const list = screen.getByRole("listbox", { name: "Pick a value" });
    expect(
      [...list.querySelectorAll("header")].map((header) => header.textContent),
    ).toEqual(["This event", "Selected item", "Variables"]);
    fireEvent.click(within(list).getByRole("option", { name: /name/ }));
    expect(onChange).toHaveBeenLastCalledWith("!item.keys.name");

    view.rerender(
      <I18nProvider initialLocale="en-US">
        <ValueField
          label="Value"
          kind="text"
          value="!item.keys.name"
          sources={SOURCES}
          expectedType="string"
          onChange={onChange}
        />
      </I18nProvider>,
    );
    expect(screen.getByText("Selected item › name")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Value: Clear value" }));
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("a whole row into a text variable says so (no silent stringify)", () => {
    wrap(
      <ValueField
        label="Value"
        kind="text"
        value="!item.keys"
        sources={SOURCES}
        expectedType="string"
        onChange={() => {}}
      />,
    );
    expect(screen.getByText("Selected item › Whole item")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain(
      "A object value doesn't fit a string variable",
    );
  });

  it("search narrows the list", () => {
    wrap(
      <ValueField
        label="Value"
        kind="text"
        value=""
        sources={SOURCES}
        onChange={() => {}}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Value: Pick a value" }),
    );
    fireEvent.change(screen.getByRole("searchbox", { name: "Search values" }), {
      target: { value: "TEMP" },
    });
    const list = screen.getByRole("listbox", { name: "Pick a value" });
    expect(
      within(list)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["TEMPstring"]);
  });
});

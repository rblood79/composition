/**
 * ADR-246 ratchet 조사 (2026-11-12) — a closed `PanelSelect` gives RAC only the selected item.
 *
 * RAC `Select` renders a hidden native `<select>` with one `<option>` per item of its collection
 * (form submit · browser autofill — a panel uses neither; no prop turns it off below 300 items).
 * A closed Locale select (36 items) put 37 `<option>` in the DOM on every selection: select-class
 * `domMutations.childList` 280 → 922. The list is given in full while the popover is open.
 */
import { cleanup, fireEvent, render } from "@testing-library/react";
import { ListBoxSection } from "react-aria-components/ListBox";
import { Header } from "react-aria-components/Header";
import { SelectValue } from "react-aria-components/Select";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PanelSelect, PanelSelectItem } from "./PanelSelect";

afterEach(cleanup);

const NAMES = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta"];
const items = () =>
  NAMES.map((name) => (
    <PanelSelectItem key={name} id={name.toLowerCase()} label={name} />
  ));
const hiddenOptions = (ui: ReturnType<typeof render>) =>
  [...ui.container.querySelectorAll("option")].map((option) => option.value);

function select(
  selectedKey: string | null,
  children: React.ReactNode = items(),
  onSelectionChange = vi.fn(),
) {
  return render(
    <PanelSelect
      aria-label="Letter"
      selectedKey={selectedKey}
      onSelectionChange={onSelectionChange}
      trigger={<SelectValue />}
    >
      {children}
    </PanelSelect>,
  );
}

describe("PanelSelect — closed, RAC gets the selected item only", () => {
  it("closed: the hidden select has the selected option, the trigger shows it; open: the whole list", () => {
    const onSelectionChange = vi.fn();
    const ui = select("gamma", items(), onSelectionChange);
    // (The first option is RAC's blank one.)
    expect(hiddenOptions(ui)).toEqual(["", "gamma"]);
    expect(ui.getByRole("button").textContent).toContain("Gamma");

    fireEvent.click(ui.getByRole("button"));
    expect(ui.getAllByRole("option").map((o) => o.textContent)).toEqual(NAMES);
    fireEvent.click(ui.getByRole("option", { name: "Epsilon" }));
    expect(onSelectionChange).toHaveBeenCalledWith("epsilon");
  });

  it("a selected item inside a section is found; nothing selected gives the first item (RAC opens no empty select)", () => {
    const sectioned = (
      <>
        <PanelSelectItem id="none" label="None" />
        <ListBoxSection className="react-aria-ListBoxSection">
          <Header>Greek</Header>
          {items()}
        </ListBoxSection>
      </>
    );
    const ui = select("delta", sectioned);
    expect(hiddenOptions(ui)).toEqual(["", "delta"]);
    expect(ui.getByRole("button").textContent).toContain("Delta");
    cleanup();

    const empty = select(null);
    expect(hiddenOptions(empty)).toEqual(["", "alpha"]);
    expect(empty.getByRole("button").textContent).not.toContain("Alpha");
    fireEvent.click(empty.getByRole("button"));
    expect(empty.getAllByRole("option")).toHaveLength(NAMES.length);
  });

  it("the keyboard opens the whole list with the selected item focused", () => {
    const ui = select("beta");
    const trigger = ui.getByRole("button");
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyUp(trigger, { key: "ArrowDown" });
    expect(ui.getAllByRole("option")).toHaveLength(NAMES.length);
    expect(document.activeElement?.textContent).toBe("Beta");
  });

  it("items it cannot read (no `id` on the element) are given in full, as before", () => {
    const Wrapped = ({ name }: { name: string }) => (
      <PanelSelectItem id={name.toLowerCase()} label={name} />
    );
    const ui = select(
      "beta",
      NAMES.map((name) => <Wrapped key={name} name={name} />),
    );
    expect(hiddenOptions(ui)).toHaveLength(NAMES.length + 1);
    expect(ui.getByRole("button").textContent).toContain("Beta");
  });
});

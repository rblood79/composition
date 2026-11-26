/**
 * perf ratchet 조사 (2026-11-26, 사용자 결정) — a group's Selected · Disabled keys field is a select
 * that takes several (RAC `Select` `selectionMode="multiple"`), not a check list of one RAC Checkbox
 * per item. A 300-item list put 300 controls in the Design panel on every selection
 * (`600:scroll-boxes` attribute mutations 65 → 1,568 — `4ac2d5ec3`). Closed, RAC is given the picked
 * items only (its hidden native `<option>` per collection item); the whole list while open.
 */
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SelectionKeysField } from "./SelectionKeysField";

afterEach(cleanup);

const OPTIONS = Array.from({ length: 300 }, (_, i) => ({
  value: `k${i}`,
  label: `Item ${i}`,
}));
const hiddenOptions = (ui: ReturnType<typeof render>) =>
  [...ui.container.querySelectorAll("option")].map((option) => option.value);

describe("SelectionKeysField — a group's items as a multiple select", () => {
  it("closed: no control per item — the hidden select holds the picked keys, the trigger lists them", () => {
    const ui = render(
      <SelectionKeysField
        label="Disabled keys"
        value={["k3", "k7"]}
        options={OPTIONS}
        onChange={() => {}}
      />,
    );
    expect(ui.container.querySelectorAll(".react-aria-Checkbox")).toHaveLength(
      0,
    );
    expect(hiddenOptions(ui).filter(Boolean).sort()).toEqual(["k3", "k7"]);
    const trigger = ui.getByRole("button");
    expect(trigger.textContent).toContain("Item 3");
    expect(trigger.textContent).toContain("Item 7");
  });

  it("nothing picked shows — ; open lists every item and a pick adds its key", () => {
    const onChange = vi.fn();
    const ui = render(
      <SelectionKeysField
        label="Disabled keys"
        value={[]}
        options={OPTIONS}
        onChange={onChange}
      />,
    );
    expect(ui.getByRole("button").textContent).toContain("—");
    fireEvent.click(ui.getByRole("button"));
    expect(ui.getAllByRole("option")).toHaveLength(OPTIONS.length);
    fireEvent.click(ui.getByRole("option", { name: "Item 5" }));
    expect(onChange).toHaveBeenLastCalledWith(["k5"]);
  });

  it("a picked item clicked again is taken out", () => {
    const onChange = vi.fn();
    const ui = render(
      <SelectionKeysField
        label="Selected keys"
        value={["k1", "k2"]}
        options={OPTIONS}
        onChange={onChange}
      />,
    );
    fireEvent.click(ui.getByRole("button"));
    fireEvent.click(ui.getByRole("option", { name: "Item 1" }));
    expect(onChange).toHaveBeenLastCalledWith(["k2"]);
  });
});

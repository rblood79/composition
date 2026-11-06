import { act, fireEvent, waitFor } from "@testing-library/react";
import { expect, it } from "vitest";
import { openAdr280Preview } from "./support/adr280Harness";

it.each(["ListBox", "GridList", "Tree"])(
  "%s select-all keyboard selection remains rendered and can be cleared",
  async (type) => {
    const h = await openAdr280Preview([type]);
    const id = h.ids[0]!;
    h.declare(id, { selectionMode: "multiple" });
    const list = h.element(id)!;
    const options = () => [
      ...list.querySelectorAll(
        type === "ListBox" ? '[role="option"]' : '[role="row"]',
      ),
    ];
    expect(options().length).toBeGreaterThan(1);
    act(() => {
      (options()[0] as HTMLElement).focus();
      fireEvent.keyDown(options()[0], {
        key: "a",
        code: "KeyA",
        ctrlKey: true,
      });
    });
    await waitFor(() => {
      expect(
        options().every(
          (option) => option.getAttribute("aria-selected") === "true",
        ),
      ).toBe(true);
    });
    act(() => {
      fireEvent.keyDown(options()[0], { key: "Escape", code: "Escape" });
    });
    await waitFor(() => {
      expect(
        options().every(
          (option) => option.getAttribute("aria-selected") === "false",
        ),
      ).toBe(true);
    });
    h.view.unmount();
  },
);

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PropertyInput } from "./PropertyInput";
import {
  PropertySelectionContext,
  type PropertySelectionSource,
} from "./propertySelection";

afterEach(cleanup);

/**
 * ADR-248 4e-7: a property field reads the selection it edits from `PropertySelectionContext`
 * (the catalog session), not the old element store (always empty in the catalog Builder — the
 * blur check never held, so a value typed before clicking another element was written to it).
 */
function selectionSource(initial: string) {
  let current: string | null = initial;
  const listeners = new Set<() => void>();
  const source: PropertySelectionSource = {
    useSelectedId: () =>
      useSyncExternalStore(
        (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        () => current,
      ),
    readSelectedId: () => current,
  };
  const select = (id: string) => {
    current = id;
    listeners.forEach((listener) => listener());
  };
  return { source, select };
}

const here = dirname(fileURLToPath(import.meta.url));
const FIELD_FILES = [
  "PropertyInput.tsx",
  "PropertyNumberInput.tsx",
  "PropertyUnitInput.tsx",
  "PropertyColor.tsx",
];

describe("property fields follow the provided selection", () => {
  it("PropertyInput: a new selection resets the typed text to the field's value", async () => {
    const { source, select } = selectionSource("node-a");
    render(
      <PropertySelectionContext.Provider value={source}>
        <PropertyInput label="Name" value="a" onChange={vi.fn()} />
      </PropertySelectionContext.Provider>,
    );
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "42" } });
    await act(async () => select("node-b"));
    expect(input.value).toBe("a");
  });

  it("the fields read the selection from the context, not the old element store", () => {
    for (const file of FIELD_FILES) {
      const source = readFileSync(join(here, file), "utf-8");
      expect(source, file).not.toMatch(/from "\.\.\/\.\.\/stores"/);
      expect(source, file).toContain("usePropertySelection()");
    }
  });

  it("PropertyInput: a blur after the selection changed drops the typed value; the same selection commits", async () => {
    for (const switchSelection of [true, false]) {
      const onChange = vi.fn();
      const { source, select } = selectionSource("node-a");
      render(
        <PropertySelectionContext.Provider value={source}>
          <PropertyInput label="Name" value="a" onChange={onChange} />
        </PropertySelectionContext.Provider>,
      );
      const input = screen.getByRole("textbox");
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: "42" } });
      if (switchSelection) select("node-b");
      fireEvent.blur(input);
      if (switchSelection) expect(onChange).not.toHaveBeenCalled();
      else expect(onChange).toHaveBeenCalledWith("42");
      cleanup();
    }
  });
});

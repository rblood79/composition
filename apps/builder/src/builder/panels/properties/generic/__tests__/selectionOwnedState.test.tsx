// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../../../../i18n";
import {
  PropertySelectionContext,
  useSelectionState,
  type PropertySelectionSource,
} from "../../../../components/property/propertySelection";
import type { ResolvedField } from "@composition/shared";
import { NumberFormatField } from "../NumberFormatField";

afterEach(cleanup);

/**
 * CANVAS_PERF_SCALING_2026-11 C1 follow-up: the Property fields stay mounted across a selection of
 * the same type, so a field's own state (a refusal note, an expanded row) is the state of the
 * element it was made on — another selection starts from the initial value.
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

describe("a field's own state belongs to the selection it was made on", () => {
  it("NumberFormatField: the refusal note does not follow to the next element", () => {
    const { source, select } = selectionSource("node-a");
    const onChange = vi.fn();
    render(
      <I18nProvider initialLocale="en-US">
        <PropertySelectionContext.Provider value={source}>
          <NumberFormatField
            field={{ label: "Format" } as ResolvedField}
            value={{ style: "currency", currency: "USD" }}
            onChange={onChange}
          />
        </PropertySelectionContext.Provider>
      </I18nProvider>,
    );
    const currency = screen
      .getAllByRole("textbox")
      .find(
        (input) => (input as HTMLInputElement).value === "USD",
      ) as HTMLInputElement;
    act(() => currency.focus());
    fireEvent.change(currency, { target: { value: "not a currency" } });
    act(() => currency.blur());
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeTruthy();

    act(() => select("node-b"));
    expect(screen.queryByRole("alert")).toBeNull();
    // Back on the first element the note stays gone: the text it was about was reset (live: the
    // note came back beside a valid "USD").
    act(() => select("node-a"));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("useSelectionState: a selection change starts over from the initial value", () => {
    const { source, select } = selectionSource("node-a");
    function Probe() {
      const [open, setOpen] = useSelectionState(false);
      return (
        <button type="button" onClick={() => setOpen(!open)}>
          {open ? "open" : "closed"}
        </button>
      );
    }
    render(
      <PropertySelectionContext.Provider value={source}>
        <Probe />
      </PropertySelectionContext.Provider>,
    );
    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(button.textContent).toBe("open");
    act(() => select("node-b"));
    expect(button.textContent).toBe("closed");
    act(() => select("node-a"));
    expect(button.textContent).toBe("closed");
    fireEvent.click(button);
    expect(button.textContent).toBe("open");
  });

  it("useSelectionState: without a selection provider it is plain state", () => {
    function Probe() {
      const [open, setOpen] = useSelectionState(false);
      return (
        <button type="button" onClick={() => setOpen(!open)}>
          {open ? "open" : "closed"}
        </button>
      );
    }
    render(<Probe />);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(button.textContent).toBe("open");
  });
});

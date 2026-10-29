// @vitest-environment jsdom
/**
 * A field removed while focused keeps its edit (2026-10-29, API editor: typing in a field and then
 * pressing another tab dropped the text). The tab switch removes the field inside React's commit;
 * the browser fires the blur from that removal while React's event system is off for the commit
 * (`_enabled = false` → `dispatchEvent` returns), so `onBlur` never runs. The field commits on
 * unmount instead — only when it was being edited, and with the same selection guard as a blur.
 */
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PropertyInput } from "./PropertyInput";
import {
  PropertySelectionContext,
  type PropertySelectionSource,
} from "./propertySelection";

afterEach(cleanup);

function Host({
  onChange,
  expose,
}: {
  onChange: (value: string) => void;
  expose: (hide: () => void) => void;
}) {
  const [shown, setShown] = useState(true);
  expose(() => setShown(false));
  return shown ? (
    <PropertyInput label="Path" value="next" onChange={onChange} />
  ) : null;
}

function mount(onChange: (value: string) => void) {
  let hide = () => {};
  const view = render(
    <Host onChange={onChange} expose={(fn) => (hide = fn)} />,
  );
  return { input: view.container.querySelector("input")!, hide: () => hide() };
}

describe("PropertyInput — removed while editing", () => {
  it("commits the typed value when it unmounts focused (the blur never reaches React)", () => {
    const onChange = vi.fn();
    const { input, hide } = mount(onChange);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "meta.next" } });
    act(() => hide());
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("meta.next");
  });

  it("writes nothing when the value did not change, or the edit was already blurred", () => {
    const untouched = vi.fn();
    const a = mount(untouched);
    fireEvent.focus(a.input);
    act(() => a.hide());
    expect(untouched).not.toHaveBeenCalled();
    cleanup();

    const blurred = vi.fn();
    const b = mount(blurred);
    fireEvent.focus(b.input);
    fireEvent.change(b.input, { target: { value: "x" } });
    fireEvent.blur(b.input);
    act(() => b.hide());
    expect(blurred).toHaveBeenCalledTimes(1);
  });

  it("does not write when the selection moved on (the blur guard)", () => {
    let selected: string | null = "a";
    const selection: PropertySelectionSource = {
      useSelectedId: () => selected,
      readSelectedId: () => selected,
    };
    const onChange = vi.fn();
    let hide = () => {};
    const view = render(
      <PropertySelectionContext.Provider value={selection}>
        <Host onChange={onChange} expose={(fn) => (hide = fn)} />
      </PropertySelectionContext.Provider>,
    );
    const input = view.container.querySelector("input")!;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "for a" } });
    selected = "b";
    act(() => hide());
    expect(onChange).not.toHaveBeenCalled();
  });
});

// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { Columns2 } from "lucide-react";
import { useState } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { GridTrackField } from "./LayoutSection";

afterEach(cleanup);
beforeAll(() => {
  vi.stubGlobal("CSS", { escape: (value: string) => value });
});

function mount({ auto = false, initial = "repeat(2, minmax(0, 1fr))" } = {}) {
  const commit = vi.fn();
  function Host() {
    const [value, setValue] = useState(initial);
    return (
      <GridTrackField
        label={auto ? "Rows" : "Columns"}
        icon={Columns2}
        value={value}
        auto={auto}
        onCommit={(next, removed) => {
          commit(next, removed);
          setValue(next);
        }}
      />
    );
  }
  const view = render(<Host />);
  return { ...view, commit };
}

async function openPresets() {
  await act(async () => {});
  fireEvent.click(screen.getByRole("button"));
}

describe("GridTrackField auto-fit entry", () => {
  it("selects auto-fit, edits the minimum, and returns to a fixed count", async () => {
    const { container, commit } = mount();
    await openPresets();
    fireEvent.click(screen.getByRole("option", { name: "auto-fit" }));
    expect(commit).toHaveBeenLastCalledWith(
      "repeat(auto-fit, minmax(200px, 1fr))",
      undefined,
    );

    const input = container.querySelector("input")!;
    expect(input.value).toBe("repeat(auto-fit, minmax(200px, 1fr))");
    fireEvent.change(input, {
      target: { value: "repeat(auto-fit, minmax(240px, 1fr))" },
    });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(commit).toHaveBeenLastCalledWith(
      "repeat(auto-fit, minmax(240px, 1fr))",
      undefined,
    );

    fireEvent.change(input, { target: { value: "3" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(commit).toHaveBeenLastCalledWith(
      "repeat(3, minmax(0, 1fr))",
      undefined,
    );
    expect((screen.getByRole("combobox") as HTMLInputElement).value).toBe("3");
  });

  it("keeps sized tracks and the removed-track contract for numeric edits", () => {
    const { commit } = mount({ initial: "120px minmax(200px, 1fr) auto" });
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "2" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(commit).toHaveBeenLastCalledWith("120px minmax(200px, 1fr)", [2]);
  });

  it("keeps Rows Auto as implicit rows without an auto-fit preset", async () => {
    const { commit } = mount({ auto: true });
    await openPresets();
    expect(screen.queryByRole("option", { name: "auto-fit" })).toBeNull();
    fireEvent.click(screen.getByRole("option", { name: /auto/i }));
    expect(commit).toHaveBeenLastCalledWith("", undefined);
  });
});

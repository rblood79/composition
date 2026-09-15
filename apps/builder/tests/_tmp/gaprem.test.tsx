import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Element } from "../../src/types/core/store.types";
import { useStore } from "../../src/builder/stores";
import { LayoutSection } from "../../src/builder/panels/styles/sections/LayoutSection";

beforeEach(() => {
  vi.stubGlobal("CSS", { escape: (v: string) => v });
  useStore.setState({
    elements: [{ id: "f", type: "Frame", parent_id: null, page_id: "p", props: { style: { display: "flex", rowGap: "12px", columnGap: "12px" } } } as Element],
    elementsMap: new Map([["f", { id: "f", type: "Frame", parent_id: null, page_id: "p", props: { style: { display: "flex", rowGap: "12px", columnGap: "12px" } } } as Element]]),
    selectedElementId: "f", currentPageId: "p",
  } as never);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("gap rem", async () => {
  const updateSelectedStyle = vi.fn();
  useStore.setState({ updateSelectedStyle } as never);
  render(<LayoutSection />);
  const g = screen.getByRole("group", { name: "Gap" });
  console.log("input", (within(g).getByRole("combobox") as HTMLInputElement).value);
  within(g).getByRole("button", { name: /Unit$/ }).click();
  const lb = await screen.findByRole("listbox");
  await act(async () => { within(lb).getByRole("option", { name: "rem" }).click(); });
  console.log("calls", updateSelectedStyle.mock.calls);
});

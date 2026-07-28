// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Element } from "../../../../types/core/store.types";
import { useStore } from "../../../stores";
import { useCanonicalDocumentStore } from "../../../stores/canonical/canonicalDocumentStore";
import { useSectionCollapse } from "../hooks/useSectionCollapse";
import { TransformSection } from "./TransformSection";

function setTestElements(elements: Element[]): void {
  useStore.setState({
    elements,
    elementsMap: new Map(elements.map((element) => [element.id, element])),
    selectedElementId: "button-1",
    activeBreakpoint: "desktop",
  } as never);
}

describe("TransformSection sizing controls", () => {
  beforeEach(() => {
    vi.stubGlobal("CSS", { escape: (value: string) => value });
    useCanonicalDocumentStore.setState({
      documents: new Map(),
      currentProjectId: null,
      documentVersion: 0,
    });
    useSectionCollapse.setState({
      collapsedSections: new Set(),
      focusMode: false,
      activeFocusSection: null,
    });
    setTestElements([
      {
        id: "button-1",
        type: "Button",
        parent_id: "frame-1",
        props: { style: { width: "200px", height: "100px" } },
      } as Element,
      {
        id: "frame-1",
        type: "Frame",
        parent_id: null,
        props: { style: { display: "flex", flexDirection: "row" } },
      } as Element,
    ]);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("names the intrinsic sizing mode Hug and removes Self Align from Transform", () => {
    render(<TransformSection />);

    const hugControls = screen.getAllByRole("radio", { name: "Hug" });
    expect(hugControls).toHaveLength(2);
    expect(screen.queryByRole("radio", { name: "Fit" })).toBeNull();
    expect(screen.queryByText("Self Align")).toBeNull();
  });

  it("offers only axis-relevant viewport units by default", async () => {
    render(<TransformSection />);

    const widthGroup = screen.getByRole("group", { name: "Width" });
    const widthButton = within(widthGroup).getByRole("button");
    widthButton.click();

    const widthListbox = await screen.findByRole("listbox");
    expect(
      within(widthListbox).getByRole("option", { name: "vw" }),
    ).not.toBeNull();
    expect(
      within(widthListbox).queryByRole("option", { name: "vh" }),
    ).toBeNull();
    expect(
      within(widthListbox).queryByRole("option", { name: "fit-content" }),
    ).toBeNull();

    cleanup();
    render(<TransformSection />);

    const heightGroup = screen.getByRole("group", { name: "Height" });
    const heightButton = within(heightGroup).getByRole("button");
    heightButton.click();

    const heightListbox = await screen.findByRole("listbox");
    expect(
      within(heightListbox).getByRole("option", { name: "vh" }),
    ).not.toBeNull();
    expect(
      within(heightListbox).queryByRole("option", { name: "vw" }),
    ).toBeNull();
    expect(
      within(heightListbox).queryByRole("option", { name: "fit-content" }),
    ).toBeNull();
  });

  it("keeps unset Min/Max constraints blank instead of defaulting to zero", () => {
    setTestElements([
      {
        id: "button-1",
        type: "Button",
        parent_id: "frame-1",
        props: {
          style: {
            width: "200px",
            height: "100px",
            aspectRatio: "2 / 1",
          },
        },
      } as Element,
      {
        id: "frame-1",
        type: "Frame",
        parent_id: null,
        props: { style: { display: "flex", flexDirection: "row" } },
      } as Element,
    ]);

    render(<TransformSection />);

    for (const label of ["Min W", "Max W", "Min H", "Max H"]) {
      const input = screen.getByRole("combobox", { name: label });
      expect((input as HTMLInputElement).value).toBe("");
    }
  });

  it("omits rem from every Min/Max constraint unit menu", async () => {
    setTestElements([
      {
        id: "button-1",
        type: "Button",
        parent_id: "frame-1",
        props: {
          style: {
            width: "200px",
            height: "100px",
            aspectRatio: "2 / 1",
          },
        },
      } as Element,
      {
        id: "frame-1",
        type: "Frame",
        parent_id: null,
        props: { style: { display: "flex", flexDirection: "row" } },
      } as Element,
    ]);

    for (const label of ["Min W", "Max W", "Min H", "Max H"]) {
      render(<TransformSection />);

      const group = screen.getByRole("group", { name: label });
      within(group).getByRole("button").click();

      const listbox = await screen.findByRole("listbox");
      expect(within(listbox).queryByRole("option", { name: "rem" })).toBeNull();

      cleanup();
    }
  });
});

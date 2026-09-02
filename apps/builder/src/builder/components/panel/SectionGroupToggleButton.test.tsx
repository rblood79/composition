import React from "react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { SectionGroupToggleButton } from "./SectionGroupToggleButton";
import { useSectionCollapse } from "../../panels/styles/hooks/useSectionCollapse";

const IDS = ["comp-layout", "comp-form"] as const;

beforeEach(() => {
  cleanup();
  useSectionCollapse.setState({
    collapsedSections: new Set(),
    focusMode: false,
    activeFocusSection: null,
  });
});

describe("SectionGroupToggleButton", () => {
  it("flips between collapse and expand as the group state changes", () => {
    render(<SectionGroupToggleButton sectionIds={IDS} />);

    const button = screen.getByRole("button", { name: "Collapse all sections" });
    expect(button.getAttribute("data-section-group-collapsed")).toBe("false");

    fireEvent.click(button);

    expect(useSectionCollapse.getState().collapsedSections).toEqual(
      new Set(IDS),
    );
    const expandButton = screen.getByRole("button", {
      name: "Expand all sections",
    });
    expect(expandButton.getAttribute("data-section-group-collapsed")).toBe(
      "true",
    );

    fireEvent.click(expandButton);

    expect(useSectionCollapse.getState().collapsedSections.size).toBe(0);
    expect(
      screen.getByRole("button", { name: "Collapse all sections" }),
    ).toBeTruthy();
  });

  it("reflects a group collapsed from elsewhere (section chevrons) without a click", () => {
    render(<SectionGroupToggleButton sectionIds={IDS} />);

    act(() => {
      for (const id of IDS) useSectionCollapse.getState().toggleSection(id);
    });

    expect(
      screen.getByRole("button", { name: "Expand all sections" }),
    ).toBeTruthy();
  });

  it("does not touch sections outside its group", () => {
    useSectionCollapse.setState({
      collapsedSections: new Set(["history-edits"]),
    });
    render(<SectionGroupToggleButton sectionIds={IDS} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Collapse all sections" }),
    );

    expect(useSectionCollapse.getState().collapsedSections).toEqual(
      new Set([...IDS, "history-edits"]),
    );
  });
});

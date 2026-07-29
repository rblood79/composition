// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Element } from "../../../../types/core/store.types";
import { useStore } from "../../../stores";
import { useCanonicalDocumentStore } from "../../../stores/canonical/canonicalDocumentStore";
import { useSectionCollapse } from "../hooks/useSectionCollapse";
import { TransformSection } from "./TransformSection";

const getSceneBoundsMock = vi.hoisted(() => vi.fn());

vi.mock("../../../workspace/canvas/skia/renderCommands", () => ({
  getSceneBounds: getSceneBoundsMock,
}));

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
    getSceneBoundsMock.mockReset();
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

  it("offers only axis-relevant offset units without reset actions", async () => {
    setTestElements([
      {
        id: "button-1",
        type: "Button",
        parent_id: "frame-1",
        props: {
          style: {
            position: "absolute",
            left: "24px",
            top: "12px",
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

    const leftGroup = screen.getByRole("group", { name: "Left" });
    within(leftGroup).getByRole("button").click();

    const leftListbox = await screen.findByRole("listbox");
    expect(
      within(leftListbox).getByRole("option", { name: "vw" }),
    ).not.toBeNull();
    expect(
      within(leftListbox).queryByRole("option", { name: "vh" }),
    ).toBeNull();
    expect(
      within(leftListbox).queryByRole("option", { name: "reset" }),
    ).toBeNull();

    cleanup();
    render(<TransformSection />);

    const topGroup = screen.getByRole("group", { name: "Top" });
    within(topGroup).getByRole("button").click();

    const topListbox = await screen.findByRole("listbox");
    expect(
      within(topListbox).getByRole("option", { name: "vh" }),
    ).not.toBeNull();
    expect(within(topListbox).queryByRole("option", { name: "vw" })).toBeNull();
    expect(
      within(topListbox).queryByRole("option", { name: "reset" }),
    ).toBeNull();
  });

  it("disables offset editing outside absolute mode without exposing stored coordinates", () => {
    setTestElements([
      {
        id: "button-1",
        type: "Button",
        parent_id: "frame-1",
        props: {
          style: {
            left: "24px",
            top: "12px",
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

    const left = screen.getByRole("combobox", { name: "Left" });
    const top = screen.getByRole("combobox", { name: "Top" });
    expect((left as HTMLInputElement).disabled).toBe(true);
    expect((top as HTMLInputElement).disabled).toBe(true);
    expect((left as HTMLInputElement).value).toBe("auto");
    expect((top as HTMLInputElement).value).toBe("auto");
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

  it("preserves a flex child's visual position when enabling absolute positioning", () => {
    const updateSelectedStyle = vi.fn();
    const updateSelectedStyles = vi.fn();
    getSceneBoundsMock.mockImplementation((id: string) => {
      if (id === "button-1") {
        return { x: 160, y: 95, width: 200, height: 100 };
      }
      if (id === "frame-1") {
        return { x: 100, y: 50, width: 600, height: 400 };
      }
      return undefined;
    });
    useStore.setState({ updateSelectedStyle, updateSelectedStyles } as never);

    render(<TransformSection />);

    const toggle = screen.getByRole("button", {
      name: "Absolute position",
    });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");

    toggle.click();

    expect(updateSelectedStyles).toHaveBeenCalledWith({
      position: "absolute",
      left: "60px",
      top: "45px",
    });
    expect(updateSelectedStyle).not.toHaveBeenCalledWith(
      "position",
      "absolute",
    );
  });

  it("uses the flex parent's content origin when enabling absolute positioning", () => {
    const updateSelectedStyle = vi.fn();
    const updateSelectedStyles = vi.fn();
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
        props: {
          style: {
            display: "flex",
            padding: "12px 20px",
            borderWidth: "2px",
          },
        },
      } as Element,
    ]);
    getSceneBoundsMock.mockImplementation((id: string) => {
      if (id === "button-1") {
        return { x: 160, y: 95, width: 200, height: 100 };
      }
      if (id === "frame-1") {
        return { x: 100, y: 50, width: 600, height: 400 };
      }
      return undefined;
    });
    useStore.setState({ updateSelectedStyle, updateSelectedStyles } as never);

    render(<TransformSection />);

    screen.getByRole("button", { name: "Absolute position" }).click();

    expect(updateSelectedStyles).toHaveBeenCalledWith({
      position: "absolute",
      left: "38px",
      top: "31px",
    });
    expect(updateSelectedStyle).not.toHaveBeenCalledWith(
      "position",
      "absolute",
    );
  });

  it("falls back to position-only activation when flex bounds are unavailable", () => {
    const updateSelectedStyle = vi.fn();
    const updateSelectedStyles = vi.fn();
    useStore.setState({ updateSelectedStyle, updateSelectedStyles } as never);

    render(<TransformSection />);

    screen.getByRole("button", { name: "Absolute position" }).click();

    expect(updateSelectedStyle).toHaveBeenCalledWith("position", "absolute");
    expect(updateSelectedStyles).not.toHaveBeenCalled();
  });

  it("keeps non-flex activation on the position-only path", () => {
    const updateSelectedStyle = vi.fn();
    const updateSelectedStyles = vi.fn();
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
        props: { style: { display: "block" } },
      } as Element,
    ]);
    useStore.setState({ updateSelectedStyle, updateSelectedStyles } as never);

    render(<TransformSection />);

    screen.getByRole("button", { name: "Absolute position" }).click();

    expect(updateSelectedStyle).toHaveBeenCalledWith("position", "absolute");
    expect(updateSelectedStyles).not.toHaveBeenCalled();
  });

  it("disables absolute positioning without clearing offsets", () => {
    const updateSelectedStyle = vi.fn();
    setTestElements([
      {
        id: "button-1",
        type: "Button",
        parent_id: "frame-1",
        props: {
          style: {
            width: "200px",
            height: "100px",
            position: "absolute",
            left: "24px",
            top: "12px",
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
    useStore.setState({ updateSelectedStyle } as never);

    render(<TransformSection />);

    const toggle = screen.getByRole("button", {
      name: "Absolute position",
    });
    expect(toggle.getAttribute("aria-pressed")).toBe("true");

    toggle.click();

    expect(updateSelectedStyle).toHaveBeenCalledWith("position", "");
    expect(updateSelectedStyle).not.toHaveBeenCalledWith("left", "");
    expect(updateSelectedStyle).not.toHaveBeenCalledWith("top", "");
  });
});

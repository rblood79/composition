// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Element } from "../../../../types/core/store.types";
import { useStore } from "../../../stores";
import { historyManager } from "../../../stores/history";
import {
  resetPanelFixture,
  seedPanelElements,
} from "../hooks/__tests__/panelFixture";
import { useSectionCollapse } from "../hooks/useSectionCollapse";
import {
  beginPagePositionPresentation,
  cancelPagePositionPresentation,
  publishPagePositionPresentation,
  resetPagePositionPresentation,
} from "../../../workspace/canvas/interaction/pagePositionPresentation";
import { TransformSection } from "./TransformSection";

const getSceneBoundsMock = vi.hoisted(() => vi.fn());

vi.mock("../../../workspace/canvas/skia/renderCommands", () => ({
  getSceneBounds: getSceneBoundsMock,
}));

function setTestElements(elements: Element[]): void {
  seedPanelElements(elements);
  useStore.setState({
    selectedElementId: "button-1",
    activeBreakpoint: "desktop",
  } as never);
}

describe("TransformSection sizing controls", () => {
  beforeEach(() => {
    getSceneBoundsMock.mockReset();
    vi.stubGlobal("CSS", { escape: (value: string) => value });
    resetPanelFixture();
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
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    act(() => {
      resetPagePositionPresentation();
    });
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

    // Min W: Button 은 catalog sizes.minWidth(Spectrum 2.25×height 하한, md=68) 가
    //   spec default 로 표시된다 (ADR-082 A2 — inline 없으면 specPreset fallback,
    //   sizes[size] generic 매핑). 미설정 constraint 의 "0" 오표시 방지 의도는
    //   나머지 3필드 blank 로 유지.
    const minW = screen.getByRole("combobox", { name: "Min W" });
    expect((minW as HTMLInputElement).value).toBe("68");
    for (const label of ["Max W", "Min H", "Max H"]) {
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
    const moveElementToSiblingEdge = vi.fn(() => true);
    const transactionSpy = vi.spyOn(historyManager, "runInTransaction");
    getSceneBoundsMock.mockImplementation((id: string) => {
      if (id === "button-1") {
        return { x: 160, y: 95, width: 200, height: 100 };
      }
      if (id === "frame-1") {
        return { x: 100, y: 50, width: 600, height: 400 };
      }
      return undefined;
    });
    useStore.setState({
      updateSelectedStyle,
      updateSelectedStyles,
      moveElementToSiblingEdge,
    } as never);

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
    expect(moveElementToSiblingEdge).toHaveBeenCalledWith("button-1", "front");
    expect(transactionSpy).toHaveBeenCalledWith(
      { type: "batch", elementId: "button-1" },
      expect.any(Function),
    );
    expect(updateSelectedStyles.mock.invocationCallOrder[0]).toBeLessThan(
      moveElementToSiblingEdge.mock.invocationCallOrder[0],
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
    const moveElementToSiblingEdge = vi.fn(() => true);
    useStore.setState({
      updateSelectedStyle,
      updateSelectedStyles,
      moveElementToSiblingEdge,
    } as never);

    render(<TransformSection />);

    screen.getByRole("button", { name: "Absolute position" }).click();

    expect(updateSelectedStyles).toHaveBeenCalledWith({
      position: "absolute",
    });
    expect(updateSelectedStyle).not.toHaveBeenCalledWith(
      "position",
      "absolute",
    );
    expect(moveElementToSiblingEdge).toHaveBeenCalledWith("button-1", "front");
  });

  it("keeps non-flex activation on the position-only path", () => {
    const updateSelectedStyle = vi.fn();
    const updateSelectedStyles = vi.fn();
    const moveElementToSiblingEdge = vi.fn(() => true);
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
    useStore.setState({
      updateSelectedStyle,
      updateSelectedStyles,
      moveElementToSiblingEdge,
    } as never);

    render(<TransformSection />);

    screen.getByRole("button", { name: "Absolute position" }).click();

    expect(updateSelectedStyles).toHaveBeenCalledWith({
      position: "absolute",
    });
    expect(updateSelectedStyle).not.toHaveBeenCalledWith(
      "position",
      "absolute",
    );
    expect(moveElementToSiblingEdge).toHaveBeenCalledWith("button-1", "front");
  });

  it("disables absolute positioning without clearing offsets", () => {
    const updateSelectedStyle = vi.fn();
    const moveElementToSiblingEdge = vi.fn(() => true);
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
    useStore.setState({
      updateSelectedStyle,
      moveElementToSiblingEdge,
    } as never);

    render(<TransformSection />);

    const toggle = screen.getByRole("button", {
      name: "Absolute position",
    });
    expect(toggle.getAttribute("aria-pressed")).toBe("true");

    toggle.click();

    expect(updateSelectedStyle).toHaveBeenCalledWith("position", "");
    expect(updateSelectedStyle).not.toHaveBeenCalledWith("left", "");
    expect(updateSelectedStyle).not.toHaveBeenCalledWith("top", "");
    expect(moveElementToSiblingEdge).not.toHaveBeenCalled();
  });

  // ADR-177 적응형 통합 — body 선택 시 position row 는 pagePositions 를 편집
  it("shows page X/Y for a real page body and commits via updatePagePosition", () => {
    const updatePagePosition = vi.fn();
    setTestElements([
      {
        id: "body-1",
        type: "body",
        parent_id: null,
        page_id: "page-1",
        props: { style: {} },
      } as never,
    ]);
    useStore.setState({
      selectedElementId: "body-1",
      currentPageId: "page-1",
      pagePositions: { "page-1": { x: 120, y: 40 } },
      updatePagePosition,
    } as never);

    render(<TransformSection />);

    // Left/Top + Absolute 토글은 부재, X/Y 가 페이지 위치를 표시
    expect(screen.queryByRole("combobox", { name: "Left" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Absolute position" }),
    ).toBeNull();
    const xInput = screen.getByRole("combobox", { name: "X" });
    const yInput = screen.getByRole("combobox", { name: "Y" });
    expect((xInput as HTMLInputElement).value).toBe("120");
    expect((yInput as HTMLInputElement).value).toBe("40");

    fireEvent.change(xInput, { target: { value: "300" } });
    fireEvent.blur(xInput);
    expect(updatePagePosition).toHaveBeenCalledWith("page-1", 300, 40);
  });

  it("updates page X/Y live from the transient drag channel", async () => {
    setTestElements([
      {
        id: "body-1",
        type: "body",
        parent_id: null,
        page_id: "page-1",
        props: { style: {} },
      } as never,
    ]);
    useStore.setState({
      selectedElementId: "body-1",
      currentPageId: "page-1",
      pagePositions: { "page-1": { x: 120, y: 40 } },
    } as never);

    render(<TransformSection />);
    const readX = () =>
      (screen.getByRole("combobox", { name: "X" }) as HTMLInputElement).value;
    expect(readX()).toBe("120");

    // 드래그 프레임 publish → store 무경유로 표시값 실시간 반영
    // (async act — PropertyUnitInput 의 value 동기화가 queueMicrotask 경유)
    await act(async () => {
      beginPagePositionPresentation(
        { "page-1": { x: 120, y: 40 } },
        ["page-1"],
        "desktop",
      );
      publishPagePositionPresentation([
        { pageId: "page-1", position: { x: 300.4, y: 40 } },
      ]);
    });
    expect(readX()).toBe("300");

    // 취소 → committed store 값으로 복귀
    await act(async () => {
      cancelPagePositionPresentation();
    });
    expect(readX()).toBe("120");
  });

  it("hides the position row for projection/frame bodies without page_id", () => {
    setTestElements([
      {
        id: "body-2",
        type: "body",
        parent_id: null,
        props: { style: {} },
      } as Element,
    ]);
    useStore.setState({
      selectedElementId: "body-2",
      currentPageId: "page-1",
      pagePositions: {},
    } as never);

    render(<TransformSection />);

    expect(screen.queryByRole("combobox", { name: "X" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Left" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Absolute position" }),
    ).toBeNull();
  });
});

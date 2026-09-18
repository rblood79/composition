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
} from "../../../__tests__/panelFixture";
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

  it("folds Fit and Fill into the W/H size-mode menu (no size-mode toggle row) and commits Fill as a sizing edit (ADR-224)", async () => {
    const applySizingFromSelection = vi.fn();
    useStore.setState({ applySizingFromSelection } as never);
    render(<TransformSection />);

    expect(screen.queryByRole("radio", { name: "Hug" })).toBeNull();
    expect(screen.queryByRole("radio", { name: "Fill" })).toBeNull();
    expect(screen.queryByText("Self Align")).toBeNull();

    const widthGroup = screen.getByRole("group", { name: "Width" });
    within(widthGroup)
      .getByRole("button", { name: /Size mode$/ })
      .click();
    const listbox = await screen.findByRole("listbox");
    within(listbox).getByRole("option", { name: "Fit content" });
    const fillOption = within(listbox).getByRole("option", { name: "Fill" });
    await act(async () => {
      fillOption.click();
    });

    // ADR-224: Fill 은 CSS grow 가 아니라 축별 sizing 의도 (factor 1 기본) 로 한 번에 적용된다.
    expect(applySizingFromSelection).toHaveBeenCalledWith(
      expect.objectContaining({ selectedElementId: "button-1" }),
      { axis: "width", mode: "fill" },
    );
  });

  it("shows fill in the W field while the element fills the flex main axis", () => {
    setTestElements([
      {
        id: "button-1",
        type: "Button",
        parent_id: "frame-1",
        props: { style: { flexGrow: "1", flexBasis: "0%", height: "100px" } },
      } as Element,
      {
        id: "frame-1",
        type: "Frame",
        parent_id: null,
        props: { style: { display: "flex", flexDirection: "row" } },
      } as Element,
    ]);
    render(<TransformSection />);
    const widthGroup = screen.getByRole("group", { name: "Width" });
    // legend 모드 (Gap 과 같은 어법): legend 「Width」 가 상자 위, 트리거는 크기 방식 「Fill」 (legacy CSS grow 판독)
    expect(widthGroup.querySelector("legend")?.textContent).toBe("Width");
    expect(
      within(widthGroup).getByRole("button", { name: /Size mode$/ })
        .textContent,
    ).toBe("Fill");
    const heightGroup = screen.getByRole("group", { name: "Height" });
    expect(
      within(heightGroup).getByRole("button", { name: /Size mode$/ })
        .textContent,
    ).toBe("px");
  });

  it("offers only axis-relevant viewport units by default", async () => {
    render(<TransformSection />);

    const widthGroup = screen.getByRole("group", { name: "Width" });
    const widthButton = within(widthGroup).getByRole("button", {
      name: /Size mode$/,
    });
    widthButton.click();

    const widthListbox = await screen.findByRole("listbox");
    expect(
      within(widthListbox).getByRole("option", { name: "Viewport (vw)" }),
    ).not.toBeNull();
    expect(
      within(widthListbox).queryByRole("option", { name: "Viewport (vh)" }),
    ).toBeNull();

    cleanup();
    render(<TransformSection />);

    const heightGroup = screen.getByRole("group", { name: "Height" });
    const heightButton = within(heightGroup).getByRole("button", {
      name: /Size mode$/,
    });
    heightButton.click();

    const heightListbox = await screen.findByRole("listbox");
    expect(
      within(heightListbox).getByRole("option", { name: "Viewport (vh)" }),
    ).not.toBeNull();
    expect(
      within(heightListbox).queryByRole("option", { name: "Viewport (vw)" }),
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
    within(leftGroup).getByRole("button", { name: /Unit$/ }).click();

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
    within(topGroup).getByRole("button", { name: /Unit$/ }).click();

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
    // suffix 모드의 키워드 값은 포커스 전 placeholder (muted) 로 보인다 (panel-ui 03)
    expect((left as HTMLInputElement).value).toBe("");
    expect((left as HTMLInputElement).placeholder).toBe("auto");
    expect((top as HTMLInputElement).placeholder).toBe("auto");
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
    // Min/Max 는 펼침 토글 뒤에 (인라인 값 없음 → 접힘, 2026-09-15)
    expect(screen.queryByRole("combobox", { name: "Min W" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Size constraints" }));

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
      fireEvent.click(screen.getByRole("button", { name: "Size constraints" }));

      const group = screen.getByRole("group", { name: label });
      within(group).getByRole("button", { name: /Unit$/ }).click();

      const listbox = await screen.findByRole("listbox");
      expect(within(listbox).queryByRole("option", { name: "rem" })).toBeNull();

      cleanup();
    }
  });

  // ADR-224 §6.1 — Absolute 활성화는 store 복합 명령 `applyAbsoluteFromSelection` 하나로 간다
  // (position/inset + 무효 Fill 의 used px Fixed + 형제 맨 앞, 한 transaction). 패널은 scene
  // bounds 로 position/left/top 만 계산해 넘긴다.
  it("preserves a flex child's visual position when enabling absolute positioning", () => {
    const updateSelectedStyle = vi.fn();
    const applyAbsoluteFromSelection = vi.fn(() => null);
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
      applyAbsoluteFromSelection,
    } as never);

    render(<TransformSection />);

    const toggle = screen.getByRole("button", {
      name: "Absolute position",
    });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");

    toggle.click();

    expect(applyAbsoluteFromSelection).toHaveBeenCalledWith(
      expect.objectContaining({ selectedElementId: "button-1" }),
      expect.any(Function),
    );
    // 요소마다 자기 부모·scene bounds 로 inset (다중 선택에서 리더 inset 을 전부에 쓰지 않는다)
    const stylesFor = (
      applyAbsoluteFromSelection.mock.calls as unknown as [
        unknown,
        (id: string) => Record<string, string>,
      ][]
    )[0][1];
    expect(stylesFor("button-1")).toEqual({
      position: "absolute",
      left: "60px",
      top: "45px",
    });
    expect(updateSelectedStyle).not.toHaveBeenCalledWith(
      "position",
      "absolute",
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the command error when the store rejects the activation", () => {
    const applyAbsoluteFromSelection = vi.fn(() => "geometry-missing" as const);
    useStore.setState({ applyAbsoluteFromSelection } as never);

    render(<TransformSection />);
    act(() => {
      screen.getByRole("button", { name: "Absolute position" }).click();
    });

    expect(screen.getByRole("alert").textContent).toContain(
      "Size not measured yet",
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
    const applyAbsoluteFromSelection = vi.fn(() => null);
    useStore.setState({
      updateSelectedStyle,
      applyAbsoluteFromSelection,
    } as never);

    render(<TransformSection />);

    screen.getByRole("button", { name: "Absolute position" }).click();

    expect(
      (
        applyAbsoluteFromSelection.mock.calls as unknown as [
          unknown,
          (id: string) => Record<string, string>,
        ][]
      )[0][1]("button-1"),
    ).toEqual({ position: "absolute", left: "38px", top: "31px" });
    expect(updateSelectedStyle).not.toHaveBeenCalledWith(
      "position",
      "absolute",
    );
  });

  it("falls back to position-only activation when flex bounds are unavailable", () => {
    const updateSelectedStyle = vi.fn();
    const applyAbsoluteFromSelection = vi.fn(() => null);
    useStore.setState({
      updateSelectedStyle,
      applyAbsoluteFromSelection,
    } as never);

    render(<TransformSection />);

    screen.getByRole("button", { name: "Absolute position" }).click();

    expect(
      (
        applyAbsoluteFromSelection.mock.calls as unknown as [
          unknown,
          (id: string) => Record<string, string>,
        ][]
      )[0][1]("button-1"),
    ).toEqual({ position: "absolute" });
    expect(updateSelectedStyle).not.toHaveBeenCalledWith(
      "position",
      "absolute",
    );
  });

  it("keeps non-flex activation on the position-only path", () => {
    const updateSelectedStyle = vi.fn();
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
    const applyAbsoluteFromSelection = vi.fn(() => null);
    useStore.setState({
      updateSelectedStyle,
      applyAbsoluteFromSelection,
    } as never);

    render(<TransformSection />);

    screen.getByRole("button", { name: "Absolute position" }).click();

    expect(
      (
        applyAbsoluteFromSelection.mock.calls as unknown as [
          unknown,
          (id: string) => Record<string, string>,
        ][]
      )[0][1]("button-1"),
    ).toEqual({ position: "absolute" });
    expect(updateSelectedStyle).not.toHaveBeenCalledWith(
      "position",
      "absolute",
    );
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

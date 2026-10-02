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
import {
  fromElements,
  openStylesFixture,
  type StylesFixture,
} from "../__tests__/support/catalogStylesFixture";
import { useSectionCollapse } from "../hooks/useSectionCollapse";
import { TransformSection } from "./TransformSection";

/**
 * ADR-248 4e-9 C: the Transform section over the catalog Styles host — the old store's sizing ·
 * absolute · style actions are the host's (`applySizing` · `applyAbsolute` · `updateStyle`).
 * Absolute activation geometry (`phase4ePosition`) and page X/Y (`phase4eStylesPagePosition`) are
 * covered over the catalog workspace; their old-canvas cases went with the old store.
 */
let fixture: StylesFixture;

async function setTestElements(elements: Element[]): Promise<void> {
  fixture = await openStylesFixture(fromElements(elements), {
    select: "button-1",
  });
}

function renderSection() {
  return render(<TransformSection />, { wrapper: fixture.wrapper });
}

describe("TransformSection sizing controls", () => {
  beforeEach(async () => {
    vi.stubGlobal("CSS", { escape: (value: string) => value });
    useSectionCollapse.setState({
      collapsedSections: new Set(),
      focusMode: false,
      activeFocusSection: null,
    });
    await setTestElements([
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
  });

  it("folds Fit and Fill into the W/H size-mode menu (no size-mode toggle row) and commits Fill as a sizing edit (ADR-224)", async () => {
    const applySizing = vi.spyOn(fixture.host, "applySizing");
    renderSection();

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
    expect(applySizing).toHaveBeenCalledWith(fixture.recordOf("button-1"), {
      axis: "width",
      mode: "fill",
    });
  });

  it("선택 상태의 suffix는 Fill=fr, Fixed=px, Fit content=fit으로 구분한다", async () => {
    await setTestElements([
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
    renderSection();
    const widthGroup = screen.getByRole("group", { name: "Width" });
    // legend 모드 (Gap 과 같은 어법): legend 「Width」 가 상자 위, 선택 뒤 트리거는 실제 단위 「fr」.
    expect(widthGroup.querySelector("legend")?.textContent).toBe("Width");
    expect(
      within(widthGroup).getByRole("button", { name: /Size mode$/ })
        .textContent,
    ).toBe("fr");
    const heightGroup = screen.getByRole("group", { name: "Height" });
    expect(
      within(heightGroup).getByRole("button", { name: /Size mode$/ })
        .textContent,
    ).toBe("px");

    cleanup();
    await setTestElements([
      {
        id: "button-1",
        type: "Button",
        parent_id: "frame-1",
        props: {
          style: { width: "fit-content", height: "fit-content" },
        },
      } as Element,
      {
        id: "frame-1",
        type: "Frame",
        parent_id: null,
        props: { style: { display: "flex", flexDirection: "row" } },
      } as Element,
    ]);
    renderSection();
    expect(
      within(screen.getByRole("group", { name: "Width" })).getByRole("button", {
        name: /Size mode$/,
      }).textContent,
    ).toBe("fit");
    expect(
      within(screen.getByRole("group", { name: "Height" })).getByRole(
        "button",
        {
          name: /Size mode$/,
        },
      ).textContent,
    ).toBe("fit");
  });

  it("메뉴는 관계 이름만, 선택 상태는 축별 실제 단위를 표시한다", async () => {
    renderSection();

    const widthGroup = screen.getByRole("group", { name: "Width" });
    const widthButton = within(widthGroup).getByRole("button", {
      name: /Size mode$/,
    });
    widthButton.click();

    const widthListbox = await screen.findByRole("listbox");
    expect(
      within(widthListbox).getByRole("option", { name: "Parent" }),
    ).not.toBeNull();
    expect(
      within(widthListbox).getByRole("option", {
        name: "Viewport",
      }),
    ).not.toBeNull();

    cleanup();
    await setTestElements([
      {
        id: "button-1",
        type: "Button",
        parent_id: "frame-1",
        props: { style: { width: "50%", height: "100vh" } },
      } as Element,
      {
        id: "frame-1",
        type: "Frame",
        parent_id: null,
        props: { style: { display: "flex", flexDirection: "row" } },
      } as Element,
    ]);
    renderSection();

    expect(
      within(screen.getByRole("group", { name: "Width" })).getByRole("button", {
        name: /Size mode$/,
      }).textContent,
    ).toBe("%");

    const heightGroup = screen.getByRole("group", { name: "Height" });
    expect(
      within(heightGroup).getByRole("button", { name: /Size mode$/ })
        .textContent,
    ).toBe("vh");
    const heightButton = within(heightGroup).getByRole("button", {
      name: /Size mode$/,
    });
    heightButton.click();

    const heightListbox = await screen.findByRole("listbox");
    expect(
      within(heightListbox).getByRole("option", { name: "Viewport" }),
    ).not.toBeNull();
  });

  it("offers only axis-relevant offset units without reset actions", async () => {
    await setTestElements([
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

    renderSection();

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
    renderSection();

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

  it("disables offset editing outside absolute mode without exposing stored coordinates", async () => {
    await setTestElements([
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

    renderSection();

    const left = screen.getByRole("combobox", { name: "Left" });
    const top = screen.getByRole("combobox", { name: "Top" });
    expect((left as HTMLInputElement).disabled).toBe(true);
    expect((top as HTMLInputElement).disabled).toBe(true);
    // suffix 모드의 키워드 값은 포커스 전 placeholder (muted) 로 보인다 (panel-ui 03)
    expect((left as HTMLInputElement).value).toBe("");
    expect((left as HTMLInputElement).placeholder).toBe("auto");
    expect((top as HTMLInputElement).placeholder).toBe("auto");
  });

  it("keeps unset Min/Max constraints blank instead of defaulting to zero", async () => {
    await setTestElements([
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

    renderSection();
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
    await setTestElements([
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
      renderSection();
      fireEvent.click(screen.getByRole("button", { name: "Size constraints" }));

      const group = screen.getByRole("group", { name: label });
      within(group).getByRole("button", { name: /Unit$/ }).click();

      const listbox = await screen.findByRole("listbox");
      expect(within(listbox).queryByRole("option", { name: "rem" })).toBeNull();

      cleanup();
    }
  });

  it("blocks a same-unit max below min and commits the next valid value", async () => {
    await setTestElements([
      {
        id: "button-1",
        type: "Button",
        parent_id: "frame-1",
        props: {
          style: { width: "300px", height: "100px" },
        },
      } as Element,
      {
        id: "frame-1",
        type: "Frame",
        parent_id: null,
        props: { style: { display: "flex", flexDirection: "row" } },
      } as Element,
    ]);
    const updateSelectedStyle = vi.spyOn(fixture.host, "updateStyle");

    renderSection();
    fireEvent.click(screen.getByRole("button", { name: "Size constraints" }));
    const minW = screen.getByRole("combobox", { name: "Min W" });
    const maxW = screen.getByRole("combobox", { name: "Max W" });
    fireEvent.change(minW, { target: { value: "200" } });
    fireEvent.keyDown(minW, { key: "Enter" });
    fireEvent.change(maxW, { target: { value: "100" } });
    fireEvent.keyDown(maxW, { key: "Enter" });

    expect(updateSelectedStyle).not.toHaveBeenCalledWith("maxWidth", "100px");
    expect(screen.getByRole("alert").textContent).toMatch(
      /Minimum size cannot exceed maximum size/i,
    );

    fireEvent.change(maxW, { target: { value: "300" } });
    fireEvent.keyDown(maxW, { key: "Enter" });

    expect(updateSelectedStyle).toHaveBeenCalledWith("maxWidth", "300px");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the command error when the store rejects the activation", async () => {
    vi.spyOn(fixture.host, "applyAbsolute").mockReturnValue("geometry-missing");

    renderSection();
    act(() => {
      screen.getByRole("button", { name: "Absolute position" }).click();
    });

    expect(screen.getByRole("alert").textContent).toContain(
      "Size not measured yet",
    );
  });

  it("disables absolute positioning without clearing offsets", async () => {
    await setTestElements([
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
    const applyAbsolute = vi.spyOn(fixture.host, "applyAbsolute");
    const offsets = () => {
      const { left, top } = fixture.host.readSelectedTarget().style;
      return { left, top };
    };
    expect(offsets()).toEqual({ left: "24px", top: "12px" });

    renderSection();

    const toggle = screen.getByRole("button", {
      name: "Absolute position",
    });
    expect(toggle.getAttribute("aria-pressed")).toBe("true");

    act(() => {
      toggle.click();
    });

    expect(applyAbsolute).toHaveBeenCalledWith(
      fixture.recordOf("button-1"),
      false,
    );
    expect(offsets()).toEqual({ left: "24px", top: "12px" });
  });
});

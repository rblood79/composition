// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Element } from "../../../../types/core/store.types";
import {
  fromElements,
  openStylesFixture,
  type StylesFixture,
} from "../__tests__/support/catalogStylesFixture";
import { useSectionCollapse } from "../../../components/panel/useSectionCollapse";
import { LayoutSection } from "./LayoutSection";

// jsdom has no Web Animations (the Layout toggle groups' selection indicator asks for them).
(Element.prototype as { getAnimations?: () => Animation[] }).getAnimations ??=
  () => [];

/**
 * ADR-275 사용자 결정 10 (2026-10-20) — Padding 은 Layout 절 안, Figma 구성: 「가로 · 세로 · 펼침」,
 * 펼치면 「Left · Top」 / 「Right · Bottom」. margin 편집 UI 는 없다.
 */
let fixture: StylesFixture;

async function open(padding: Record<string, string>) {
  vi.stubGlobal("CSS", { escape: (value: string) => value });
  useSectionCollapse.setState({
    collapsedSections: new Set(),
    focusMode: false,
    activeFocusSection: null,
  });
  fixture = await openStylesFixture(
    fromElements([
      {
        id: "box-1",
        type: "Frame",
        parent_id: null,
        props: { style: { display: "flex", ...padding } },
      } as Element,
    ]),
    { select: "box-1" },
  );
  render(<LayoutSection />, { wrapper: fixture.wrapper });
  await act(() => Promise.resolve());
}

const inputOf = (name: string) =>
  screen
    .getByRole("group", { name })
    .querySelector("input") as HTMLInputElement;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Layout padding fields (Figma)", () => {
  const symmetric = {
    paddingTop: "8px",
    paddingBottom: "8px",
    paddingLeft: "12px",
    paddingRight: "12px",
  };

  it("shows horizontal · vertical and writes both sides of the axis in one edit", async () => {
    await open(symmetric);
    const updateStyles = vi.spyOn(fixture.host, "updateStyles");

    expect(inputOf("Horizontal padding").value).toBe("12");
    expect(inputOf("Vertical padding").value).toBe("8");
    expect(screen.queryByRole("group", { name: "Margin" })).toBeNull();
    // 줄 전체의 legend 「Padding」 (fieldset 이 접근 이름을 준다)
    expect(
      screen
        .getByRole("group", { name: "Padding" })
        .querySelector(":scope > legend")?.textContent,
    ).toBe("Padding");

    const horizontal = inputOf("Horizontal padding");
    fireEvent.focus(horizontal);
    fireEvent.change(horizontal, { target: { value: "20" } });
    fireEvent.keyDown(horizontal, { key: "Enter" });
    expect(updateStyles).toHaveBeenCalledWith({
      paddingLeft: "20px",
      paddingRight: "20px",
    });
  });

  it("opens per side when the sides differ, and an axis of unequal sides reads Mixed", async () => {
    await open({ ...symmetric, paddingTop: "4px" });

    expect(inputOf("Left padding").value).toBe("12");
    expect(inputOf("Top padding").value).toBe("4");
    expect(inputOf("Bottom padding").value).toBe("8");

    fireEvent.click(screen.getByRole("button", { name: "Padding per side" }));
    expect(inputOf("Vertical padding").value).toBe("");
    expect(inputOf("Vertical padding").placeholder).toBe("Mixed");
  });

  it("a focus and blur without a change writes nothing", async () => {
    await open(symmetric);
    const revision = fixture.graph.revision;
    for (const name of ["Horizontal padding", "Vertical padding"]) {
      const input = inputOf(name);
      fireEvent.focus(input);
      fireEvent.blur(input);
    }
    expect(fixture.graph.revision).toBe(revision);
  });
});

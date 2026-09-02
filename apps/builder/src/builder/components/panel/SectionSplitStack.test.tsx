import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Section } from "./Section";
import { SectionSplitStack } from "./SectionSplitStack";
import { readSplitCap, resolveSplitLayout } from "./sectionSplitLayout";
import { useSectionCollapse } from "../../panels/styles/hooks/useSectionCollapse";

const STORAGE_KEY = "test-split";
const CONTAINER_HEIGHT = 600;
const TOP_VISIBLE_HEIGHT = 200;

/**
 * jsdom 에는 ResizeObserver 가 없고 모든 rect 가 0 이다. 컨테이너/위 pane 을
 * data-split-role 로 구분해 고정 높이를 보고하는 스텁을 둔다.
 */
class ResizeObserverStub {
  private readonly callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe(target: Element) {
    const role = target.getAttribute("data-split-role");
    const height =
      role === "top"
        ? TOP_VISIBLE_HEIGHT
        : target.classList.contains("split-stack")
          ? CONTAINER_HEIGHT
          : 0;
    this.callback(
      [
        {
          target,
          contentRect: { height, width: 240 } as DOMRectReadOnly,
        } as ResizeObserverEntry,
      ],
      this as unknown as ResizeObserver,
    );
  }
  unobserve() {}
  disconnect() {}
}

function renderStack() {
  return render(
    <SectionSplitStack
      storageKey={STORAGE_KEY}
      topId="split-top"
      bottomId="split-bottom"
      label="Resize sections"
      top={
        <Section id="split-top" title="Top">
          <div>top content</div>
        </Section>
      }
      bottom={
        <Section id="split-bottom" title="Bottom">
          <div>bottom content</div>
        </Section>
      }
    />,
  );
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  localStorage.removeItem(STORAGE_KEY);
  useSectionCollapse.setState({
    collapsedSections: new Set(),
    focusMode: false,
    activeFocusSection: null,
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("resolveSplitLayout", () => {
  it("hides the divider and lifts the cap while either section is collapsed or unmeasured", () => {
    const base = { containerHeight: 600, userCap: 300 };
    expect(
      resolveSplitLayout({ ...base, topCollapsed: true, bottomCollapsed: false }),
    ).toMatchObject({ showDivider: false, topMaxHeight: null });
    expect(
      resolveSplitLayout({ ...base, topCollapsed: false, bottomCollapsed: true }),
    ).toMatchObject({ showDivider: false, topMaxHeight: null });
    expect(
      resolveSplitLayout({
        containerHeight: 0,
        userCap: 300,
        topCollapsed: false,
        bottomCollapsed: false,
      }),
    ).toMatchObject({ showDivider: false, topMaxHeight: null });
  });

  it("uses the default ratio when nothing is stored and clamps a stored cap to the range", () => {
    const open = { topCollapsed: false, bottomCollapsed: false };
    expect(
      resolveSplitLayout({ containerHeight: 600, userCap: null, ...open }),
    ).toMatchObject({ showDivider: true, value: 300, minValue: 96, maxValue: 504 });
    expect(
      resolveSplitLayout({ containerHeight: 600, userCap: 5000, ...open }).value,
    ).toBe(504);
    expect(
      resolveSplitLayout({ containerHeight: 600, userCap: 10, ...open }).value,
    ).toBe(96);
  });

  it("never lets the max fall below the min on a tiny container", () => {
    const layout = resolveSplitLayout({
      containerHeight: 120,
      userCap: null,
      topCollapsed: false,
      bottomCollapsed: false,
    });
    expect(layout.maxValue).toBe(96);
    expect(layout.value).toBe(96);
  });
});

describe("SectionSplitStack", () => {
  it("renders a separator bound to the top pane with the default cap applied", () => {
    renderStack();

    const separator = screen.getByRole("separator", { name: "Resize sections" });
    const topPane = document.getElementById(`${STORAGE_KEY}-top`)!;
    expect(separator.getAttribute("aria-controls")).toBe(topPane.id);
    expect(separator.getAttribute("aria-valuemin")).toBe("96");
    expect(separator.getAttribute("aria-valuemax")).toBe("504");
    expect(topPane.style.maxHeight).toBe("300px");
    expect(topPane.closest(".split-stack")?.getAttribute("data-user-cap")).toBe("default");
  });

  it("hides the separator while a section is collapsed and brings it back on expand", () => {
    renderStack();

    act(() => useSectionCollapse.getState().toggleSection("split-bottom"));
    expect(screen.queryByRole("separator")).toBeNull();
    expect(document.getElementById(`${STORAGE_KEY}-top`)!.style.maxHeight).toBe("");

    act(() => useSectionCollapse.getState().toggleSection("split-bottom"));
    expect(screen.getByRole("separator")).toBeTruthy();
  });

  it("End moves the cap to the max from the visible height and persists it; double-click resets", () => {
    renderStack();
    const separator = screen.getByRole("separator");

    fireEvent.keyDown(separator, { key: "End" });

    expect(readSplitCap(STORAGE_KEY)).toBe(504);
    expect(document.getElementById(`${STORAGE_KEY}-top`)!.style.maxHeight).toBe("504px");
    expect(separator.closest(".split-stack")?.getAttribute("data-user-cap")).toBe("custom");

    fireEvent.doubleClick(separator);

    expect(readSplitCap(STORAGE_KEY)).toBeNull();
    expect(document.getElementById(`${STORAGE_KEY}-top`)!.style.maxHeight).toBe("300px");
  });

  it("restores a stored cap on mount", () => {
    localStorage.setItem(STORAGE_KEY, "150");
    renderStack();

    expect(document.getElementById(`${STORAGE_KEY}-top`)!.style.maxHeight).toBe("150px");
  });
});

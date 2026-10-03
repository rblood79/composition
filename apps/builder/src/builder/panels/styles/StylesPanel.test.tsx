// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  openStylesFixture,
  type StylesFixture,
} from "./__tests__/support/catalogStylesFixture";
import { useSectionCollapse } from "./hooks/useSectionCollapse";
import { DesignPanelView } from "../design/DesignPanel";
import { useDesignPanelView } from "../design/designPanelView";
import { I18nProvider } from "../../../i18n";

let fixture: StylesFixture;

/** The Design panel on its Layout tab (ADR-252 — the Styles view is the panel's style tabs). */
function renderStylesPanel() {
  useDesignPanelView.setState({ view: "layout" });
  return render(
    <I18nProvider initialLocale="en-US">
      <DesignPanelView />
    </I18nProvider>,
    { wrapper: fixture.wrapper },
  );
}

/** A Button (200×100) in a row flex Frame, selected. */
async function openButtonInFrame() {
  fixture = await openStylesFixture(
    [
      { id: "frame-1", style: { display: "flex", flexDirection: "row" } },
      {
        id: "button-1",
        type: "Button",
        parent: "frame-1",
        style: { width: "200px", height: "100px" },
      },
    ],
    { select: "button-1" },
  );
}

describe("StylesPanel breakpoint context", () => {
  beforeEach(async () => {
    vi.stubGlobal("CSS", { escape: (value: string) => value });
    useSectionCollapse.setState({
      collapsedSections: new Set(),
      focusMode: false,
      activeFocusSection: null,
    });
    await openButtonInFrame();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows the visibility seg once — desktop cell locked (base), tablet/mobile toggleable", () => {
    renderStylesPanel();

    // Responsive 섹션은 Screen 그룹 탭에 속한다 (기본 탭은 Layout).
    fireEvent.click(screen.getByRole("tab", { name: "Screen" }));

    const desktop = screen.getByRole("button", { name: "Desktop · Base" });
    expect(desktop.hasAttribute("disabled")).toBe(true);
    expect(desktop.getAttribute("aria-pressed")).toBe("true");
    const tablet = screen.getByRole("button", { name: "Tablet" });
    expect(tablet.hasAttribute("disabled")).toBe(false);
    expect(tablet.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Mobile" })).toBeTruthy();
    // desktop(base) 에서는 Overrides 절이 없다 — 편집은 전역이라는 힌트만
    expect(screen.queryByText("Overrides")).toBeNull();
  });
});

describe("StylesPanel view tabs", () => {
  beforeEach(async () => {
    vi.stubGlobal("CSS", { escape: (value: string) => value });
    useSectionCollapse.setState({
      collapsedSections: new Set(),
      focusMode: false,
      activeFocusSection: null,
    });
    await openButtonInFrame();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders 5 view tabs and shows only the selected view", () => {
    renderStylesPanel();

    // Property + 그룹 4개 (ADR-252 — Modified 뷰는 사용자 2026-10-04 판정으로 뺐다).
    expect(screen.getAllByRole("tab")).toHaveLength(5);
    expect(screen.queryByRole("tab", { name: /^Modified/ })).toBeNull();
    // 기본 탭 = Layout(Size + Position + Layout). 다른 뷰의 섹션은 렌더되지 않는다.
    expect(screen.getByText("Size")).toBeTruthy();
    expect(screen.queryByText("Typography")).toBeNull();
    expect(screen.queryByText("Border")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "Text" }));

    expect(screen.getByText("Typography")).toBeTruthy();
    expect(screen.queryByText("Size")).toBeNull();
  });
});

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Element } from "../../../types/core/store.types";
import { useStore } from "../../stores";
import { useCanonicalDocumentStore } from "../../stores/canonical/canonicalDocumentStore";
import { useSectionCollapse } from "./hooks/useSectionCollapse";
import { StylesPanel } from "./StylesPanel";
import { I18nProvider } from "../../../i18n";

function renderStylesPanel() {
  return render(
    <I18nProvider initialLocale="en-US">
      <StylesPanel />
    </I18nProvider>,
  );
}

function setTestElements(elements: Element[]): void {
  useStore.setState({
    elements,
    elementsMap: new Map(elements.map((element) => [element.id, element])),
    selectedElementId: "button-1",
    activeBreakpoint: "desktop",
  } as never);
}

describe("StylesPanel breakpoint context", () => {
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

  it("shows the active breakpoint only once in the Responsive visibility controls", () => {
    renderStylesPanel();

    // Responsive 섹션은 Screen 그룹 탭에 속한다 (기본 탭은 Layout).
    fireEvent.click(screen.getByRole("tab", { name: "Screen" }));

    expect(screen.getAllByText("Desktop", { exact: true })).toHaveLength(1);
  });
});

describe("StylesPanel view tabs", () => {
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

  it("renders 5 view tabs and shows only the selected view", () => {
    renderStylesPanel();

    // 그룹 4개 + Modified. "수정된 속성만" 도 같은 영역을 차지하는 뷰라 탭 줄에 함께 있다.
    expect(screen.getAllByRole("tab")).toHaveLength(5);
    // 기본 탭 = Layout(Transform + Layout). 다른 뷰의 섹션은 렌더되지 않는다.
    expect(screen.getByText("Transform")).toBeTruthy();
    expect(screen.queryByText("Typography")).toBeNull();
    expect(screen.queryByText("Appearance")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "Text" }));

    expect(screen.getByText("Typography")).toBeTruthy();
    expect(screen.queryByText("Transform")).toBeNull();
  });

  it("switches to the modified-only view from the tab strip", () => {
    renderStylesPanel();

    // 수정이 있으면 접근 이름에 개수가 붙는다 ("Modified (2)").
    fireEvent.click(screen.getByRole("tab", { name: /^Modified/ }));

    expect(screen.getByText(/Modified Styles/)).toBeTruthy();
    expect(screen.queryByText("Transform")).toBeNull();
  });
});

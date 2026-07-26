// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Element } from "../../../types/core/store.types";
import { useStore } from "../../stores";
import { useEditModeStore } from "../../stores/editMode";
import { useCanonicalDocumentStore } from "../../stores/canonical/canonicalDocumentStore";
import { PageBodySection } from "./PageBodySection";

// 본 테스트의 대상은 **배선 계층**(어떤 에디터가 언제 붙는가)이다. 두 에디터의 내부
// 동작은 각자의 테스트(PageBodyEditor.test.tsx / LayoutBodyEditor.test.tsx)가 덮는다.
vi.mock("./editors/PageBodyEditor", () => ({
  PageBodyEditor: ({ elementId }: { elementId: string }) => (
    <div data-testid="page-body-editor">{elementId}</div>
  ),
}));

vi.mock("./editors/LayoutBodyEditor", () => ({
  LayoutBodyEditor: ({ elementId }: { elementId: string }) => (
    <div data-testid="layout-body-editor">{elementId}</div>
  ),
}));

function makeElement(id: string, type: string): Element {
  return {
    id,
    type,
    parent_id: null,
    page_id: "page-1",
    props: {},
    deleted: false,
  } as Element;
}

describe("PageBodySection", () => {
  beforeEach(() => {
    useStore.setState({
      currentPageId: "page-1",
      elements: [],
      elementsMap: new Map(),
      selectedElementId: null,
      selectedElementProps: {},
    } as never);
    useCanonicalDocumentStore.setState({
      currentProjectId: null,
      documents: new Map(),
      documentVersion: 0,
    });
    useEditModeStore.setState({ mode: "page" });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the page body editor for body nodes in page mode", () => {
    useStore.setState({ elements: [makeElement("body-1", "body")] } as never);

    render(<PageBodySection elementId="body-1" />);

    expect(screen.getByTestId("page-body-editor").textContent).toBe("body-1");
    expect(screen.queryByTestId("layout-body-editor")).toBeNull();
  });

  it("renders the layout body editor for body nodes in layout mode", () => {
    useStore.setState({ elements: [makeElement("body-1", "body")] } as never);
    useEditModeStore.setState({ mode: "layout" });

    render(<PageBodySection elementId="body-1" />);

    expect(screen.getByTestId("layout-body-editor").textContent).toBe("body-1");
    expect(screen.queryByTestId("page-body-editor")).toBeNull();
  });

  it("renders nothing for non-body nodes", () => {
    useStore.setState({ elements: [makeElement("btn-1", "Button")] } as never);

    const { container } = render(<PageBodySection elementId="btn-1" />);

    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when the node is missing", () => {
    const { container } = render(<PageBodySection elementId="absent" />);

    expect(container.innerHTML).toBe("");
  });
});

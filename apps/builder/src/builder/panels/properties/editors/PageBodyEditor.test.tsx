// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Element } from "../../../../types/core/store.types";
import { useStore } from "../../../stores";
import { PageBodyEditor } from "./PageBodyEditor";

vi.mock("./PageLayoutSelector", () => ({
  PageLayoutSelector: ({
    pageId,
    bindingMode,
    contextReason,
  }: {
    pageId: string;
    bindingMode?: string;
    contextReason?: string;
  }) => (
    <div
      data-testid="layout-page"
      data-binding-mode={bindingMode}
      data-context-reason={contextReason}
    >
      {pageId}
    </div>
  ),
}));

vi.mock("./PageParentSelector", () => ({
  PageParentSelector: ({ pageId }: { pageId: string }) => (
    <div data-testid="parent-page">{pageId}</div>
  ),
}));

function makeBodyElement(
  id: string,
  pageId: string | null,
  overrides: Partial<Element> = {},
): Element {
  return {
    id,
    type: "body",
    page_id: pageId,
    parent_id: null,
    order_num: 0,
    props: {},
    deleted: false,
    ...overrides,
  } as Element;
}

describe("PageBodyEditor page target", () => {
  beforeEach(() => {
    useStore.setState({
      currentPageId: null,
      elements: [],
      elementsMap: new Map<string, Element>(),
    } as never);
  });

  afterEach(() => {
    cleanup();
  });

  it("page body가 live currentPageId와 일치하면 element.page_id를 page-bound editor 대상으로 사용한다", () => {
    const body = makeBodyElement("body-page-1", "page-1");
    useStore.setState({
      currentPageId: "page-1",
      elements: [body],
      elementsMap: new Map([[body.id, body]]),
    } as never);

    render(
      <PageBodyEditor
        elementId={body.id}
        currentProps={{}}
        onUpdate={vi.fn()}
      />,
    );

    expect(screen.getByTestId("layout-page").textContent).toBe("page-1");
    expect(screen.getByTestId("parent-page").textContent).toBe("page-1");
  });

  it("deferred stale page body가 live currentPageId와 다르면 page-bound editor를 숨긴다", () => {
    const body = makeBodyElement("body-page-1", "page-1");
    useStore.setState({
      currentPageId: "page-2",
      elements: [body],
      elementsMap: new Map([[body.id, body]]),
    } as never);

    render(
      <PageBodyEditor
        elementId={body.id}
        currentProps={{}}
        onUpdate={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("layout-page")).toBeNull();
    expect(screen.queryByTestId("parent-page")).toBeNull();
  });

  it("frame/projection body처럼 page_id가 없으면 currentPageId를 fallback 대상으로 사용한다", () => {
    const body = makeBodyElement("frame-body", null, {
      layout_id: "frame-1",
    } as Partial<Element>);
    useStore.setState({
      currentPageId: "page-2",
      elements: [body],
      elementsMap: new Map([[body.id, body]]),
    } as never);

    render(
      <PageBodyEditor
        elementId={body.id}
        currentProps={{}}
        onUpdate={vi.fn()}
      />,
    );

    expect(screen.getByTestId("layout-page").textContent).toBe("page-2");
    expect(
      screen.getByTestId("layout-page").getAttribute("data-binding-mode"),
    ).toBe("explicit");
    expect(
      screen.getByTestId("layout-page").getAttribute("data-context-reason"),
    ).toBe("projection-body");
    expect(screen.getByTestId("parent-page").textContent).toBe("page-2");
  });
});

// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Element } from "../../../types/core/store.types";
import type { Page } from "../../../types/builder/unified.types";
import { useStore } from "../../stores";
import { useViewportSyncStore } from "../../workspace/canvas/stores";
import { usePageManager } from "../usePageManager";
import { I18nProvider } from "@/i18n";

/** 훅이 오류 문구를 카탈로그에서 뽑으므로 provider 밑에서 돌린다 (ADR-200 R7). */
const renderPageManager = () =>
  renderHook(() => usePageManager(), { wrapper: I18nProvider });

function makePage(id: string): Page {
  return {
    id,
    title: id,
    slug: `/${id}`,
    project_id: "project-1",
    parent_id: null,
  } as Page;
}

function makeBody(id: string, pageId: string): Element {
  return {
    id,
    type: "body",
    page_id: pageId,
    parent_id: null,
    props: {},
    deleted: false,
  } as Element;
}

function resetStoreState(): void {
  useStore.getState().setElements([]);
  useStore.setState({
    pages: [],
    currentPageId: null,
    selectedElementId: null,
    selectedElementIds: [],
    selectedElementIdsSet: new Set<string>(),
    selectedElementProps: {},
    editingContextId: null,
    selectedTab: null,
    multiSelectMode: false,
    pagePositions: {},
    pagePositionsByBreakpoint: {},
    pageLayoutDirection: "horizontal",
  });
  useViewportSyncStore.getState().reset();
}

describe("usePageManager page creation activation", () => {
  beforeEach(() => {
    resetStoreState();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("addPage는 다음 frame 전에도 새 page body를 활성 선택으로 만든다", async () => {
    const home = makePage("page-1");
    const homeBody = makeBody("body-1", home.id);
    useStore.getState().appendPageShell(home, homeBody, { x: 0, y: 0 });

    const { result } = renderPageManager();

    let createdPageId: string | null = null;
    await act(async () => {
      const addResult = await result.current.addPage("project-1");
      expect(addResult.success).toBe(true);
      createdPageId = addResult.data?.id ?? null;
    });

    expect(createdPageId).toBeTruthy();

    const state = useStore.getState();
    const createdBody = state.pageElementsSnapshot[createdPageId!]?.find(
      (element) => element.type === "body",
    );

    expect(state.currentPageId).toBe(createdPageId);
    expect(state.selectedElementId).toBe(createdBody?.id);
    expect(state.selectedElementIds).toEqual([createdBody?.id]);
  });

  it("addPage page number excludes the Components system page", async () => {
    const components = {
      ...makePage("page-components"),
      title: "Components",
      slug: "/__components",
    };
    const home = { ...makePage("page-1"), title: "Home", slug: "/" };
    useStore
      .getState()
      .appendPageShell(components, makeBody("body-components", components.id), {
        x: 0,
        y: 0,
      });
    useStore.getState().appendPageShell(home, makeBody("body-1", home.id), {
      x: 100,
      y: 0,
    });

    const { result } = renderPageManager();

    await act(async () => {
      const addResult = await result.current.addPage("project-1");
      expect(addResult.success).toBe(true);
      expect(addResult.data?.title).toBe("Page 2");
      expect(addResult.data?.slug).toBe("/page-2");
    });
  });

  it("layout-bound addPageWithParams도 appendPageShell activation 외 activatePage를 중복 호출하지 않는다", async () => {
    const home = makePage("page-1");
    const homeBody = makeBody("body-1", home.id);
    useStore.getState().appendPageShell(home, homeBody, { x: 0, y: 0 });

    const activateSpy = vi.spyOn(useStore.getState(), "activatePage");
    const { result } = renderPageManager();

    await act(async () => {
      const addResult = await result.current.addPageWithParams({
        projectId: "project-1",
        title: "Layout Page",
        slug: "/layout-page",
        layoutId: "frame-1",
      });
      expect(addResult.success).toBe(true);
    });

    expect(activateSpy).not.toHaveBeenCalled();
    expect(useStore.getState().currentPageId).not.toBe(home.id);
  });

  it("현재 pageLayoutDirection에 맞춰 새 page를 gap과 함께 배치한다", async () => {
    const first = makePage("page-1");
    const second = makePage("page-2");
    useStore.setState({
      pageLayoutDirection: "vertical",
    });
    useStore
      .getState()
      .appendPageShell(first, makeBody("body-1", first.id), { x: 0, y: 0 });
    useStore.getState().appendPageShell(second, makeBody("body-2", second.id), {
      x: 0,
      y: 1160,
    });
    useViewportSyncStore.getState().setCanvasSize({
      width: 640,
      height: 480,
    });

    const { result } = renderPageManager();

    await act(async () => {
      const addResult = await result.current.addPage("project-1");
      expect(addResult.success).toBe(true);
    });

    const pages = useStore.getState().pages;
    const createdPage = pages[pages.length - 1];
    expect(useStore.getState().pagePositions[createdPage.id]).toEqual({
      x: 0,
      y: 1720,
    });
  });
});

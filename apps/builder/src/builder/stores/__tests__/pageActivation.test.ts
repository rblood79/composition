import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompositionDocument } from "@composition/shared";

import type { Page } from "../../../types/builder/unified.types";
import type { Element } from "../../../types/core/store.types";
import { useStore } from "../index";
import { useCanonicalDocumentStore } from "../canonical/canonicalDocumentStore";

const mockGetByPage = vi.hoisted(() => vi.fn());
const mockInsertMany = vi.hoisted(() => vi.fn());
const mockSupabaseFrom = vi.hoisted(() =>
  vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn(async () => ({ data: [], error: null })),
      })),
    })),
  })),
);

vi.mock("../../../lib/db", () => ({
  getDB: vi.fn(async () => ({
    elements: {
      getByPage: mockGetByPage,
      insertMany: mockInsertMany,
    },
  })),
}));

vi.mock("../../../env/supabase.client", () => ({
  supabase: {
    from: mockSupabaseFrom,
  },
}));

function makeElement(
  id: string,
  pageId: string,
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

function makePage(id: string): Page {
  return {
    id,
    title: id,
    slug: `/${id}`,
    project_id: "project-1",
    parent_id: null,
  } as Page;
}

function resetStoreState() {
  useCanonicalDocumentStore.setState({
    documents: new Map(),
    currentProjectId: null,
    documentVersion: 0,
  });
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
    loadedPages: new Set<string>(),
    loadingPages: new Set<string>(),
    lazyLoadingEnabled: true,
  });
  vi.clearAllMocks();
}

describe("page activation selection invariant", () => {
  beforeEach(resetStoreState);

  it("setCurrentPageId는 stale page 선택을 page body 선택으로 보정한다", () => {
    const body = makeElement("body-1", "page-1");
    const button = makeElement("button-1", "page-1", {
      type: "Button",
      parent_id: body.id,
      order_num: 1,
    });
    useStore.getState().setElements([button, body]);
    useStore.setState({
      selectedElementId: "page-1",
      selectedElementIds: ["page-1"],
      selectedElementIdsSet: new Set(["page-1"]),
      multiSelectMode: true,
      editingContextId: button.id,
      selectedTab: { parentId: button.id, tabIndex: 0 },
    });

    useStore.getState().setCurrentPageId("page-1");

    const state = useStore.getState();
    expect(state.currentPageId).toBe("page-1");
    expect(state.selectedElementId).toBe(body.id);
    expect(state.selectedElementIds).toEqual([body.id]);
    expect(state.selectedElementIdsSet.has(body.id)).toBe(true);
    expect(state.multiSelectMode).toBe(false);
    expect(state.editingContextId).toBeNull();
    expect(state.selectedTab).toBeNull();
  });

  it("activatePage는 명시된 elementId가 있으면 body fallback보다 우선한다", () => {
    const body = makeElement("body-1", "page-1");
    const button = makeElement("button-1", "page-1", {
      type: "Button",
      parent_id: body.id,
      order_num: 1,
    });
    useStore.getState().setElements([body, button]);

    useStore.getState().activatePage("page-1", button.id);

    const state = useStore.getState();
    expect(state.currentPageId).toBe("page-1");
    expect(state.selectedElementId).toBe(button.id);
    expect(state.selectedElementIds).toEqual([button.id]);
  });

  it("selectElementWithPageTransition는 명시된 editingContextId를 같은 commit에 반영한다", () => {
    const body1 = makeElement("body-1", "page-1");
    const body2 = makeElement("body-2", "page-2");
    const card = makeElement("card-2", "page-2", {
      type: "Card",
      parent_id: body2.id,
      order_num: 1,
    });
    const heading = makeElement("heading-2", "page-2", {
      type: "Heading",
      parent_id: card.id,
      order_num: 0,
    });
    useStore.getState().setElements([body1, body2, card, heading]);
    useStore.setState({ currentPageId: "page-1" });

    useStore.getState().selectElementWithPageTransition(heading.id, "page-2", {
      editingContextId: card.id,
    });

    const state = useStore.getState();
    expect(state.currentPageId).toBe("page-2");
    expect(state.editingContextId).toBe(card.id);
    expect(state.selectedElementId).toBe(heading.id);
    expect(state.selectedElementIds).toEqual([heading.id]);
  });

  it("activatePage는 cross-page transition으로 선택된 target element를 덮지 않는다", () => {
    const body1 = makeElement("body-1", "page-1");
    const body2 = makeElement("body-2", "page-2");
    const origin = makeElement("origin", "page-2", {
      type: "Button",
      parent_id: body2.id,
      order_num: 1,
      reusable: true,
    });
    useStore.getState().setElements([body1, body2, origin]);
    useStore.setState({ currentPageId: "page-1" });

    useStore.getState().selectElementWithPageTransition(origin.id, "page-2");
    useStore.getState().activatePage("page-2");

    const state = useStore.getState();
    expect(state.currentPageId).toBe("page-2");
    expect(state.selectedElementId).toBe(origin.id);
    expect(state.selectedElementIds).toEqual([origin.id]);
  });

  it("activatePage는 canonical-only target selection도 page body로 덮지 않는다", () => {
    const body1 = makeElement("body-1", "page-1");
    const body2 = makeElement("body-2", "page-2");
    const doc = {
      version: "composition-1.0",
      children: [
        {
          id: "page-2",
          type: "frame",
          props: {},
          children: [
            {
              id: "origin",
              type: "Button",
              reusable: true,
              props: { label: "Origin" },
            },
          ],
        },
      ],
    } satisfies CompositionDocument;

    useStore.getState().setElements([body1, body2]);
    useStore.setState({ currentPageId: "page-1" });
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument("project-1", doc);

    useStore.getState().selectElementWithPageTransition("origin", "page-2");
    useStore.getState().activatePage("page-2");

    const state = useStore.getState();
    expect(state.currentPageId).toBe("page-2");
    expect(state.selectedElementId).toBe("origin");
    expect(state.selectedElementIds).toEqual(["origin"]);
  });

  it("activatePage는 cross-page transition 후 non-body multi selection을 유지한다", () => {
    const body1 = makeElement("body-1", "page-1");
    const body2 = makeElement("body-2", "page-2");
    const instanceA = makeElement("instance-a", "page-2", {
      type: "ref",
      parent_id: body2.id,
      order_num: 1,
    });
    const instanceB = makeElement("instance-b", "page-3", {
      type: "ref",
      order_num: 1,
    });
    useStore.getState().setElements([body1, body2, instanceA, instanceB]);
    useStore.setState({ currentPageId: "page-1" });

    useStore.getState().selectElementWithPageTransition(instanceA.id, "page-2");
    useStore.getState().setSelectedElements([instanceA.id, instanceB.id]);
    useStore.getState().activatePage("page-2");

    const state = useStore.getState();
    expect(state.currentPageId).toBe("page-2");
    expect(state.selectedElementId).toBe(instanceA.id);
    expect(state.selectedElementIds).toEqual([instanceA.id, instanceB.id]);
    expect(state.multiSelectMode).toBe(true);
  });

  it("activatePage는 selectedElementId가 이미 body여도 stale multi selection을 정리한다", () => {
    const body = makeElement("body-1", "page-1");
    const button = makeElement("button-1", "page-1", {
      type: "Button",
      parent_id: body.id,
      order_num: 1,
    });
    useStore.getState().setElements([body, button]);
    useStore.setState({
      currentPageId: "page-1",
      selectedElementId: body.id,
      selectedElementIds: [body.id, button.id],
      selectedElementIdsSet: new Set([body.id, button.id]),
      multiSelectMode: true,
    });

    useStore.getState().activatePage("page-1");

    const state = useStore.getState();
    expect(state.selectedElementId).toBe(body.id);
    expect(state.selectedElementIds).toEqual([body.id]);
    expect(state.selectedElementIdsSet.size).toBe(1);
    expect(state.multiSelectMode).toBe(false);
  });

  it("loadPageElements는 로드된 page의 body를 같은 commit에서 선택한다", () => {
    const body = makeElement("body-1", "page-1");
    const button = makeElement("button-1", "page-1", {
      type: "Button",
      parent_id: body.id,
      order_num: 1,
    });
    useStore.setState({
      selectedElementId: "page-1",
      selectedElementIds: ["page-1"],
      selectedElementIdsSet: new Set(["page-1"]),
    });

    useStore.getState().loadPageElements([button, body], "page-1");

    const state = useStore.getState();
    expect(state.currentPageId).toBe("page-1");
    expect(state.selectedElementId).toBe(body.id);
    expect(
      state.pageElementsSnapshot["page-1"]?.map((element) => element.id),
    ).toEqual(expect.arrayContaining([body.id, button.id]));
  });

  it("appendPageShell은 elements[]에서 indexes를 재생성하고 body를 선택한다", () => {
    const bodyOne = makeElement("body-1", "page-1");
    const bodyTwo = makeElement("body-2", "page-2");
    useStore.getState().setElements([bodyOne]);
    useStore.setState({
      pages: [makePage("page-1")],
      currentPageId: "page-1",
    });

    useStore
      .getState()
      .appendPageShell(makePage("page-2"), bodyTwo, { x: 100, y: 120 });

    const state = useStore.getState();
    expect(state.elementsMap.get(bodyTwo.id)).toBe(bodyTwo);
    expect(state.childrenMap.get("root")?.map((element) => element.id)).toEqual(
      [bodyOne.id, bodyTwo.id],
    );
    expect(state.pageIndex.elementsByPage.get("page-2")?.has(bodyTwo.id)).toBe(
      true,
    );
    expect(
      state.pageElementsSnapshot["page-2"]?.map((element) => element.id),
    ).toEqual([bodyTwo.id]);
    expect(state.selectedElementId).toBe(bodyTwo.id);
  });

  it("lazyLoadPageElements는 현재 page 로드 완료 후 stale 선택을 body로 보정한다", async () => {
    const body = makeElement("body-1", "page-1");
    const button = makeElement("button-1", "page-1", {
      type: "Button",
      parent_id: body.id,
      order_num: 1,
    });
    const doc = {
      version: "composition-1.0",
      children: [
        {
          id: "page-1",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-1" },
          children: [
            {
              id: body.id,
              type: "Body",
              props: body.props as Record<string, unknown>,
              children: [
                {
                  id: button.id,
                  type: button.type,
                  props: button.props as Record<string, unknown>,
                },
              ],
            },
          ],
        },
      ],
    } satisfies CompositionDocument;
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument("project-1", doc);
    useStore.setState({
      currentPageId: "page-1",
      selectedElementId: "page-1",
      selectedElementIds: ["page-1"],
      selectedElementIdsSet: new Set(["page-1"]),
    });

    await useStore.getState().lazyLoadPageElements("page-1");

    const state = useStore.getState();
    expect(state.currentPageId).toBe("page-1");
    expect(state.selectedElementId).toBe(body.id);
    expect(state.selectedElementIds).toEqual([body.id]);
    expect(state.loadedPages.has("page-1")).toBe(true);
    expect(mockGetByPage).not.toHaveBeenCalled();
  });
});

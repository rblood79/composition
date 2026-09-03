import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CompositionDocument } from "@composition/shared";
import type { Element } from "../../../types/core/store.types";
import { useStore } from "../index";
import { useCanonicalDocumentStore } from "../canonical/canonicalDocumentStore";
import { __resetTraversalCache_TEST_ONLY__ } from "../canonical/canonicalTraversalHelpers";

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
    props: {},
    deleted: false,
    ...overrides,
  } as Element;
}

function resetStoreState() {
  __resetTraversalCache_TEST_ONLY__();
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
  });
  vi.clearAllMocks();
}

describe("selection invariant", () => {
  beforeEach(resetStoreState);

  it("selectTabElement는 primary selection과 multi-selection ids를 함께 동기화한다", () => {
    const body = makeElement("body-1", "page-1");
    const tabs = makeElement("tabs-1", "page-1", {
      type: "Tabs",
      parent_id: body.id,
    });

    useStore.getState().setElements([body, tabs]);
    useStore.setState({
      selectedElementId: body.id,
      selectedElementIds: [body.id],
      selectedElementIdsSet: new Set([body.id]),
      multiSelectMode: false,
      selectedTab: null,
    });

    useStore.getState().selectTabElement(tabs.id, tabs.props, 0);

    const state = useStore.getState();
    expect(state.selectedElementId).toBe(tabs.id);
    expect(state.selectedElementIds).toEqual([tabs.id]);
    expect(state.selectedElementIdsSet.has(tabs.id)).toBe(true);
    expect(state.selectedElementIdsSet.has(body.id)).toBe(false);
    expect(state.multiSelectMode).toBe(false);
    expect(state.selectedTab).toEqual({ parentId: tabs.id, tabIndex: 0 });
  });

  it("canonical hierarchy에서 editing context를 즉시 진입하고 body parent로 종료한다", () => {
    const document = {
      version: "composition-1.0",
      children: [
        {
          id: "body-1",
          type: "body",
          props: {},
          children: [
            {
              id: "section-1",
              type: "Section",
              props: {},
              children: [{ id: "text-1", type: "Text", props: {} }],
            },
          ],
        },
      ],
    } as unknown as CompositionDocument;
    useCanonicalDocumentStore.getState().setDocument("project-1", document);
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");

    useStore.getState().enterEditingContext("section-1");
    expect(useStore.getState().editingContextId).toBe("section-1");

    useStore.getState().exitEditingContext();
    const state = useStore.getState();
    expect(state.editingContextId).toBeNull();
    expect(state.selectedElementIds).toEqual(["section-1"]);
    expect(state.selectedElementIdsSet).toEqual(new Set(["section-1"]));
  });

  it("active canonical document에 없는 stale legacy context를 복원하지 않는다", () => {
    const staleContainer = makeElement("stale-container", "page-1", {
      type: "Section",
    });
    const staleChild = makeElement("stale-child", "page-1", {
      type: "Text",
      parent_id: staleContainer.id,
    });
    useStore.getState().setElements([staleContainer, staleChild]);
    useCanonicalDocumentStore.getState().setDocument("project-1", {
      version: "composition-1.0",
      children: [{ id: "body-1", type: "body", props: {} }],
    } as unknown as CompositionDocument);
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");

    useStore.getState().enterEditingContext(staleContainer.id);

    expect(useStore.getState().editingContextId).toBeNull();
  });

  it("page ref descendants 안의 context도 canonical hierarchy에서 진입한다", () => {
    useCanonicalDocumentStore.getState().setDocument("project-1", {
      version: "composition-1.0",
      children: [
        {
          id: "page-ref",
          type: "ref",
          ref: "layout-1",
          metadata: { type: "legacy-page", pageId: "page-1" },
          descendants: {
            slot: {
              children: [
                {
                  id: "body-1",
                  type: "body",
                  props: {},
                  children: [
                    {
                      id: "section-1",
                      type: "Section",
                      props: {},
                      children: [{ id: "text-1", type: "Text", props: {} }],
                    },
                  ],
                },
              ],
            },
          },
        },
      ],
    } as unknown as CompositionDocument);
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");

    useStore.getState().enterEditingContext("section-1");

    expect(useStore.getState().editingContextId).toBe("section-1");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

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
    props: {},
    deleted: false,
    ...overrides,
  } as Element;
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
});

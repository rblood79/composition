// @vitest-environment jsdom

import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { Page } from "../../../types/builder/unified.types";
import type { Element } from "../../../types/core/store.types";

const mockStoreState = vi.hoisted(() => ({
  pages: [] as Page[],
  currentPageId: null as string | null,
  pageElementsSnapshot: {} as Record<string, Element[]>,
  activatePage: vi.fn(),
  removePageLocal: vi.fn(),
}));

const mockRequestAutoSelectAfterUpdate = vi.hoisted(() => vi.fn());
const mockLoadPageIfNeeded = vi.hoisted(() => vi.fn(async () => undefined));
const mockAddPage = vi.hoisted(() => vi.fn(async () => undefined));
const mockPanToPage = vi.hoisted(() => vi.fn());

vi.mock("../../stores", () => ({
  useStore: Object.assign(
    <T,>(selector?: (state: typeof mockStoreState) => T) =>
      selector ? selector(mockStoreState) : (mockStoreState as unknown as T),
    {
      getState: () => mockStoreState,
      setState: vi.fn(),
    },
  ),
}));

vi.mock("@/builder/hooks", () => ({
  useIframeMessenger: () => ({
    requestAutoSelectAfterUpdate: mockRequestAutoSelectAfterUpdate,
  }),
  usePageManager: () => ({
    addPage: mockAddPage,
    loadPageIfNeeded: mockLoadPageIfNeeded,
    isCreatingPage: false,
  }),
}));

vi.mock("../../components", () => ({
  PanelHeader: ({
    title,
    actions,
  }: {
    title: string;
    actions?: React.ReactNode;
  }) => (
    <div>
      <span>{title}</span>
      {actions}
    </div>
  ),
}));

vi.mock("./tree/PageTree", () => ({
  PageTree: ({
    pages,
    onPageSelect,
  }: {
    pages: Page[];
    onPageSelect: (page: Page) => void;
  }) => (
    <div>
      {pages.map((page) => (
        <button key={page.id} onClick={() => onPageSelect(page)}>
          {page.title || "Untitled"}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("../../workspace/canvas/viewport/panToPage", () => ({
  panToPage: mockPanToPage,
}));

vi.mock("../../../lib/db", () => ({
  getDB: vi.fn(),
}));

vi.mock("../../utils/pagePersistenceQueue", () => ({
  enqueuePagePersistence: vi.fn(),
}));

vi.mock("../../utils/scheduleTask", () => ({
  scheduleBackgroundTask: (callback: () => void) => callback(),
  scheduleNextFrame: (callback: () => void) => {
    callback();
    return 0;
  },
}));

vi.mock("../../../utils/longTaskMonitor", () => ({
  longTaskMonitor: {
    measureAsync: vi.fn(
      async (_label: string, callback: () => Promise<unknown>) => callback(),
    ),
  },
}));

import { PagesSection } from "./PagesSection";

function makePage(id: string, title: string, orderNum = 0): Page {
  return {
    id,
    title,
    slug: title.toLowerCase(),
    project_id: "project-1",
    parent_id: null,
    order_num: orderNum,
  } as Page;
}

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

function resetMockState() {
  mockStoreState.pages = [];
  mockStoreState.currentPageId = null;
  mockStoreState.pageElementsSnapshot = {};
  vi.clearAllMocks();
  mockLoadPageIfNeeded.mockResolvedValue(undefined);
}

describe("PagesSection page selection", () => {
  beforeEach(resetMockState);
  afterEach(() => {
    cleanup();
  });

  it("이미 열린 page를 다시 선택하면 page body를 다시 선택한다", () => {
    const home = makePage("page-1", "Home", 0);
    const about = makePage("page-2", "About", 1);
    mockStoreState.pages = [home, about];
    mockStoreState.currentPageId = home.id;
    mockStoreState.pageElementsSnapshot = {
      [home.id]: [
        makeElement("button-1", home.id, { type: "Button", order_num: 1 }),
        makeElement("body-1", home.id),
      ],
    };

    render(<PagesSection projectId="project-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Home" }));

    expect(mockPanToPage).toHaveBeenCalledWith(home.id);
    expect(mockStoreState.activatePage).toHaveBeenCalledWith(home.id, "body-1");
    expect(mockRequestAutoSelectAfterUpdate).toHaveBeenCalledWith("body-1");
    expect(mockLoadPageIfNeeded).not.toHaveBeenCalled();
  });

  it("Pages 탭 진입 시 currentPageId가 비어 있으면 Home page body를 자동 선택한다", async () => {
    const home = makePage("page-1", "Home", 0);
    const about = makePage("page-2", "About", 1);
    mockStoreState.pages = [home, about];
    mockStoreState.currentPageId = null;
    mockStoreState.pageElementsSnapshot = {
      [home.id]: [makeElement("body-1", home.id)],
      [about.id]: [makeElement("body-2", about.id)],
    };

    render(<PagesSection projectId="project-1" />);

    await waitFor(() => {
      expect(mockStoreState.activatePage).toHaveBeenCalledWith(
        home.id,
        "body-1",
      );
    });
    expect(mockPanToPage).toHaveBeenCalledWith(home.id);
    expect(mockRequestAutoSelectAfterUpdate).toHaveBeenCalledWith("body-1");
  });

  it("단일 page 행을 선택해도 page body를 선택한다", () => {
    const home = makePage("page-1", "Home", 0);
    mockStoreState.pages = [home];
    mockStoreState.currentPageId = home.id;
    mockStoreState.pageElementsSnapshot = {
      [home.id]: [makeElement("body-1", home.id)],
    };

    render(<PagesSection projectId="project-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Select page Home" }));

    expect(mockStoreState.activatePage).toHaveBeenCalledWith(home.id, "body-1");
    expect(mockRequestAutoSelectAfterUpdate).toHaveBeenCalledWith("body-1");
  });

  it("page body가 아직 snapshot에 없으면 lazy load 후 body를 선택한다", async () => {
    const home = makePage("page-1", "Home", 0);
    mockStoreState.pages = [home];
    mockStoreState.currentPageId = home.id;
    mockStoreState.pageElementsSnapshot = {
      [home.id]: [],
    };
    mockLoadPageIfNeeded.mockImplementation(async () => {
      mockStoreState.pageElementsSnapshot = {
        [home.id]: [makeElement("body-1", home.id)],
      };
    });

    render(<PagesSection projectId="project-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Select page Home" }));

    expect(mockStoreState.activatePage).toHaveBeenCalledWith(home.id, null);
    await waitFor(() => {
      expect(mockStoreState.activatePage).toHaveBeenCalledWith(
        home.id,
        "body-1",
      );
    });
    expect(mockRequestAutoSelectAfterUpdate).toHaveBeenCalledWith("body-1");
  });
});

// @vitest-environment jsdom

import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render as rtlRender,
  screen,
  waitFor,
} from "@testing-library/react";
import { I18nProvider } from "@/i18n";
import type { Page } from "../../../types/builder/unified.types";
import type { Element } from "../../../types/core/store.types";

const mockStoreState = vi.hoisted(() => ({
  pages: [] as Page[],
  currentPageId: null as string | null,
  selectedElementId: null as string | null,
  pageElementsSnapshot: {} as Record<string, Element[]>,
  activatePage: vi.fn(),
  removePageLocal: vi.fn(),
  renamePageTitle: vi.fn(),
}));

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
  usePageManager: () => ({
    addPage: mockAddPage,
    loadPageIfNeeded: mockLoadPageIfNeeded,
    isCreatingPage: false,
  }),
}));

vi.mock("../../components", () => ({
  Section: ({
    title,
    actions,
    children,
  }: {
    title: string;
    actions?: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <div className="section">
      <div className="section-header">
        <span>{title}</span>
        {actions}
      </div>
      <div className="section-content">{children}</div>
    </div>
  ),
  ActionIconButton: ({
    "aria-label": ariaLabel,
    isDisabled,
    onPress,
    children,
  }: {
    "aria-label": string;
    isDisabled?: boolean;
    onPress?: () => void;
    children: React.ReactNode;
  }) => (
    <button aria-label={ariaLabel} disabled={isDisabled} onClick={onPress}>
      {children}
    </button>
  ),
}));

vi.mock("./tree/PageTree", () => ({
  PageTree: ({
    pages,
    onPageSelect,
    onPageDelete,
    onPageRename,
  }: {
    pages: Page[];
    onPageSelect: (page: Page) => void;
    onPageDelete?: (page: Page) => void;
    onPageRename?: (page: Page, title: string) => void;
  }) => (
    <div>
      {pages.map((page) => (
        <React.Fragment key={page.id}>
          <button
            onClick={() => onPageSelect(page)}
            onDoubleClick={() => onPageRename?.(page, "Renamed")}
          >
            {page.title || "Untitled"}
          </button>
          <button
            aria-label={`Delete ${page.title || "Untitled"}`}
            onClick={() => onPageDelete?.(page)}
          >
            Delete
          </button>
        </React.Fragment>
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

// PagesSection 은 useI18n() (provider 필수) 을 쓴다 — 앱 root (main.tsx) 와 같은 provider 로 감싼다.
function render(ui: React.ReactElement) {
  return rtlRender(<I18nProvider initialLocale="en-US">{ui}</I18nProvider>);
}

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
  // Canonical migration: `order_num` was removed from Element (ADR-125) but runtime
  // fixtures still carry the value. Keep it as an optional override field.
  overrides: Partial<Element> & { order_num?: number } = {},
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
  mockStoreState.selectedElementId = null;
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
    vi.clearAllMocks();

    fireEvent.click(screen.getByRole("button", { name: "Home" }));

    expect(mockPanToPage).toHaveBeenCalledWith(home.id);
    expect(mockStoreState.activatePage).toHaveBeenCalledWith(home.id, "body-1");
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
  });

  it("Pages 탭 진입 시 currentPageId가 이미 있으면 store activation으로 선택 보정을 위임한다", async () => {
    const home = makePage("page-1", "Home", 0);
    const body = makeElement("body-1", home.id);
    mockStoreState.pages = [home];
    mockStoreState.currentPageId = home.id;
    mockStoreState.selectedElementId = home.id;
    mockStoreState.pageElementsSnapshot = {
      [home.id]: [body],
    };

    render(<PagesSection projectId="project-1" />);

    await waitFor(() => {
      expect(mockStoreState.activatePage).toHaveBeenCalledWith(home.id);
    });
    expect(mockLoadPageIfNeeded).toHaveBeenCalledWith(home.id);
  });

  it("단일 page 행을 선택해도 page body를 선택한다", () => {
    const home = makePage("page-1", "Home", 0);
    mockStoreState.pages = [home];
    mockStoreState.currentPageId = home.id;
    mockStoreState.pageElementsSnapshot = {
      [home.id]: [makeElement("body-1", home.id)],
    };

    render(<PagesSection projectId="project-1" />);
    vi.clearAllMocks();

    fireEvent.click(screen.getByRole("button", { name: "Select page Home" }));

    expect(mockStoreState.activatePage).toHaveBeenCalledWith(home.id, "body-1");
  });

  it("단일 page 행을 더블클릭하면 inline title rename을 확정한다", () => {
    const home = makePage("page-1", "Home", 0);
    mockStoreState.pages = [home];
    mockStoreState.currentPageId = home.id;
    mockStoreState.pageElementsSnapshot = {
      [home.id]: [makeElement("body-1", home.id)],
    };

    render(<PagesSection projectId="project-1" />);
    fireEvent.doubleClick(screen.getByText("Home"));
    const input = screen.getByRole("textbox", { name: "Rename page Home" });
    fireEvent.change(input, { target: { value: "Landing" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockStoreState.renamePageTitle).toHaveBeenCalledWith(
      home.id,
      "Landing",
    );
  });

  it("여러 page의 PageTree rename도 같은 store action을 사용한다", () => {
    const home = makePage("page-1", "Home", 0);
    const about = makePage("page-2", "About", 1);
    mockStoreState.pages = [home, about];
    mockStoreState.currentPageId = home.id;
    mockStoreState.pageElementsSnapshot = {
      [home.id]: [makeElement("body-1", home.id)],
      [about.id]: [makeElement("body-2", about.id)],
    };

    render(<PagesSection projectId="project-1" />);
    fireEvent.doubleClick(screen.getByRole("button", { name: "About" }));

    expect(mockStoreState.renamePageTitle).toHaveBeenCalledWith(
      about.id,
      "Renamed",
    );
  });

  it("현재 page 삭제 시 store mutation 뒤 인접 page body를 즉시 선택한다", () => {
    const home = makePage("page-1", "Home", 0);
    const about = makePage("page-2", "About", 1);
    mockStoreState.pages = [home, about];
    mockStoreState.currentPageId = home.id;
    mockStoreState.pageElementsSnapshot = {
      [home.id]: [makeElement("body-1", home.id)],
      [about.id]: [makeElement("body-2", about.id)],
    };

    render(<PagesSection projectId="project-1" />);
    vi.clearAllMocks();

    fireEvent.click(screen.getByRole("button", { name: "Delete Home" }));

    expect(mockStoreState.removePageLocal).toHaveBeenCalledWith(home.id, {
      pageId: about.id,
      elementId: null,
    });
    expect(mockStoreState.activatePage).toHaveBeenCalledWith(
      about.id,
      "body-2",
    );
    expect(mockLoadPageIfNeeded).not.toHaveBeenCalled();
  });

  it("page body가 아직 snapshot에 없으면 탭 진입 시 page 로드를 요청한다", async () => {
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

    await waitFor(() => {
      expect(mockStoreState.activatePage).toHaveBeenCalledWith(home.id);
    });
    expect(mockLoadPageIfNeeded).toHaveBeenCalledWith(home.id);
  });
});

describe("PagesSection page search", () => {
  beforeEach(resetMockState);
  afterEach(() => {
    cleanup();
  });

  function seedPages() {
    const home = makePage("page-1", "Home", 0);
    const about = makePage("page-2", "About", 1);
    const blog = makePage("page-3", "Blog", 2);
    const post = { ...makePage("page-4", "First Post", 3), parent_id: blog.id };
    mockStoreState.pages = [home, about, blog, post];
    mockStoreState.currentPageId = home.id;
    mockStoreState.pageElementsSnapshot = {
      [home.id]: [makeElement("body-1", home.id)],
    };
  }

  it("검색을 열고 입력하면 일치 페이지와 그 조상만 트리에 남는다", () => {
    seedPages();
    render(<PagesSection projectId="project-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Search pages" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search pages" }), {
      target: { value: "post" },
    });

    expect(screen.getByRole("button", { name: "Blog" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "First Post" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Home" })).toBeNull();
    expect(screen.queryByRole("button", { name: "About" })).toBeNull();
  });

  it("일치 페이지가 없으면 안내 문구를 보이고, Escape 로 닫으면 전체 목록으로 돌아간다", () => {
    seedPages();
    render(<PagesSection projectId="project-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Search pages" }));
    const input = screen.getByRole("searchbox", { name: "Search pages" });
    fireEvent.change(input, { target: { value: "zzz" } });

    expect(screen.getByRole("status").textContent).toBe("No pages match");
    expect(screen.queryByRole("button", { name: "Home" })).toBeNull();

    fireEvent.keyDown(input, { key: "Escape" });

    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.getByRole("button", { name: "Home" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "First Post" })).toBeTruthy();
  });

  it("페이지가 하나뿐이면 검색 토글을 내지 않는다", () => {
    const home = makePage("page-1", "Home", 0);
    mockStoreState.pages = [home];
    mockStoreState.currentPageId = home.id;
    mockStoreState.pageElementsSnapshot = {
      [home.id]: [makeElement("body-1", home.id)],
    };
    render(<PagesSection projectId="project-1" />);

    expect(screen.queryByRole("button", { name: "Search pages" })).toBeNull();
  });
});

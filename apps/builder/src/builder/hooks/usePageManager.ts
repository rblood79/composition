import { startTransition, useState, useRef, useCallback } from "react";
import { useListData } from "react-stately";
import { Element } from "../../types/core/store.types";
import { type Page, getDefaultProps } from "../../types/builder/unified.types";

// (ADR-128) Page type 은 cloud Supabase row schema 기원이었지만 cloud data
// layer dead 후 IndexedDB-native 표현으로 inline 유지 — 본 hook 안에서만 사용.
interface ApiPage {
  id: string;
  project_id: string;
  title: string;
  slug: string;
  order_num?: number;
  created_at?: string;
  updated_at?: string;
  parent_id?: string | null;
}
import { getDB } from "../../lib/db";
import { useStore } from "../stores";
// ADR-116 Phase 3 G4 — mutation reverse wrapper (D18=A 정합)
import { useCanonicalDocumentStore } from "../stores/canonical/canonicalDocumentStore";
import { useViewportSyncStore } from "../workspace/canvas/stores";
import type { ElementProps } from "../../types/integrations/supabase.types";
import { ElementUtils } from "../../utils/element/elementUtils";
import {
  deriveProjectRenderModelFromDocument,
  type CompositionDocument,
} from "@composition/shared";
import { scheduleNextFrame } from "../utils/scheduleTask";

const PAGE_STACK_GAP = 80;

function normalizePageSlug(slug: string | null | undefined): string {
  if (!slug) return "";
  return slug.startsWith("/") ? slug : `/${slug}`;
}

function selectInitialPage(pages: ApiPage[]): ApiPage | undefined {
  return pages.find((page) => normalizePageSlug(page.slug) === "/") ?? pages[0];
}

/**
 * API 응답 타입 (에러를 throw하지 않고 return)
 */
export interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
}

/**
 * ⭐ Nested Routes & Slug System: 페이지 생성 파라미터
 */
export interface AddPageParams {
  projectId: string;
  title: string;
  slug: string;
  layoutId?: string | null;
  parentId?: string | null;
}

export interface UsePageManagerReturn {
  pages: ApiPage[];
  selectedPageId: string | null;
  setSelectedPageId: (id: string | null) => void;
  isCreatingPage: boolean;
  fetchElements: (pageId: string) => Promise<ApiResult<Element[]>>;
  addPage: (projectId: string) => Promise<ApiResult<ApiPage>>;
  addPageWithParams: (params: AddPageParams) => Promise<ApiResult<ApiPage>>;
  initializeProject: (projectId: string) => Promise<ApiResult<ApiPage[]>>;
  /** 🚀 Phase 5: 페이지가 로드되지 않았으면 로드 */
  loadPageIfNeeded: (pageId: string) => Promise<void>;
  // 직접 접근 (필요시)
  pageList: ReturnType<typeof useListData<ApiPage>>;
}

export interface UsePageManagerProps {
  requestAutoSelectAfterUpdate?: (elementId: string) => void;
}

/**
 * usePageManager - React Stately useListData 기반 페이지 관리
 *
 * wrapper 함수 불필요: 모든 함수가 에러를 return으로 처리
 * useCallback 사용: fetchElements, initializeProject는 메모이제이션됨 (무한 재렌더 방지)
 *
 * @param props - requestAutoSelectAfterUpdate 함수 (iframe messenger에서)
 * @example
 * ```tsx
 * const { requestAutoSelectAfterUpdate } = useIframeMessenger();
 * const { pages, selectedPageId, fetchElements, addPage, initializeProject } = usePageManager({ requestAutoSelectAfterUpdate });
 *
 * // wrapper 없이 직접 사용
 * const result = await fetchElements(pageId);
 * if (!result.success) {
 *   console.error('에러:', result.error);
 * }
 * ```
 */
export const usePageManager = ({
  requestAutoSelectAfterUpdate,
}: UsePageManagerProps = {}): UsePageManagerReturn => {
  // 1. pages 관리: useListData (append/remove 자동)
  const pageList = useListData<ApiPage>({
    initialItems: [],
    getKey: (page) => page.id,
  });

  // 2. selectedPageId: 단순 state
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [isCreatingPage, setIsCreatingPage] = useState(false);

  // 3. 중복 초기화 방지
  const initializingRef = useRef<string | null>(null);
  const creatingPageRef = useRef(false);
  const pendingActivationFrameRef = useRef<number | null>(null);
  const pendingActivationPageIdRef = useRef<string | null>(null);

  const pages = useStore((state) => state.pages);
  const lazyLoadingEnabled = useStore((state) => state.lazyLoadingEnabled);

  const cancelPendingActivation = useCallback(() => {
    const taskId = pendingActivationFrameRef.current;
    if (taskId === null) return;

    if (typeof cancelAnimationFrame !== "undefined") {
      cancelAnimationFrame(taskId);
    } else {
      clearTimeout(taskId);
    }

    pendingActivationFrameRef.current = null;
    pendingActivationPageIdRef.current = null;
  }, []);

  const schedulePageActivation = useCallback(
    (pageId: string, elementId?: string | null) => {
      cancelPendingActivation();
      pendingActivationPageIdRef.current = pageId;

      pendingActivationFrameRef.current = scheduleNextFrame(() => {
        pendingActivationFrameRef.current = null;

        if (pendingActivationPageIdRef.current !== pageId) {
          return;
        }

        pendingActivationPageIdRef.current = null;
        startTransition(() => {
          useStore.getState().activatePage(pageId, elementId);
        });
      });
    },
    [cancelPendingActivation],
  );

  const runWithPageCreationLock = useCallback(
    async <T>(
      createPage: () => Promise<ApiResult<T>>,
    ): Promise<ApiResult<T>> => {
      if (creatingPageRef.current) {
        return {
          success: false,
          error: new Error("페이지 생성이 이미 진행 중입니다"),
        };
      }

      creatingPageRef.current = true;
      setIsCreatingPage(true);

      try {
        return await createPage();
      } finally {
        creatingPageRef.current = false;
        setIsCreatingPage(false);
      }
    },
    [],
  );

  const computeNextPagePosition = useCallback(() => {
    const { pagePositions } = useStore.getState();
    const canvasSize = useViewportSyncStore.getState().canvasSize;
    let maxX = 0;

    for (const pos of Object.values(pagePositions)) {
      const endX = pos.x + canvasSize.width + PAGE_STACK_GAP;
      if (endX > maxX) {
        maxX = endX;
      }
    }

    return { x: maxX, y: 0 };
  }, []);

  /**
   * fetchElements - 페이지 요소 로드
   * useCallback으로 래핑하여 불필요한 재생성 방지
   *
   * NOTE: Zustand의 setCurrentPageId는 안정적인 함수 참조이므로 dependency에서 제외 가능
   *
   * @returns ApiResult (성공 시 data, 실패 시 error)
   */
  const fetchElements = useCallback(
    async (pageId: string): Promise<ApiResult<Element[]>> => {
      if (!pageId) {
        return { success: false, error: new Error("pageId is required") };
      }

      try {
        const { elements, pageElementsSnapshot } = useStore.getState();
        const existingPageElements = pageElementsSnapshot[pageId] ?? [];

        setSelectedPageId(pageId);

        const bodyElement =
          existingPageElements.find((el) => el.type === "body") ??
          existingPageElements[0];

        // mergeElements 전에 auto-select 예약 — race condition 방지
        if (bodyElement && requestAutoSelectAfterUpdate) {
          requestAutoSelectAfterUpdate(bodyElement.id);
        }

        if (bodyElement) {
          useStore.getState().setSelectedElement(bodyElement.id);
        }

        return { success: true, data: elements };
      } catch (error) {
        console.error("요소 로드 에러:", error);
        return { success: false, error: error as Error };
      }
    },
    [requestAutoSelectAfterUpdate],
  );

  /**
   * addPage - 새 페이지 추가
   *
   * @returns ApiResult (성공 시 data, 실패 시 error)
   */
  const addPage = async (projectId: string): Promise<ApiResult<ApiPage>> => {
    return runWithPageCreationLock(async () => {
      try {
        const currentPages = useStore.getState().pages;
        const nextPageNumber = currentPages.length + 1;

        const newPageData: Page = {
          id: ElementUtils.generateId(),
          project_id: projectId,
          title: `Page ${nextPageNumber}`,
          slug: `/page-${nextPageNumber}`,
          parent_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // 새 페이지에 기본 body 요소 생성
        const bodyElement: Element = {
          id: ElementUtils.generateId(),
          type: "body",
          props: getDefaultProps("body") as ElementProps,
          parent_id: null,
          page_id: newPageData.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const newPage = newPageData;

        setSelectedPageId(newPage.id);

        const nextPosition = computeNextPagePosition();

        useStore
          .getState()
          .appendPageShell(newPage, bodyElement, nextPosition, {
            activate: false,
          });

        schedulePageActivation(newPage.id, bodyElement.id);

        console.log("✅ 페이지 추가 완료:", newPage.title);
        return { success: true, data: newPage };
      } catch (error) {
        console.error("페이지 생성 에러:", error);
        return { success: false, error: error as Error };
      }
    });
  };

  /**
   * addPageWithParams - 파라미터를 받아서 새 페이지 추가
   * ⭐ Nested Routes & Slug System: title, slug, layoutId, parentId를 지정하여 생성
   *
   * @returns ApiResult (성공 시 data, 실패 시 error)
   */
  const addPageWithParams = async (
    params: AddPageParams,
  ): Promise<ApiResult<ApiPage>> => {
    const { projectId, title, slug, layoutId = null, parentId = null } = params;

    return runWithPageCreationLock(async () => {
      try {
        const newPageData: Page = {
          id: ElementUtils.generateId(),
          project_id: projectId,
          title: title,
          slug: slug,
          parent_id: parentId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // 새 페이지에 기본 body 요소 생성
        const bodyElement: Element = {
          id: ElementUtils.generateId(),
          type: "body",
          props: getDefaultProps("body") as ElementProps,
          parent_id: null,
          page_id: newPageData.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const newPage = newPageData;

        setSelectedPageId(newPage.id);

        const nextPosition = computeNextPagePosition();
        useStore
          .getState()
          .appendPageShell(newPage, bodyElement, nextPosition, {
            activate: false,
          });

        if (layoutId) {
          cancelPendingActivation();
          useStore.getState().activatePage(newPage.id, bodyElement.id);
          setSelectedPageId(newPage.id);
        } else {
          schedulePageActivation(newPage.id, bodyElement.id);
        }

        console.log(
          "✅ 페이지 추가 완료 (with params):",
          newPage.title,
          "slug:",
          newPage.slug,
        );
        return { success: true, data: newPage };
      } catch (error) {
        console.error("페이지 생성 에러 (with params):", error);
        return { success: false, error: error as Error };
      }
    });
  };

  /**
   * initializeProject - 프로젝트 초기화
   * useCallback으로 래핑하여 불필요한 재생성 방지
   *
   * NOTE: pageList는 useListData의 결과로 매 렌더마다 새 객체를 반환하므로
   *       dependency에 포함하면 무한 루프 발생. 함수 내에서 직접 접근.
   *       Zustand 함수들(setPages, setCurrentPageId)은 안정적이므로 제외 가능.
   *
   * @returns ApiResult (성공 시 data, 실패 시 error)
   */
  const initializeProject = useCallback(
    async (projectId: string): Promise<ApiResult<ApiPage[]>> => {
      // 중복 호출 방지: 같은 프로젝트가 이미 초기화 중이면 스킵
      if (initializingRef.current === projectId) {
        return {
          success: false,
          error: new Error("프로젝트가 이미 초기화 중입니다"),
        };
      }

      try {
        initializingRef.current = projectId;

        const db = await getDB();
        const persistedDocument = await db.documents.get(projectId);

        const existingKeys = pageList.items.map((p) => p.id);
        if (existingKeys.length > 0) {
          pageList.remove(...existingKeys);
        }

        const {
          setPages,
          hydrateProjectSnapshot,
          initializePagePositions,
          setLazyLoadingEnabled,
          pageLayoutDirection,
        } = useStore.getState();

        const document =
          persistedDocument ??
          ({
            version: "composition-1.0",
            children: [],
          } satisfies CompositionDocument);

        useCanonicalDocumentStore.getState().setDocument(projectId, document);

        const renderModel = deriveProjectRenderModelFromDocument(
          document,
          projectId,
        );
        const apiPages: ApiPage[] = renderModel.pages.map((page) => ({
          ...page,
          created_at: page.created_at || new Date().toISOString(),
          updated_at: page.updated_at || new Date().toISOString(),
        }));
        const storePages = renderModel.pages.map((page) => ({
          ...page,
          parent_id: page.parent_id ?? null,
        }));

        hydrateProjectSnapshot(renderModel.elements as Element[]);
        apiPages.forEach((page) => pageList.append(page));
        setPages(storePages);

        // 🆕 Multi-page: 페이지 위치 초기화 (현재 방향 + canvasSize 기반)
        const currentCanvasSize = useViewportSyncStore.getState().canvasSize;
        initializePagePositions(
          storePages,
          currentCanvasSize.width,
          currentCanvasSize.height,
          PAGE_STACK_GAP,
          pageLayoutDirection,
        );

        setLazyLoadingEnabled(false);

        // 4. Home identity는 slug이고, 순서는 canonical children[] 입력 순서를 따른다.
        if (apiPages.length > 0) {
          const pageToSelect = selectInitialPage(apiPages);
          if (!pageToSelect) {
            initializingRef.current = null;
            return { success: true, data: apiPages };
          }
          const pageBodyCandidates = renderModel.elements.filter(
            (el) => el.page_id === pageToSelect.id,
          );
          const bodyElement =
            pageBodyCandidates.find((el) => el.type === "body") ??
            pageBodyCandidates[0];

          useStore.getState().activatePage(pageToSelect.id, bodyElement?.id);
          setSelectedPageId(pageToSelect.id);

          if (bodyElement) {
            if (requestAutoSelectAfterUpdate) {
              requestAutoSelectAfterUpdate(bodyElement.id);
            }
          }
        }

        initializingRef.current = null;
        return { success: true, data: apiPages };
      } catch (error) {
        console.error("프로젝트 초기화 에러:", error);
        initializingRef.current = null;
        return { success: false, error: error as Error };
      }
    },
    [pageList, requestAutoSelectAfterUpdate],
  );

  /**
   * loadPageIfNeeded - 페이지가 로드되지 않았으면 로드
   * 🚀 Phase 5: Lazy Loading 통합
   *
   * @param pageId - 로드할 페이지 ID
   */
  const loadPageIfNeeded = useCallback(
    async (pageId: string): Promise<void> => {
      if (!pageId) return;
      if (!lazyLoadingEnabled) return;

      const { isPageLoaded, lazyLoadPageElements } = useStore.getState();
      // 이미 로드됨 - 스킵
      if (isPageLoaded(pageId)) {
        console.log(
          `📦 [loadPageIfNeeded] Page already loaded: ${pageId.slice(0, 8)}`,
        );
        return;
      }

      // Lazy Load 실행
      console.log(`🔄 [loadPageIfNeeded] Loading page: ${pageId.slice(0, 8)}`);
      await lazyLoadPageElements(pageId);
    },
    [lazyLoadingEnabled],
  );

  return {
    pages,
    selectedPageId,
    setSelectedPageId,
    isCreatingPage,
    fetchElements,
    addPage,
    addPageWithParams,
    initializeProject,
    loadPageIfNeeded,
    pageList, // 직접 접근 (필요시)
  };
};

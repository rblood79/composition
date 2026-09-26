import { useState, useRef, useCallback } from "react";
import { observe } from "../utils/perfMarks";
import { useI18n } from "@/i18n";
import { useListData } from "react-stately";
import { Element } from "../../types/core/store.types";
import { type Page, getDefaultProps } from "../../types/builder/unified.types";

// (ADR-128) Page type 은 구 cloud row schema 기원이었지만 cloud data
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
import { readPageFrameSize } from "../workspace/canvas/scene/pageFrameSize";
// ADR-116 Phase 3 G4 — mutation reverse wrapper (D18=A 정합)
import { useCanonicalDocumentStore } from "../stores/canonical/canonicalDocumentStore";
import { useViewportSyncStore } from "../workspace/canvas/stores";
import type { ElementProps } from "../../types/builder/elementProps.types";
import { ElementUtils } from "../../utils/element/elementUtils";
import {
  deriveProjectEditorPageModelFromDocument,
  type CompositionDocument,
  isBodyType,
} from "@composition/shared";
import { canonicalDocumentToElements } from "../stores/canonical/canonicalElementsView";
import { countUserPagesForAutoName } from "../pages/systemComponentsPage";
import { normalizeMainDocument } from "../../adapters/canonical/mainDocumentNormalization";
import { resolvePageLayoutBounds } from "../workspace/canvas/pageLayoutConstants";
import {
  resolvePagePlacementHydration,
  resolveMigrationPanCorrection,
} from "../stores/utils/pagePlacementHydration";
import { isAssetWriterEnabled } from "../../utils/featureFlags";
import { scheduleAssetGc } from "../stores/assetGcScheduler";

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

/**
 * usePageManager - React Stately useListData 기반 페이지 관리
 *
 * wrapper 함수 불필요: 모든 함수가 에러를 return으로 처리
 * useCallback 사용: fetchElements, initializeProject는 메모이제이션됨 (무한 재렌더 방지)
 *
 * @example
 * ```tsx
 * const { pages, selectedPageId, fetchElements, addPage, initializeProject } = usePageManager();
 *
 * // wrapper 없이 직접 사용
 * const result = await fetchElements(pageId);
 * if (!result.success) {
 *   console.error('에러:', result.error);
 * }
 * ```
 */
/**
 * ADR-235 Phase 2 — 프로젝트 문서의 인라인 dataURL 을 자산으로 옮긴다 (lazy 모듈, store 는 주입).
 * 치환은 canonical 1차 (`setDocument`) → 파생 요소 갱신 → 기존 영속 구독 순서이고, history 에는
 * 남기지 않는다 (되돌림 경로 = 치환 전 강제 백업).
 */
function scheduleInlineAssetMigration(projectId: string): void {
  const run = () =>
    void import("../../lib/assets/assetMigration").then(
      async ({ migrateProjectInlineAssets }) => {
        const db = await getDB();
        const readCurrent = () => {
          const canonical = useCanonicalDocumentStore.getState();
          return canonical.currentProjectId === projectId
            ? canonical.documents.get(projectId)
            : null;
        };
        const result = await migrateProjectInlineAssets({
          getDocument: readCurrent,
          backupNow: () => db.documents.backupNow(projectId),
          apply: (next) => {
            useCanonicalDocumentStore.getState().setDocument(projectId, next);
            // 요소 mirror 를 새 문서의 projection 으로 (boot hydrate 와 같은 경로 — 선택 상태 무관)
            useStore
              .getState()
              .hydrateProjectSnapshot(
                canonicalDocumentToElements(next) as Element[],
              );
          },
        });
        if (result.status !== "none") {
          console.info("[assets] 인라인 자산 이관", projectId, result);
        }
      },
    );
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(run, { timeout: 3000 });
  } else {
    setTimeout(run, 500);
  }
}

export const usePageManager = (): UsePageManagerReturn => {
  const { t } = useI18n();
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

  const pages = useStore((state) => state.pages);
  const lazyLoadingEnabled = useStore((state) => state.lazyLoadingEnabled);

  const runWithPageCreationLock = useCallback(
    async <T>(
      createPage: () => Promise<ApiResult<T>>,
    ): Promise<ApiResult<T>> => {
      if (creatingPageRef.current) {
        return {
          success: false,
          error: new Error(t("errors.pageCreateInProgress")),
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
    [t],
  );

  // ADR-232 — 새 페이지의 좌표를 계산하지 않는다. 컨테이너 레이아웃이 다음 칸을 준다
  //   (`calculateNextPagePosition` · 뷰포트 bounds · frame 크기 사전 계산 전부 소멸).

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
          existingPageElements.find((el) => isBodyType(el.type)) ??
          existingPageElements[0];

        if (bodyElement) {
          useStore.getState().setSelectedElement(bodyElement.id);
        }

        return { success: true, data: elements };
      } catch (error) {
        console.error("요소 로드 에러:", error);
        return { success: false, error: error as Error };
      }
    },
    [],
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
        const nextPageNumber = countUserPagesForAutoName(currentPages) + 1;

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

        useStore.getState().appendPageShell(newPage, bodyElement, {
          activate: true,
        });

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

        useStore.getState().appendPageShell(newPage, bodyElement, {
          activate: true,
        });

        if (layoutId) {
          setSelectedPageId(newPage.id);
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
          error: new Error(t("errors.projectInitInProgress")),
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

        const { setPages, hydrateProjectSnapshot, setLazyLoadingEnabled } =
          useStore.getState();

        const baseDocument =
          persistedDocument ??
          ({
            version: "composition-1.0",
            children: [],
          } satisfies CompositionDocument);
        if (!persistedDocument) {
          // 2026-07-14 요소 소실 사건 근본 의심 경로: documents.get 이 (일시적으로)
          // null 을 반환하면 빈 fallback 이 아래 migration/ensure 체인을 통과하며
          // "fallback Home + 시스템 Components + template origins" skeleton 이 되고,
          // persist-back 이 실제 row 를 그 skeleton 으로 덮어써 영구 손실이 확정됐다.
          // 실측: 소실 후 row 가 정확히 skeleton 형상 (27 nodes). 진단 로그로 추적.
          console.error(
            "🚨 [initializeProject] documents row 미존재 — 빈 fallback 으로 " +
              `세션 진행 (project ${projectId}). persist-back 은 skip 된다. ` +
              "기존 프로젝트라면 IndexedDB read-miss 이상 신호.",
          );
        }
        // Option B (anchor-less): origin bootstrap + 기존 instance 의 in-tree template
        //   anchor strip 을 hydration 시점에 함께 수행. anchor 가 제거되면 document 참조가
        //   바뀌어 아래 persist-back 으로 IndexedDB 가 정리된다(멱등 — anchor 없으면 no-op).
        // ADR-923 r18m2 (2026-09-01): main document 정규화 체인 (origin 시드 + 형태 migration) 은
        //   `normalizeMainDocument` 단일 소유 — hydration (adapters/canonical) · 전체 문서 교체
        //   (applySnapshotDocument) 와 같은 함수.
        const document = observe("boot.normalize", () =>
          normalizeMainDocument(baseDocument),
        );
        // persist-back 은 "기존 row 를 읽은" 경우에만 — null read 에서 파생된
        // skeleton 을 write 하면 (read 가 일시 miss 였을 때) 실제 데이터를 덮어쓴다.
        // 신규 프로젝트 row 는 dashboard 생성 시점에 이미 기록되므로 여기서 만들 이유 없음.
        if (persistedDocument && document !== persistedDocument) {
          await db.documents.put(projectId, document, {
            reason: "hydration-migrate-back",
          });
        }

        observe("boot.canonical.publish", () =>
          useCanonicalDocumentStore.getState().setDocument(projectId, document),
        );

        const renderModel = observe("boot.pageModel", () =>
          deriveProjectEditorPageModelFromDocument(document, projectId),
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

        const canonicalElements = observe("boot.elements.project", () =>
          canonicalDocumentToElements(document),
        );
        observe("boot.elements.hydrate", () =>
          hydrateProjectSnapshot(canonicalElements as Element[]),
        );
        observe("boot.pageList.publish", () =>
          apiPages.forEach((page) => pageList.append(page)),
        );
        // ADR-232 — 페이지 위치 초기화가 없어졌다. 위치는 컨테이너 레이아웃 파생값이고,
        //   저장 좌표가 있는 옛 문서는 아래 이관이 placement 로 옮긴다.
        observe("boot.pages.publish", () => setPages(storePages));

        // ADR-232 Decision 6 — 저장 좌표 → placement 1회 이관. `placementModel` 이 이미
        //   있으면 no-op 이고, 엔진 미준비면 보류해 다음 hydration 이 다시 시도한다.
        //   `pagePositions` 는 지우지 않는다 (휴면 — 롤백 경로가 읽는다).
        observe("boot.pagePlacement.migrate", () => {
          const state = useStore.getState();
          const migration = resolvePagePlacementHydration({
            document,
            pages: storePages,
            elementsByPage: state.pageIndex.elementsByPage,
            elementsMap: state.elementsMap,
            activeBreakpoint: state.activeBreakpoint,
            pageContentHeights:
              useViewportSyncStore.getState().pageContentHeights,
          });
          if (!migration.patch) return;
          useCanonicalDocumentStore.getState().setPageLayout(migration.patch);
          // 이관 세션 안에서만 화면이 움직이지 않도록 pan 을 보정한다 (world 가 −H 만큼
          //   옮겨졌으므로 pan 은 +H × zoom). reload 뒤 화면 위치는 지금도 보존되지 않는다.
          if (migration.homeOrigin) {
            const viewport = useViewportSyncStore.getState();
            viewport.setPanOffset?.(
              resolveMigrationPanCorrection(
                viewport.panOffset,
                migration.homeOrigin,
                viewport.zoom,
              ),
            );
          }
        });

        setLazyLoadingEnabled(false);

        // 4. Home identity는 slug이고, 순서는 canonical children[] 입력 순서를 따른다.
        if (apiPages.length > 0) {
          const pageToSelect = selectInitialPage(apiPages);
          if (!pageToSelect) {
            initializingRef.current = null;
            return { success: true, data: apiPages };
          }
          const pageBodyCandidates = canonicalElements.filter(
            (el) => el.page_id === pageToSelect.id,
          );
          const bodyElement =
            pageBodyCandidates.find((el) => isBodyType(el.type)) ??
            pageBodyCandidates[0];

          observe("boot.page.activate", () =>
            useStore.getState().activatePage(pageToSelect.id, bodyElement?.id),
          );
          setSelectedPageId(pageToSelect.id);
        }

        // ADR-235 Phase 2 — 인라인 dataURL → 자산 이관 (로드 뒤 백그라운드 · 멱등 · 치환 전 백업).
        if (persistedDocument && isAssetWriterEnabled()) {
          scheduleInlineAssetMigration(projectId);
        }
        // ADR-235 Phase 3 — 자산 GC (idle · 하루 한 번)
        scheduleAssetGc();

        initializingRef.current = null;
        return { success: true, data: apiPages };
      } catch (error) {
        console.error("프로젝트 초기화 에러:", error);
        initializingRef.current = null;
        return { success: false, error: error as Error };
      }
    },
    [pageList, t],
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

/**
 * PagesSection - Pages 섹션 (메모이제이션 적용)
 *
 * NavigatorPanel에서 분리하여 pages 변경 시에만 리렌더링되도록 최적화
 */

import React, {
  memo,
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Key } from "react-stately";
import { Home, Search } from "lucide-react";
import { iconProps } from "../../../utils/ui/uiConstants";
import { useStore } from "../../stores";
import { usePageManager } from "@/builder/hooks";
import { ActionIconButton, Section } from "../../components";
import { ActionIconToggleButton } from "../../components/ui/ActionIconButton";
import { SearchField } from "../../components/ui/SearchField";
import { PageTree } from "./tree/PageTree";
import { NAVIGATOR_SECTION_IDS } from "./navigatorSectionIds";
import { filterPagesByQuery } from "./filterPagesByQuery";
import { getDB } from "../../../lib/db";
import type { Page } from "../../../types/builder/unified.types";
import { panToPage } from "../../workspace/canvas/viewport/panToPage";
import { isComponentsPageMirror } from "../../pages/systemComponentsPage";
import { enqueuePagePersistence } from "../../utils/pagePersistenceQueue";
import { useCanonicalDocumentStore } from "../../stores/canonical/canonicalDocumentStore";
import {
  scheduleBackgroundTask,
  scheduleNextFrame,
} from "../../utils/scheduleTask";
import { longTaskMonitor } from "../../../utils/longTaskMonitor";
import type { PanelNode } from "../panelNode";
import { ACTION_ICONS } from "../../config/actionIcons";
import { useI18n } from "../../../i18n";

/** 여러 화면에 공통으로 나오는 액션의 아이콘 정본 (`config/actionIcons.ts`). */
const AddIcon = ACTION_ICONS.add;

interface PagesSectionProps {
  projectId: string | undefined;
}

function findPageBodyElement(elements: readonly PanelNode[] | undefined) {
  return (
    elements?.find((element) => element.type.toLowerCase() === "body") ??
    elements?.[0] ??
    null
  );
}

export const PagesSection = memo(function PagesSection({
  projectId,
}: PagesSectionProps) {
  const { t } = useI18n();
  // 🚀 Pages만 구독 - elements 변경 시 리렌더링 안됨
  const pages = useStore((state) => state.pages);
  const currentPageId = useStore((state) => state.currentPageId);
  const deferredSelectedPageId = useDeferredValue(currentPageId);
  const activatePage = useStore((state) => state.activatePage);
  const removePageLocal = useStore((state) => state.removePageLocal);
  const renamePageTitle = useStore((state) => state.renamePageTitle);

  const { addPage, loadPageIfNeeded, isCreatingPage } = usePageManager();

  const [expandedKeys, setExpandedKeys] = useState<Set<Key>>(new Set());
  // Pages 검색 — 페이지가 많을 때 찾기용. 열려 있는 동안만 질의가 트리에 적용된다.
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [pageQuery, setPageQuery] = useState("");
  const [isFallbackTransitioning, setIsFallbackTransitioning] = useState(false);
  const [isRenamingSinglePage, setIsRenamingSinglePage] = useState(false);
  const singlePageRenameCancelRef = useRef(false);
  const singlePage = pages.length === 1 ? (pages[0] ?? null) : null;
  const canSearch = pages.length > 1;
  const autoSelectedPageIdRef = useRef<string | null>(null);
  const activatedPageIdRef = useRef<string | null>(null);

  const pageQueryResult = useMemo(
    () => filterPagesByQuery(pages, isSearchOpen ? pageQuery : ""),
    [isSearchOpen, pageQuery, pages],
  );
  // 검색 중에는 일치 항목의 조상을 강제로 펼친다 (사용자 펼침 상태 위에 합집합)
  const treeExpandedKeys = useMemo(() => {
    if (pageQueryResult.expandIds.size === 0) return expandedKeys;
    return new Set<Key>([...expandedKeys, ...pageQueryResult.expandIds]);
  }, [expandedKeys, pageQueryResult.expandIds]);

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
    setPageQuery("");
  }, []);

  const handleSearchToggle = useCallback(
    (selected: boolean) => {
      if (selected) {
        setIsSearchOpen(true);
      } else {
        closeSearch();
      }
    },
    [closeSearch],
  );

  // 페이지 추가 핸들러
  const handleAddPage = useCallback(async () => {
    if (!projectId) {
      console.error("프로젝트 ID가 없습니다");
      return;
    }
    await longTaskMonitor.measureAsync("perf:pages.add-click", async () => {
      return await addPage(projectId);
    });
  }, [projectId, addPage]);

  // ADR-040 Phase 2: 페이지 선택 — 즉시 activation + 백그라운드 로드
  const handlePageSelect = useCallback(
    (page: Page, options?: { pan?: boolean }) => {
      if (options?.pan !== false) {
        panToPage(page.id);
      }

      // 현재 snapshot에서 body 조회 (로드 대기 없이 즉시 activation)
      const selectLoadedPageBody = () => {
        const pageBodyElement = findPageBodyElement(
          useStore.getState().pageElementsSnapshot[page.id],
        );
        startTransition(() => {
          activatePage(page.id, pageBodyElement?.id ?? null);
        });
        return pageBodyElement;
      };

      const pageBodyElement = selectLoadedPageBody();

      if (currentPageId !== page.id || !pageBodyElement) {
        // 백그라운드: 미로드 페이지면 lazy load (activation 후 snapshot 보강)
        void loadPageIfNeeded(page.id).then(() => {
          if (pageBodyElement) return;

          const hydratedBodyElement = findPageBodyElement(
            useStore.getState().pageElementsSnapshot[page.id],
          );
          if (!hydratedBodyElement) return;

          startTransition(() => {
            activatePage(page.id, hydratedBodyElement.id);
          });
        });
      }
    },
    [activatePage, currentPageId, loadPageIfNeeded],
  );

  useEffect(() => {
    const firstPage = pages[0] ?? null;
    // Project model always has Home; this only covers transient hydration/test states.
    if (!firstPage) {
      autoSelectedPageIdRef.current = null;
      return;
    }

    const hasValidSelection = Boolean(
      currentPageId && pages.some((page) => page.id === currentPageId),
    );
    if (hasValidSelection) {
      autoSelectedPageIdRef.current = null;
      return;
    }

    if (autoSelectedPageIdRef.current === firstPage.id) return;
    autoSelectedPageIdRef.current = firstPage.id;
    handlePageSelect(firstPage);
  }, [currentPageId, handlePageSelect, pages]);

  useEffect(() => {
    if (!currentPageId) {
      activatedPageIdRef.current = null;
      return;
    }

    if (!pages.some((page) => page.id === currentPageId)) {
      activatedPageIdRef.current = null;
      return;
    }

    if (activatedPageIdRef.current === currentPageId) return;
    activatedPageIdRef.current = currentPageId;

    startTransition(() => {
      activatePage(currentPageId);
    });
    void loadPageIfNeeded(currentPageId);
  }, [activatePage, currentPageId, loadPageIfNeeded, pages]);

  const handleSinglePageKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!singlePage) return;
      if (event.key !== "Enter" && event.key !== " ") return;

      event.preventDefault();
      handlePageSelect(singlePage);
    },
    [handlePageSelect, singlePage],
  );

  const handlePageRename = useCallback(
    (page: Page, title: string) => {
      if (isComponentsPageMirror(page)) return;
      renamePageTitle(page.id, title);
    },
    [renamePageTitle],
  );

  const commitSinglePageRename = useCallback(
    (page: Page, title: string) => {
      setIsRenamingSinglePage(false);
      if (singlePageRenameCancelRef.current) {
        singlePageRenameCancelRef.current = false;
        return;
      }
      handlePageRename(page, title);
    },
    [handlePageRename],
  );

  // 페이지 삭제 핸들러
  const handlePageDelete = useCallback(
    async (page: Page) => {
      if (isComponentsPageMirror(page)) return;

      const currentState = useStore.getState();
      const deletingCurrentPage = currentState.currentPageId === page.id;
      const pageIndex = pages.findIndex(
        (candidate) => candidate.id === page.id,
      );
      const remainingPages = pages.filter((p) => p.id !== page.id);
      const previousPage =
        pageIndex > 0 ? (pages[pageIndex - 1] ?? null) : null;
      const nextPage = pageIndex >= 0 ? (pages[pageIndex + 1] ?? null) : null;
      const pageToSelect =
        remainingPages.find((candidate) => candidate.id === previousPage?.id) ??
        remainingPages.find((candidate) => candidate.id === nextPage?.id) ??
        remainingPages[0] ??
        null;
      const nextBodyElement = pageToSelect
        ? findPageBodyElement(
            currentState.pageElementsSnapshot[pageToSelect.id],
          )
        : null;

      const loadedNextBodyElement = pageToSelect
        ? (findPageBodyElement(
            useStore.getState().pageElementsSnapshot[pageToSelect.id],
          ) ?? nextBodyElement)
        : null;

      // 대상 페이지가 이미 로드됐으면 fallback transition 스킵 (깜빡임 방지)
      const targetPageElements = pageToSelect
        ? currentState.pageElementsSnapshot[pageToSelect.id]
        : undefined;
      const isTargetLoaded =
        !!targetPageElements && targetPageElements.length > 0;
      if (deletingCurrentPage && pageToSelect && !isTargetLoaded) {
        setIsFallbackTransitioning(true);
      }

      startTransition(() => {
        removePageLocal(
          page.id,
          deletingCurrentPage && pageToSelect
            ? {
                pageId: pageToSelect.id,
                elementId: null,
              }
            : undefined,
        );
      });

      if (deletingCurrentPage && pageToSelect) {
        scheduleNextFrame(() => {
          startTransition(() => {
            activatePage(pageToSelect.id, loadedNextBodyElement?.id ?? null);
          });
          scheduleBackgroundTask(() => {
            setIsFallbackTransitioning(false);
          });
        });

        if (!loadedNextBodyElement) {
          scheduleBackgroundTask(() => {
            void loadPageIfNeeded(pageToSelect.id).then(() => {
              const hydratedBodyElement =
                findPageBodyElement(
                  useStore.getState().pageElementsSnapshot[pageToSelect.id],
                ) ?? null;

              if (!hydratedBodyElement) {
                return;
              }

              startTransition(() => {
                activatePage(pageToSelect.id, hydratedBodyElement.id);
              });
              scheduleBackgroundTask(() => {
                setIsFallbackTransitioning(false);
              });
            });
          });
        } else {
          scheduleBackgroundTask(() => {
            setIsFallbackTransitioning(false);
          });
        }
      } else {
        setIsFallbackTransitioning(false);
      }

      // 2. 영속화는 백그라운드에서 직렬 처리
      enqueuePagePersistence(async () => {
        try {
          const canonical = useCanonicalDocumentStore.getState();
          const activeProjectId = canonical.currentProjectId ?? projectId;
          const doc = activeProjectId
            ? canonical.documents.get(activeProjectId)
            : null;
          if (!activeProjectId || !doc) return;
          const db = await getDB();
          // 페이지 삭제는 의도된 대량 감소 — 급감 가드 명시 통과
          await db.documents.put(activeProjectId, doc, {
            allowShrink: true,
            reason: "page-delete",
          });
        } catch (error) {
          console.error("페이지 삭제 에러:", error);
        }
      });
    },
    [activatePage, loadPageIfNeeded, pages, projectId, removePageLocal],
  );

  return (
    <Section
      id={NAVIGATOR_SECTION_IDS.pages}
      className="node-tree-section"
      title={t("navigator.pages")}
      actions={
        <>
          {canSearch && (
            <ActionIconToggleButton
              aria-label={t("navigator.searchPages")}
              tooltip={t("navigator.searchPages")}
              isSelected={isSearchOpen}
              onChange={handleSearchToggle}
            >
              <Search
                color={iconProps.color}
                strokeWidth={iconProps.strokeWidth}
                size={iconProps.size}
              />
            </ActionIconToggleButton>
          )}
          <ActionIconButton
            aria-label={t("navigator.addPage")}
            tooltip={t("navigator.addPage")}
            isDisabled={isCreatingPage}
            onPress={handleAddPage}
          >
            <AddIcon
              color={iconProps.color}
              strokeWidth={iconProps.strokeWidth}
              size={iconProps.size}
            />
          </ActionIconButton>
        </>
      }
    >
      {isSearchOpen && canSearch && (
        <SearchField
          className="page-search-field"
          autoFocus
          value={pageQuery}
          onChange={setPageQuery}
          placeholder={t("navigator.searchPages")}
          aria-label={t("navigator.searchPages")}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              closeSearch();
            }
          }}
        />
      )}
      {isFallbackTransitioning ? (
        <div aria-hidden="true" style={{ minHeight: 120 }} />
      ) : singlePage ? (
        <div
          className="elementItem active"
          role="button"
          tabIndex={0}
          aria-label={`Select page ${singlePage.title || "Untitled"}`}
          onClick={(event) => {
            const target = event.target;
            if (target instanceof HTMLElement && target.closest("input"))
              return;
            handlePageSelect(singlePage);
          }}
          onDoubleClick={(event) => {
            const target = event.target;
            if (target instanceof HTMLElement && target.closest("input"))
              return;
            if (isComponentsPageMirror(singlePage)) return;
            singlePageRenameCancelRef.current = false;
            setIsRenamingSinglePage(true);
          }}
          onKeyDown={handleSinglePageKeyDown}
        >
          <div className="elementItemIndent" style={{ width: "0px" }} />
          <div className="elementItemIcon">
            <Home
              color={iconProps.color}
              strokeWidth={iconProps.strokeWidth}
              size={iconProps.size}
              style={{ padding: "2px" }}
            />
          </div>
          <div className="elementItemLabel">
            {isRenamingSinglePage ? (
              <input
                className="page-title-rename-input"
                aria-label={`Rename page ${singlePage.title || "Untitled"}`}
                defaultValue={singlePage.title}
                autoFocus
                onFocus={(event) => event.currentTarget.select()}
                onPointerDown={(event) => event.stopPropagation()}
                onBlur={(event) =>
                  commitSinglePageRename(singlePage, event.currentTarget.value)
                }
                onKeyDown={(event) => {
                  event.stopPropagation();
                  if (event.key === "Enter") {
                    event.preventDefault();
                    event.currentTarget.blur();
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    singlePageRenameCancelRef.current = true;
                    event.currentTarget.blur();
                  }
                }}
              />
            ) : (
              singlePage.title || "Untitled"
            )}
          </div>
        </div>
      ) : pageQueryResult.query && pageQueryResult.matchCount === 0 ? (
        <div className="page-search-empty" role="status">
          {t("navigator.noPagesMatch")}
        </div>
      ) : (
        <PageTree
          pages={pageQueryResult.pages}
          selectedPageId={deferredSelectedPageId}
          expandedKeys={treeExpandedKeys}
          onExpandedChange={setExpandedKeys}
          onPageSelect={handlePageSelect}
          onPageDelete={handlePageDelete}
          onPageRename={handlePageRename}
        />
      )}
    </Section>
  );
});

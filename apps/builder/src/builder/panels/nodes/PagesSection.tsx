/**
 * PagesSection - Pages 섹션 (메모이제이션 적용)
 *
 * NodesPanel에서 분리하여 pages 변경 시에만 리렌더링되도록 최적화
 */

import React, {
  memo,
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Key } from "react-stately";
import { Button } from "react-aria-components";
import { CirclePlus, Home } from "lucide-react";
import { iconProps } from "../../../utils/ui/uiConstants";
import { useStore } from "../../stores";
import { useIframeMessenger, usePageManager } from "@/builder/hooks";
import { PanelHeader } from "../../components";
import { PageTree } from "./tree/PageTree";
import { getDB } from "../../../lib/db";
import type { Page } from "../../../types/builder/unified.types";
import { panToPage } from "../../workspace/canvas/viewport/panToPage";
import { enqueuePagePersistence } from "../../utils/pagePersistenceQueue";
import { useCanonicalDocumentStore } from "../../stores/canonical/canonicalDocumentStore";
import { visitCanonicalDocumentElements } from "../../stores/canonical/canonicalElementsView";
import { setElementsCanonicalPrimary } from "../../../adapters/canonical/canonicalMutations";
import {
  scheduleBackgroundTask,
  scheduleNextFrame,
} from "../../utils/scheduleTask";
import { longTaskMonitor } from "../../../utils/longTaskMonitor";
import type { PanelNode } from "../panelNode";

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

function getActiveCanonicalPageElements(): PanelNode[] | null {
  const canonical = useCanonicalDocumentStore.getState();
  const projectId = canonical.currentProjectId;
  if (!projectId) return null;

  const doc = canonical.documents.get(projectId);
  if (!doc) return null;

  const elements: PanelNode[] = [];
  visitCanonicalDocumentElements(doc, (element) => {
    elements.push(element);
  });
  return elements;
}

export const PagesSection = memo(function PagesSection({
  projectId,
}: PagesSectionProps) {
  // 🚀 Pages만 구독 - elements 변경 시 리렌더링 안됨
  const pages = useStore((state) => state.pages);
  const currentPageId = useStore((state) => state.currentPageId);
  const deferredSelectedPageId = useDeferredValue(currentPageId);
  const activatePage = useStore((state) => state.activatePage);
  const removePageLocal = useStore((state) => state.removePageLocal);

  // Hooks
  const { requestAutoSelectAfterUpdate } = useIframeMessenger();
  const { addPage, loadPageIfNeeded, isCreatingPage } = usePageManager({
    requestAutoSelectAfterUpdate,
  });

  const [expandedKeys, setExpandedKeys] = useState<Set<Key>>(new Set());
  const [isFallbackTransitioning, setIsFallbackTransitioning] = useState(false);
  const singlePage = pages.length === 1 ? (pages[0] ?? null) : null;
  const autoSelectedPageIdRef = useRef<string | null>(null);
  const activatedPageIdRef = useRef<string | null>(null);

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
        if (pageBodyElement) {
          requestAutoSelectAfterUpdate(pageBodyElement.id);
        }
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
          requestAutoSelectAfterUpdate(hydratedBodyElement.id);
        });
      }
    },
    [
      activatePage,
      currentPageId,
      loadPageIfNeeded,
      requestAutoSelectAfterUpdate,
    ],
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

  // 페이지 삭제 핸들러
  const handlePageDelete = useCallback(
    async (page: Page) => {
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

      const latestState = useStore.getState();
      setElementsCanonicalPrimary(
        getActiveCanonicalPageElements() ?? latestState.elements,
      );

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
          await db.documents.put(activeProjectId, doc);
        } catch (error) {
          console.error("페이지 삭제 에러:", error);
        }
      });
    },
    [activatePage, loadPageIfNeeded, pages, projectId, removePageLocal],
  );

  return (
    <div className="section">
      <PanelHeader
        title="Pages"
        actions={
          <Button
            className="iconButton"
            aria-label="Add Page"
            isDisabled={isCreatingPage}
            onPress={handleAddPage}
          >
            <CirclePlus
              color={iconProps.color}
              strokeWidth={iconProps.strokeWidth}
              size={iconProps.size}
            />
          </Button>
        }
      />
      <div className="section-content">
        {isFallbackTransitioning ? (
          <div aria-hidden="true" style={{ minHeight: 120 }} />
        ) : singlePage ? (
          <div
            className="elementItem active"
            role="button"
            tabIndex={0}
            aria-label={`Select page ${singlePage.title || "Untitled"}`}
            onClick={() => handlePageSelect(singlePage)}
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
              {singlePage.title || "Untitled"}
            </div>
          </div>
        ) : (
          <PageTree
            pages={pages}
            selectedPageId={deferredSelectedPageId}
            expandedKeys={expandedKeys}
            onExpandedChange={setExpandedKeys}
            onPageSelect={handlePageSelect}
            onPageDelete={handlePageDelete}
          />
        )}
      </div>
    </div>
  );
});

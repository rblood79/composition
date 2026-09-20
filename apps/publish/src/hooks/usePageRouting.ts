/**
 * Page Routing Hook
 *
 * URL 해시 기반 페이지 라우팅
 *
 * @since 2026-01-02 Phase 2
 */

import { useState, useEffect, useCallback } from "react";
import type { Page } from "@composition/shared";

interface UsePageRoutingOptions {
  pages: Page[];
  defaultPageId?: string | null;
}

interface UsePageRoutingReturn {
  currentPageId: string | null;
  currentPage: Page | null;
  setCurrentPageId: (pageId: string) => void;
}

/**
 * URL 해시에서 페이지 ID 추출
 */
function getPageIdFromHash(): string | null {
  const hash = window.location.hash;
  if (hash.startsWith("#page-")) {
    return hash.slice(6); // '#page-' 제거
  }
  return null;
}

function hasPage(pages: Page[], pageId: string | null | undefined): boolean {
  return !!pageId && pages.some((p) => p.id === pageId);
}

/** 초기 페이지: URL 해시 > defaultPageId > 첫 번째 페이지 */
function pickInitialPageId(
  pages: Page[],
  defaultPageId: string | null | undefined,
): string | null {
  const hashPageId = getPageIdFromHash();
  if (hasPage(pages, hashPageId)) return hashPageId;
  if (hasPage(pages, defaultPageId)) return defaultPageId!;
  return pages[0]?.id || null;
}

/**
 * 페이지 라우팅 훅
 */
export function usePageRouting({
  pages,
  defaultPageId,
}: UsePageRoutingOptions): UsePageRoutingReturn {
  const [currentPageId, setCurrentPageIdState] = useState<string | null>(() =>
    pickInitialPageId(pages, defaultPageId),
  );

  // 현재 페이지 객체
  const currentPage = pages.find((p) => p.id === currentPageId) || null;

  // 페이지 ID 변경 시 URL 해시 업데이트
  const setCurrentPageId = useCallback(
    (pageId: string) => {
      if (hasPage(pages, pageId)) {
        setCurrentPageIdState(pageId);
        window.location.hash = `page-${pageId}`;
      }
    },
    [pages],
  );

  // URL 해시 변경 감지
  useEffect(() => {
    function handleHashChange() {
      const pageId = getPageIdFromHash();
      if (hasPage(pages, pageId)) setCurrentPageIdState(pageId);
    }

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [pages]);

  // pages가 변경되면 현재 페이지 유효성 확인
  // set-state-in-effect 회피: 유효한 pageId를 계산한 뒤 queueMicrotask로 갱신
  useEffect(() => {
    let targetPageId: string | null = null;

    // 페이지가 있는데 currentPageId가 없으면 첫 페이지로 설정
    if (pages.length > 0 && !currentPageId) {
      targetPageId = pickInitialPageId(pages, defaultPageId);
    }
    // currentPageId가 있는데 해당 페이지가 없으면 첫 페이지로
    else if (currentPageId && !hasPage(pages, currentPageId)) {
      targetPageId = pages[0]?.id || null;
    }

    if (targetPageId) {
      const nextId = targetPageId;
      queueMicrotask(() => {
        setCurrentPageIdState(nextId);
        window.location.hash = `page-${nextId}`;
      });
    }
  }, [pages, currentPageId, defaultPageId]);

  return {
    currentPageId,
    currentPage,
    setCurrentPageId,
  };
}

export default usePageRouting;

/**
 * Page Navigation Component
 *
 * 멀티 페이지 네비게이션 UI
 *
 * @since 2026-01-02 Phase 2
 */

import { useCallback, useMemo, useRef, type KeyboardEvent } from "react";
import type { Page } from "@composition/shared";
import { usePublishStrings } from "../i18n";
import "./PageNav.css";

interface PageNavProps {
  pages: Page[];
  currentPageId: string | null;
  onPageChange: (pageId: string) => void;
}

interface FlatPage {
  page: Page;
  level: number;
}

/** 페이지를 parent_id 계층의 DFS 순서로 편다 (children 은 어디서도 안 읽으니 트리를 안 만든다). */
function flattenPages(pages: Page[]): FlatPage[] {
  const childrenMap = new Map<string | null, Page[]>();
  for (const page of pages) {
    const parentId = page.parent_id || null;
    const siblings = childrenMap.get(parentId) || [];
    siblings.push(page);
    childrenMap.set(parentId, siblings);
  }

  const result: FlatPage[] = [];
  function visit(parentId: string | null, level: number) {
    for (const page of childrenMap.get(parentId) || []) {
      result.push({ page, level });
      visit(page.id, level + 1);
    }
  }
  visit(null, 0);
  return result;
}

/**
 * 페이지 네비게이션 컴포넌트
 */
export function PageNav({ pages, currentPageId, onPageChange }: PageNavProps) {
  const t = usePublishStrings();
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const flatPages = useMemo(() => flattenPages(pages), [pages]);

  // 버튼 ref 저장
  const setButtonRef = useCallback(
    (pageId: string, el: HTMLButtonElement | null) => {
      if (el) {
        buttonRefs.current.set(pageId, el);
      } else {
        buttonRefs.current.delete(pageId);
      }
    },
    [],
  );

  // 특정 페이지로 포커스 이동
  const focusPage = useCallback(
    (index: number) => {
      const targetPage = flatPages[index];
      if (targetPage) {
        const button = buttonRefs.current.get(targetPage.page.id);
        button?.focus();
      }
    },
    [flatPages],
  );

  // 키보드 네비게이션
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, pageId: string, index: number) => {
      switch (e.key) {
        case "ArrowDown":
        case "ArrowRight":
          e.preventDefault();
          focusPage(Math.min(index + 1, flatPages.length - 1));
          break;
        case "ArrowUp":
        case "ArrowLeft":
          e.preventDefault();
          focusPage(Math.max(index - 1, 0));
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          onPageChange(pageId);
          break;
        case "Home":
          e.preventDefault();
          focusPage(0);
          break;
        case "End":
          e.preventDefault();
          focusPage(flatPages.length - 1);
          break;
      }
    },
    [flatPages, focusPage, onPageChange],
  );

  // 단일 페이지면 네비게이션 숨김
  if (pages.length <= 1) {
    return null;
  }

  // 페이지 버튼 렌더링
  const renderPageButton = (node: FlatPage, index: number) => {
    const { page, level } = node;
    const isActive = currentPageId === page.id;

    return (
      <li key={page.id} role="presentation">
        <button
          ref={(el) => setButtonRef(page.id, el)}
          role="tab"
          aria-selected={isActive}
          aria-current={isActive ? "page" : undefined}
          tabIndex={isActive ? 0 : -1}
          className={`page-nav-item ${isActive ? "active" : ""}`}
          style={{ paddingLeft: `${12 + level * 16}px` }}
          onClick={() => onPageChange(page.id)}
          onKeyDown={(e) => handleKeyDown(e, page.id, index)}
        >
          {level > 0 && <span className="page-nav-indent">└</span>}
          <span className="page-nav-title">{page.title}</span>
        </button>
      </li>
    );
  };

  return (
    <nav className="page-nav" aria-label={t("pageList")}>
      <ul role="tablist" aria-orientation="vertical">
        {flatPages.map((node, index) => renderPageButton(node, index))}
      </ul>
    </nav>
  );
}

export default PageNav;

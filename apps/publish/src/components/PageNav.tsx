/**
 * Page Navigation Component
 *
 * 멀티 페이지 네비게이션 UI
 *
 * @since 2026-01-02 Phase 2
 */

import { useCallback, useRef, type KeyboardEvent } from "react";
import type { Page } from "@composition/shared";
import "./PageNav.css";

interface PageNavProps {
  pages: Page[];
  currentPageId: string | null;
  onPageChange: (pageId: string) => void;
}

interface PageTreeNode {
  page: Page;
  children: PageTreeNode[];
  level: number;
}

/**
 * 페이지를 트리 구조로 변환
 */
function buildPageTree(pages: Page[]): PageTreeNode[] {
  const childrenMap = new Map<string | null, Page[]>();

  // 부모별로 자식 페이지 그룹화
  for (const page of pages) {
    const parentId = page.parent_id || null;
    const siblings = childrenMap.get(parentId) || [];
    siblings.push(page);
    childrenMap.set(parentId, siblings);
  }

  // 재귀적으로 트리 구축
  function buildNodes(parentId: string | null, level: number): PageTreeNode[] {
    const children = childrenMap.get(parentId) || [];

    return children.map((page) => ({
      page,
      children: buildNodes(page.id, level + 1),
      level,
    }));
  }

  return buildNodes(null, 0);
}

/**
 * 트리를 평탄화하여 순서대로 배열
 */
function flattenTree(nodes: PageTreeNode[]): PageTreeNode[] {
  const result: PageTreeNode[] = [];

  function traverse(nodeList: PageTreeNode[]) {
    for (const node of nodeList) {
      result.push(node);
      traverse(node.children);
    }
  }

  traverse(nodes);
  return result;
}

/**
 * 페이지 네비게이션 컴포넌트
 */
export function PageNav({ pages, currentPageId, onPageChange }: PageNavProps) {
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // 페이지 트리 구축
  const pageTree = buildPageTree(pages);
  const flatPages = flattenTree(pageTree);

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
  const renderPageButton = (node: PageTreeNode, index: number) => {
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
    <nav className="page-nav" aria-label="페이지 목록">
      <ul role="tablist" aria-orientation="vertical">
        {flatPages.map((node, index) => renderPageButton(node, index))}
      </ul>
    </nav>
  );
}

export default PageNav;

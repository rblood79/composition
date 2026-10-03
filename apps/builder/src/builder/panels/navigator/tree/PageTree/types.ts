import type { Key } from "react-stately";
import type { Page } from "../../../../../types/builder/unified.types";

/** What the page tree reads of a page (the old `Page` and the catalog page adapter both fit). */
export interface PageTreePage {
  id: string;
  title: string;
  slug?: string | null;
  parent_id?: string | null;
  pageRole?: string | null;
}

export interface PageTreeNode<P extends PageTreePage = Page> {
  id: string;
  name: string; // title || "Untitled"
  slug: string | null;
  parentId: string | null;
  depth: number;
  hasChildren: boolean;
  isLeaf: boolean;
  children?: PageTreeNode<P>[];
  page: P; // 원본 Page 참조

  // 제약 조건
  isRoot: boolean; // Home 페이지 여부
  isSystemPage: boolean; // Components 등 editor-only system page 여부
  isDraggable: boolean; // !isRoot
  isDroppable: boolean; // 항상 true (페이지는 virtual child 없음)
}

export interface PageTreeProps {
  pages: Page[];
  selectedPageId: string | null;
  expandedKeys?: Set<Key>;
  onExpandedChange?: (keys: Set<Key>) => void;
  onPageSelect: (page: Page) => void;
  onPageDelete: (page: Page) => Promise<void>;
  onPageSettings?: (page: Page) => void;
  onPageRename?: (page: Page, title: string) => void;
}

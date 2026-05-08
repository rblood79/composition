import type { Key } from "react-stately";
import type { Page } from "../../../../../types/builder/unified.types";

export interface PageTreeNode {
  id: string;
  name: string; // title || "Untitled"
  slug: string | null;
  parentId: string | null;
  depth: number;
  hasChildren: boolean;
  isLeaf: boolean;
  children?: PageTreeNode[];
  page: Page; // 원본 Page 참조

  // 제약 조건
  isRoot: boolean; // Home 페이지 여부
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
}

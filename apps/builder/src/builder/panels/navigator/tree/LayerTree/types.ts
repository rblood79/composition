import type { ElementProps } from "../../../../../types/integrations/supabase.types";
import type { PanelNode } from "../../../panelNode";

export type VirtualChildType =
  | "toggle"
  | "checkbox"
  | "radio"
  | "tree"
  | "listbox-rows"
  | "listbox-row"
  // ADR-912 단계 4 C1: GridList projected row/rows virtual child.
  | "gridlist-rows"
  | "gridlist-row"
  // ADR-912 단계 4 C1: Table 2D projected rows/row/cell virtual child.
  | "table-rows"
  | "table-row"
  | "table-cell";

export interface LayerTreeNode {
  id: string;
  name: string;
  type: string;
  parentId: string | null;
  depth: number;
  hasChildren: boolean;
  isLeaf: boolean;
  children?: LayerTreeNode[];
  element: PanelNode;
  isSyntheticRefChild?: boolean;
  virtualChildType?: VirtualChildType;
  virtualChildIndex?: number;
  virtualChildData?: unknown;
}

export interface LayerTreeProps {
  elements: PanelNode[];
  selectedElementId: string | null;
  /**
   * 다중 선택 전체. 캔버스 shift 클릭으로 만들어진 선택도 여기로 들어와 트리에
   * 함께 표시된다. 생략하면 `selectedElementId` 단독으로 동작한다.
   */
  selectedElementIds?: readonly string[];
  selectedTab?: { parentId: string; tabIndex: number } | null;
  expandedKeys?: Set<string | number>;
  onExpandedChange?: (keys: Set<string | number>) => void;
  /**
   * 선택 결과 전체를 넘긴다 (가상 자식 행은 걸러진 뒤). 빈 배열은 선택 해제다.
   */
  onSelectionChange: (elements: PanelNode[]) => void;
  onItemDelete: (element: PanelNode) => Promise<void>;
  onSelectTabElement?: (
    parentId: string,
    props: ElementProps,
    index: number,
  ) => void;
}

import type { ElementProps } from "../../../../../types/integrations/supabase.types";
import type { PanelNode } from "../../../panelNode";

export type VirtualChildType = "toggle" | "checkbox" | "radio" | "tree";

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
  selectedTab?: { parentId: string; tabIndex: number } | null;
  expandedKeys?: Set<string | number>;
  onExpandedChange?: (keys: Set<string | number>) => void;
  onItemClick: (element: PanelNode) => void;
  onItemDelete: (element: PanelNode) => Promise<void>;
  onSelectTabElement?: (
    parentId: string,
    props: ElementProps,
    index: number,
  ) => void;
}

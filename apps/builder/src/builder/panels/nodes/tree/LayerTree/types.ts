import type { Element } from "../../../../../types/core/store.types";
import type { ElementProps } from "../../../../../types/integrations/supabase.types";

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
  element: Element;
  isSyntheticRefChild?: boolean;
  virtualChildType?: VirtualChildType;
  virtualChildIndex?: number;
  virtualChildData?: unknown;
}

export interface LayerTreeProps {
  elements: Element[];
  selectedElementId: string | null;
  selectedTab?: { parentId: string; tabIndex: number } | null;
  expandedKeys?: Set<string | number>;
  onExpandedChange?: (keys: Set<string | number>) => void;
  onItemClick: (element: Element) => void;
  onItemDelete: (element: Element) => Promise<void>;
  onSelectTabElement?: (
    parentId: string,
    props: ElementProps,
    index: number,
  ) => void;
}

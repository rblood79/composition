import type { Key } from "react-stately";
import type { DragAndDropOptions } from "react-aria-components";

// ============================================
// 공통 타입
// ============================================

export type DropPosition = "before" | "after" | "on";

/**
 * 모든 Tree 노드가 구현해야 하는 기본 인터페이스
 */
export interface BaseTreeNode {
  id: string;
  parentId: string | null;
  depth: number;
  hasChildren: boolean;
  children?: BaseTreeNode[];
}

/**
 * DnD 이동 시 전달되는 페이로드
 * updates 계산은 도메인 코드에서 담당
 */
export interface MovePayload<TNode extends BaseTreeNode> {
  keys: Set<Key>;
  target: {
    key: Key;
    node: TNode;
    dropPosition: DropPosition;
  };
}

/**
 * TreeItem 상태
 */
export interface TreeItemState {
  isSelected: boolean;
  isExpanded: boolean;
  isDisabled: boolean;
  isFocusVisible: boolean;
}

/**
 * DnD 설정
 */
export interface TreeBaseDndConfig<TNode extends BaseTreeNode> {
  /** 드래그 가능 여부 */
  canDrag: (node: TNode) => boolean;
  /** Drop 유효성 검사 */
  isValidDrop: (
    draggedKey: Key,
    targetKey: Key,
    position: DropPosition,
  ) => boolean;
  /** 이동 완료 콜백 */
  onMove: (payload: MovePayload<TNode>) => void;
  /** Drag MIME 타입 */
  dragType?: string;
  /** Cursor 아래에 표시되는 drag preview renderer */
  renderDragPreview?: DragAndDropOptions<TNode>["renderDragPreview"];
}

/**
 * TreeBase 컴포넌트 Props
 */
export interface TreeBaseProps<TNode extends BaseTreeNode> {
  // 필수
  items: TNode[];
  getKey: (node: TNode) => Key;
  getTextValue: (node: TNode) => string;
  renderContent: (node: TNode, state: TreeItemState) => React.ReactNode;

  // 상태 (Controlled)
  selectedKeys?: Set<Key>;
  expandedKeys?: Set<Key>;
  disabledKeys?: Set<Key>;
  focusedKey?: Key | null;

  // Selection 설정
  selectionMode?: "single" | "multiple" | "none";

  // 콜백
  onSelectionChange?: (keys: Set<Key>) => void;
  onExpandedChange?: (keys: Set<Key>) => void;

  // DnD (optional)
  dnd?: TreeBaseDndConfig<TNode>;

  // 접근성
  "aria-label": string;

  // CSS 클래스
  className?: string;
  dropIndicatorClassName?: string;
}

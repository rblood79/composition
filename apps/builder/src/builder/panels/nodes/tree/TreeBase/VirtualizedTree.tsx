import React, {
  useRef,
  useMemo,
  useCallback,
  useEffect,
  useState,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Key } from "react-stately";
import type { BaseTreeNode, TreeItemState, DropPosition } from "./types";

interface FlattenedNode<TNode extends BaseTreeNode> {
  node: TNode;
  key: Key;
  depth: number;
  isExpanded: boolean;
  hasChildren: boolean;
}

function createNativeDragPreview(label: string): HTMLElement {
  const preview = document.createElement("div");
  preview.className = "tree-drag-preview";
  preview.textContent = label;
  preview.style.position = "fixed";
  preview.style.top = "-1000px";
  preview.style.left = "-1000px";
  preview.style.pointerEvents = "none";
  document.body.appendChild(preview);
  return preview;
}

interface VirtualizedTreeProps<TNode extends BaseTreeNode> {
  // 필수
  items: TNode[];
  getKey: (node: TNode) => Key;
  getTextValue: (node: TNode) => string;
  renderContent: (node: TNode, state: TreeItemState) => React.ReactNode;

  // 상태 (Controlled)
  selectedKeys: Set<Key>;
  expandedKeys: Set<Key>;
  disabledKeys?: Set<Key>;
  focusedKey?: Key | null;

  // 콜백
  onSelectionChange?: (keys: Set<Key>) => void;
  onExpandedChange?: (keys: Set<Key>) => void;

  // DnD (optional)
  dnd?: {
    canDrag: (node: TNode) => boolean;
    isValidDrop: (
      draggedKey: Key,
      targetKey: Key,
      position: DropPosition,
    ) => boolean;
    onMove: (payload: {
      keys: Set<Key>;
      target: { key: Key; node: TNode; dropPosition: DropPosition };
    }) => void;
  };

  // 가상화 설정
  itemHeight?: number;
  overscan?: number;

  // 접근성
  "aria-label": string;

  // CSS 클래스
  className?: string;
}

/**
 * VirtualizedTree - 가상화된 트리 컴포넌트
 *
 * @tanstack/react-virtual 기반으로 500+ 노드도 부드럽게 렌더링합니다.
 * - 확장된 노드만 평탄화하여 렌더링
 * - 고정 높이 기반 가상화
 * - react-aria Tree의 접근성은 일부 희생 (트레이드오프)
 *
 * ⚠️ 주의: 접근성이 중요한 경우 TreeBase 사용 권장
 */
export function VirtualizedTree<TNode extends BaseTreeNode>({
  items,
  getKey,
  getTextValue,
  renderContent,
  selectedKeys,
  expandedKeys,
  disabledKeys,
  focusedKey,
  onSelectionChange,
  onExpandedChange,
  dnd,
  itemHeight = 32,
  overscan = 5,
  "aria-label": ariaLabel,
  className,
}: VirtualizedTreeProps<TNode>) {
  "use no memo";
  const scrollRef = useRef<HTMLDivElement>(null);
  const [draggingKey, setDraggingKey] = useState<Key | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    key: Key;
    position: DropPosition;
  } | null>(null);

  // 확장된 노드만 평탄화
  const flattenedNodes = useMemo(() => {
    const result: FlattenedNode<TNode>[] = [];

    const flatten = (nodes: TNode[]) => {
      for (const node of nodes) {
        const key = getKey(node);
        const children = (node.children ?? []) as TNode[];
        const isExpanded = expandedKeys.has(key);
        const hasChildren = children.length > 0;

        result.push({
          node,
          key,
          depth: node.depth,
          isExpanded,
          hasChildren,
        });

        if (isExpanded && hasChildren) {
          flatten(children);
        }
      }
    };

    flatten(items);
    return result;
  }, [items, expandedKeys, getKey]);

  // Virtualizer
  const virtualizer = useVirtualizer({
    count: flattenedNodes.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => itemHeight,
    overscan,
  });

  // focusedKey 변경 시 스크롤
  useEffect(() => {
    if (focusedKey) {
      const index = flattenedNodes.findIndex((n) => n.key === focusedKey);
      if (index >= 0) {
        virtualizer.scrollToIndex(index, { align: "center" });
      }
    }
  }, [focusedKey, flattenedNodes, virtualizer]);

  // 노드 클릭 핸들러
  const handleNodeClick = useCallback(
    (key: Key, event: React.MouseEvent) => {
      event.preventDefault();
      onSelectionChange?.(new Set([key]));
    },
    [onSelectionChange],
  );

  // 확장 토글
  const handleToggle = useCallback(
    (key: Key, event: React.MouseEvent) => {
      event.stopPropagation();
      const newExpanded = new Set(expandedKeys);
      if (newExpanded.has(key)) {
        newExpanded.delete(key);
      } else {
        newExpanded.add(key);
      }
      onExpandedChange?.(newExpanded);
    },
    [expandedKeys, onExpandedChange],
  );

  // DnD 핸들러
  const handleDragStart = useCallback(
    (key: Key, node: TNode, event: React.DragEvent) => {
      if (dnd && !dnd.canDrag(node)) {
        event.preventDefault();
        return;
      }
      setDraggingKey(key);
      event.dataTransfer.setData("application/x-tree-item", String(key));
      event.dataTransfer.effectAllowed = "move";
      const preview = createNativeDragPreview(getTextValue(node));
      event.dataTransfer.setDragImage(preview, 12, 12);
      requestAnimationFrame(() => preview.remove());
    },
    [dnd, getTextValue],
  );

  const handleDragOver = useCallback(
    (key: Key, event: React.DragEvent) => {
      event.preventDefault();
      if (!dnd || !draggingKey) return;

      const rect = (event.target as HTMLElement).getBoundingClientRect();
      const y = event.clientY - rect.top;
      const position: DropPosition =
        y < rect.height * 0.25
          ? "before"
          : y > rect.height * 0.75
            ? "after"
            : "on";

      if (dnd.isValidDrop(draggingKey, key, position)) {
        setDropTarget({ key, position });
        event.dataTransfer.dropEffect = "move";
      } else {
        setDropTarget(null);
        event.dataTransfer.dropEffect = "none";
      }
    },
    [dnd, draggingKey],
  );

  const handleDrop = useCallback(
    (key: Key, event: React.DragEvent) => {
      event.preventDefault();
      if (!dnd || !draggingKey || !dropTarget) return;

      const targetNode = flattenedNodes.find((n) => n.key === key)?.node;
      if (targetNode) {
        dnd.onMove({
          keys: new Set([draggingKey]),
          target: {
            key,
            node: targetNode,
            dropPosition: dropTarget.position,
          },
        });
      }

      setDraggingKey(null);
      setDropTarget(null);
    },
    [dnd, draggingKey, dropTarget, flattenedNodes],
  );

  const handleDragEnd = useCallback(() => {
    setDraggingKey(null);
    setDropTarget(null);
  }, []);

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={scrollRef}
      className={className}
      role="tree"
      aria-label={ariaLabel}
      style={{ height: "100%", overflow: "auto" }}
    >
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: "100%",
          position: "relative",
        }}
      >
        {virtualItems.map((virtualItem) => {
          const { node, key, depth, isExpanded, hasChildren } =
            flattenedNodes[virtualItem.index];
          const isSelected = selectedKeys.has(key);
          const isDisabled = disabledKeys?.has(key) ?? false;
          const isFocusVisible = key === focusedKey;
          const isDropTargetActive = dropTarget?.key === key;

          const textValue = getTextValue(node);

          return (
            <div
              key={String(key)}
              data-key={key}
              role="treeitem"
              aria-label={textValue}
              aria-selected={isSelected}
              aria-expanded={hasChildren ? isExpanded : undefined}
              aria-disabled={isDisabled}
              tabIndex={isFocusVisible ? 0 : -1}
              draggable={dnd?.canDrag(node) ?? false}
              onClick={(e) => handleNodeClick(key, e)}
              onDragStart={(e) => handleDragStart(key, node, e)}
              onDragOver={(e) => handleDragOver(key, e)}
              onDrop={(e) => handleDrop(key, e)}
              onDragEnd={handleDragEnd}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
                paddingLeft: `${depth * 16}px`,
                boxSizing: "border-box",
              }}
              className={`virtual-tree-item${isSelected ? " selected" : ""}${
                isDropTargetActive ? ` drop-${dropTarget.position}` : ""
              }`}
            >
              {hasChildren && (
                <button
                  className="tree-toggle"
                  onClick={(e) => handleToggle(key, e)}
                  aria-hidden="true"
                  tabIndex={-1}
                >
                  {isExpanded ? "▼" : "▶"}
                </button>
              )}
              {renderContent(node, {
                isSelected,
                isExpanded,
                isDisabled,
                isFocusVisible,
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

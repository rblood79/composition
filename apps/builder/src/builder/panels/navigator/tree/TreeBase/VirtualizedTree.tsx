import React, {
  useRef,
  useMemo,
  useCallback,
  useEffect,
  useState,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Key } from "react-stately";
import { resolveVirtualizedSelection } from "./selectionModel";
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
  selectionMode?: "single" | "multiple" | "none";
  selectionBehavior?: "replace" | "toggle";

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
  selectionMode = "single",
  selectionBehavior,
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
  const anchorKeyRef = useRef<Key | null>(null);
  const [draggingKey, setDraggingKey] = useState<Key | null>(null);
  const [activeKey, setActiveKey] = useState<Key | null>(null);
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

  // 선택 규칙 — 수식어 해석은 TreeBase(RAC) 경로와 같다. 클릭과 키보드가 같이 쓴다.
  const selectKey = useCallback(
    (
      key: Key,
      modifiers: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean },
    ) => {
      const result = resolveVirtualizedSelection({
        anchorKey: anchorKeyRef.current,
        key,
        modifiers,
        orderedKeys: flattenedNodes.map((entry) => entry.key),
        selectedKeys,
        selectionBehavior,
        selectionMode,
      });
      anchorKeyRef.current = result.anchorKey;
      onSelectionChange?.(result.keys);
    },
    [
      flattenedNodes,
      onSelectionChange,
      selectedKeys,
      selectionBehavior,
      selectionMode,
    ],
  );

  const handleNodeClick = useCallback(
    (key: Key, event: React.MouseEvent) => {
      event.preventDefault();
      setActiveKey(key);
      selectKey(key, {
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
      });
    },
    [selectKey],
  );

  // 확장 상태 변경 — 토글 버튼과 ArrowLeft/Right 가 같이 쓴다
  const setExpanded = useCallback(
    (key: Key, expanded: boolean) => {
      if (expandedKeys.has(key) === expanded) return;
      const newExpanded = new Set(expandedKeys);
      if (expanded) {
        newExpanded.add(key);
      } else {
        newExpanded.delete(key);
      }
      onExpandedChange?.(newExpanded);
    },
    [expandedKeys, onExpandedChange],
  );

  const handleToggle = useCallback(
    (key: Key, event: React.MouseEvent) => {
      event.stopPropagation();
      setExpanded(key, !expandedKeys.has(key));
    },
    [expandedKeys, setExpanded],
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

  // ── 키보드 탐색 (role="tree" 계약) ──────────────────────────────────
  // activeKey 는 roving tabindex 의 소유자다. 소비자가 주는 focusedKey 를
  // 초기값으로 쓰고, 그 뒤로는 화살표 입력이 옮긴다.
  const activeIndex = useMemo(() => {
    const key = activeKey ?? focusedKey;
    const index =
      key == null ? -1 : flattenedNodes.findIndex((n) => n.key === key);
    return index >= 0 ? index : flattenedNodes.length > 0 ? 0 : -1;
  }, [activeKey, focusedKey, flattenedNodes]);

  const activeNodeKey =
    activeIndex >= 0 ? flattenedNodes[activeIndex].key : null;

  // 키보드로 옮긴 뒤에만 DOM 포커스를 따라 옮긴다 (마우스 선택은 건드리지 않음).
  const pendingFocusRef = useRef(false);

  const moveActive = useCallback(
    (index: number) => {
      if (index < 0 || index >= flattenedNodes.length) return;
      pendingFocusRef.current = true;
      setActiveKey(flattenedNodes[index].key);
      virtualizer.scrollToIndex(index, { align: "auto" });
    },
    [flattenedNodes, virtualizer],
  );

  useEffect(() => {
    if (!pendingFocusRef.current || activeNodeKey == null) return;
    const el = scrollRef.current?.querySelector<HTMLElement>(
      `[data-key="${CSS.escape(String(activeNodeKey))}"]`,
    );
    if (el) {
      pendingFocusRef.current = false;
      el.focus();
    }
  });

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (activeIndex < 0) return;
      const current = flattenedNodes[activeIndex];

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          moveActive(activeIndex + 1);
          return;
        case "ArrowUp":
          event.preventDefault();
          moveActive(activeIndex - 1);
          return;
        case "Home":
          event.preventDefault();
          moveActive(0);
          return;
        case "End":
          event.preventDefault();
          moveActive(flattenedNodes.length - 1);
          return;
        case "ArrowRight":
          event.preventDefault();
          if (current.hasChildren && !current.isExpanded) {
            setExpanded(current.key, true);
          } else if (current.hasChildren) {
            moveActive(activeIndex + 1);
          }
          return;
        case "ArrowLeft": {
          event.preventDefault();
          if (current.hasChildren && current.isExpanded) {
            setExpanded(current.key, false);
            return;
          }
          // 부모로 — 자기보다 얕은 depth 가 처음 나오는 위쪽 행
          for (let i = activeIndex - 1; i >= 0; i--) {
            if (flattenedNodes[i].depth < current.depth) {
              moveActive(i);
              return;
            }
          }
          return;
        }
        case "Enter":
        case " ":
          event.preventDefault();
          selectKey(current.key, {
            ctrlKey: event.ctrlKey,
            metaKey: event.metaKey,
            shiftKey: event.shiftKey,
          });
          return;
        default:
          return;
      }
    },
    [activeIndex, flattenedNodes, moveActive, selectKey, setExpanded],
  );

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={scrollRef}
      className={className}
      role="tree"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
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
          const isActive = key === activeNodeKey;
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
              tabIndex={isActive ? 0 : -1}
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

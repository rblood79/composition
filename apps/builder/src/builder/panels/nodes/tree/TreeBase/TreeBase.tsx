import React, {
  useState,
  useRef,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import { Tree, DropIndicator, useDragAndDrop } from "react-aria-components";
import type { Key } from "react-stately";
import type { TreeBaseProps, BaseTreeNode, DropPosition } from "./types";
import { TreeBaseItem } from "./TreeBaseItem";

/**
 * TreeBase - LayerTree/PageTree 공통 추상화 컴포넌트
 *
 * react-aria Tree를 래핑하여 다음을 제공:
 * - expandedKeys/selectedKeys 상태 관리
 * - useDragAndDrop 설정
 * - DropIndicator 렌더링
 * - "all" 처리
 */
export function TreeBase<TNode extends BaseTreeNode>({
  items,
  getKey,
  getTextValue,
  renderContent,
  selectedKeys,
  expandedKeys,
  disabledKeys,
  focusedKey,
  selectionMode = "single",
  onSelectionChange,
  onExpandedChange,
  dnd,
  "aria-label": ariaLabel,
  className,
  dropIndicatorClassName = "tree-drop-indicator",
}: TreeBaseProps<TNode>) {
  // 내부 상태 (Uncontrolled 모드용)
  const [internalExpanded, setInternalExpanded] = useState<Set<Key>>(new Set());
  const lastDraggedKeysRef = useRef<Set<Key> | null>(null);
  const treeRef = useRef<HTMLDivElement>(null);

  const resolvedExpanded = expandedKeys ?? internalExpanded;

  // focusedKey 변경 시 해당 노드로 스크롤 및 포커스
  useEffect(() => {
    if (focusedKey && treeRef.current) {
      // data-key 속성으로 TreeItem 찾기
      const targetElement = treeRef.current.querySelector(
        `[data-key="${focusedKey}"]`,
      ) as HTMLElement;
      if (targetElement) {
        // 스크롤 및 포커스
        targetElement.scrollIntoView({ block: "nearest", behavior: "smooth" });
        targetElement.focus({ preventScroll: true });
      }
    }
  }, [focusedKey]);

  // 노드 맵 구축 (빠른 조회용)
  const nodeMap = useMemo(() => {
    const map = new Map<Key, TNode>();
    const stack = [...items];
    while (stack.length > 0) {
      const node = stack.shift();
      if (!node) continue;
      map.set(getKey(node), node);
      if (node.children && node.children.length > 0) {
        stack.unshift(...(node.children as TNode[]));
      }
    }
    return map;
  }, [items, getKey]);

  // Selection 핸들러 ("all" 무시)
  const handleSelectionChange = useCallback(
    (keys: "all" | Set<Key>) => {
      if (keys === "all") return;
      onSelectionChange?.(keys);
    },
    [onSelectionChange],
  );

  // Expanded 핸들러 ("all" 무시)
  const handleExpandedChange = useCallback(
    (keys: "all" | Set<Key>) => {
      if (keys === "all") return;
      const next = new Set(keys);
      if (!expandedKeys) setInternalExpanded(next);
      onExpandedChange?.(next);
    },
    [expandedKeys, onExpandedChange],
  );

  // DnD 설정
  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (keys) => {
      lastDraggedKeysRef.current = keys;
      if (!dnd) return [];

      return [...keys].flatMap((key) => {
        const node = nodeMap.get(key);
        if (!node || !dnd.canDrag(node)) return [];
        return [
          {
            [dnd.dragType ?? "application/x-tree-item"]: JSON.stringify({
              id: key,
            }),
            "text/plain": getTextValue(node),
          },
        ];
      });
    },
    acceptedDragTypes: dnd ? [dnd.dragType ?? "application/x-tree-item"] : [],
    renderDragPreview: dnd?.renderDragPreview,
    onMove(e) {
      if (!dnd) return;

      const { keys, target } = e;
      if (!target || target.type !== "item") return;

      // 유효성 검사
      for (const key of keys) {
        if (
          !dnd.isValidDrop(key, target.key, target.dropPosition as DropPosition)
        ) {
          return;
        }
      }

      const targetNode = nodeMap.get(target.key);

      if (targetNode) {
        dnd.onMove({
          keys,
          target: {
            key: target.key,
            node: targetNode,
            dropPosition: target.dropPosition as DropPosition,
          },
        });
      }
    },
    renderDropIndicator(target) {
      // item 타입이 아닌 경우 숨김
      if (target.type !== "item") {
        return (
          <DropIndicator
            target={target}
            className={`${dropIndicatorClassName} ${dropIndicatorClassName}--hidden`}
          />
        );
      }

      // 유효성 검사
      let isInvalid = false;
      const draggedKeys = lastDraggedKeysRef.current;
      if (dnd && draggedKeys) {
        for (const key of draggedKeys) {
          if (
            !dnd.isValidDrop(
              key,
              target.key,
              target.dropPosition as DropPosition,
            )
          ) {
            isInvalid = true;
            break;
          }
        }
      }

      return (
        <DropIndicator
          target={target}
          className={`${dropIndicatorClassName}${
            isInvalid ? ` ${dropIndicatorClassName}--hidden` : ""
          }`}
        />
      );
    },
  });

  return (
    <Tree
      ref={treeRef}
      aria-label={ariaLabel}
      items={items}
      selectionMode={selectionMode}
      selectedKeys={selectedKeys}
      expandedKeys={resolvedExpanded}
      disabledKeys={disabledKeys}
      onSelectionChange={handleSelectionChange}
      onExpandedChange={handleExpandedChange}
      dragAndDropHooks={dnd ? dragAndDropHooks : undefined}
      className={className}
    >
      {(node) => (
        <TreeBaseItem
          key={getKey(node)}
          node={node}
          getKey={getKey}
          getTextValue={getTextValue}
          renderContent={renderContent}
          canDrag={dnd?.canDrag}
        />
      )}
    </Tree>
  );
}

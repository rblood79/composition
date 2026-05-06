import React, { useCallback, useMemo, useState } from "react";
import type { Key } from "react-stately";
import { TreeBase } from "../TreeBase";
import type { TreeItemState } from "../TreeBase/types";
import type { PageTreeNode, PageTreeProps } from "./types";
import { usePageTreeData } from "./usePageTreeData";
import { calculatePageMoveUpdates } from "./usePageTreeDnd";
import { isValidPageDrop } from "./validation";
import { PageTreeItemContent } from "./PageTreeItemContent";
import { useFocusManagement } from "../hooks";

/**
 * PageTree - TreeBase 기반 구현
 *
 * 도메인 로직:
 * - PageTreeNode 변환 (usePageTreeData)
 * - Validation (isValidPageDrop)
 * - Store 동기화 (syncToStore)
 */
export function PageTree({
  pages,
  selectedPageId,
  expandedKeys,
  onExpandedChange,
  onPageSelect,
  onPageDelete,
  onPageSettings,
}: PageTreeProps) {
  const { tree, treeNodes, nodeMap, syncToStore } = usePageTreeData(pages);
  const [internalExpandedKeys, setInternalExpandedKeys] = useState<Set<Key>>(
    new Set(),
  );
  const selectedKeys = useMemo(
    () => (selectedPageId ? new Set<Key>([selectedPageId]) : new Set<Key>()),
    [selectedPageId],
  );

  // 포커스 관리용 nodeMap 생성
  const focusNodeMap = useMemo(() => {
    const map = new Map<
      string,
      { parentId: string | null; children?: unknown[] }
    >();
    for (const node of nodeMap.values()) {
      map.set(node.id, { parentId: node.parentId, children: node.children });
    }
    return map;
  }, [nodeMap]);

  // 포커스 관리 훅
  const { focusedKey, handleAfterMove } = useFocusManagement({
    nodeMap: focusNodeMap,
  });

  const resolvedExpandedKeys = expandedKeys ?? internalExpandedKeys;

  const handleExpandedChange = useCallback(
    (keys: Set<Key>) => {
      if (!expandedKeys) {
        setInternalExpandedKeys(keys);
      }
      onExpandedChange?.(keys);
    },
    [expandedKeys, onExpandedChange],
  );

  const handleSelectionChange = useCallback(
    (keys: Set<Key>) => {
      const key = [...keys][0] as string;
      if (!key) return;
      if (key === selectedPageId) return;

      const node = nodeMap.get(key);
      if (node) {
        onPageSelect(node.page);
      }
    },
    [nodeMap, onPageSelect, selectedPageId],
  );

  // DnD 유효성 검사 (클로저로 tree 캡처)
  const handleIsValidDrop = useCallback(
    (draggedKey: Key, targetKey: Key, position: "before" | "after" | "on") => {
      return isValidPageDrop(String(draggedKey), String(targetKey), position, {
        getItem: (key) => tree.getItem(key),
      }).valid;
    },
    [tree],
  );

  // DnD 이동 처리 (클로저로 tree, syncToStore 캡처)
  const handleMove = useCallback(
    (payload: {
      keys: Set<Key>;
      target: {
        key: Key;
        node: PageTreeNode;
        dropPosition: "before" | "after" | "on";
      };
    }) => {
      const updates = calculatePageMoveUpdates({
        tree: {
          items: treeNodes,
          getItem: (key) => tree.getItem(key),
        },
        movedKeys: payload.keys,
        targetKey: payload.target.key,
        dropPosition: payload.target.dropPosition,
      });
      syncToStore(updates);
      // DnD 후 포커스 유지
      handleAfterMove(payload.keys);
    },
    [tree, treeNodes, syncToStore, handleAfterMove],
  );

  // 드래그 가능 여부 (Home 페이지는 드래그 불가)
  const canDrag = useCallback((node: PageTreeNode) => {
    return !node.isRoot;
  }, []);

  // 렌더링
  const renderContent = useCallback(
    (node: PageTreeNode, state: TreeItemState) => (
      <PageTreeItemContent
        node={node}
        state={state}
        onDelete={onPageDelete}
        onSettings={onPageSettings}
        onReselect={onPageSelect}
      />
    ),
    [onPageDelete, onPageSelect, onPageSettings],
  );

  return (
    <TreeBase<PageTreeNode>
      aria-label="Pages"
      items={treeNodes}
      getKey={(node) => node.id}
      getTextValue={(node) => node.name}
      renderContent={renderContent}
      selectedKeys={selectedKeys}
      expandedKeys={resolvedExpandedKeys}
      focusedKey={focusedKey}
      onSelectionChange={handleSelectionChange}
      onExpandedChange={handleExpandedChange}
      dnd={{
        canDrag,
        isValidDrop: handleIsValidDrop,
        onMove: handleMove,
        dragType: "application/x-page-tree-item",
      }}
      className="page-tree"
      dropIndicatorClassName="layer-drop-indicator"
    />
  );
}

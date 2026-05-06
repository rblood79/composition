import React, { useCallback, useMemo, useState } from "react";
import type { Key } from "react-stately";
import { TreeBase, VirtualizedTree } from "../TreeBase";
import type { TreeItemState } from "../TreeBase/types";
import type { LayerTreeNode, LayerTreeProps } from "./types";
import { useLayerTreeData } from "./useLayerTreeData";
import { calculateMoveUpdates } from "./useLayerTreeDnd";
import { isValidDrop } from "./validation";
import { LayerTreeItemContent } from "./LayerTreeItemContent";
import { useFocusManagement } from "../hooks";

/**
 * LayerTree - TreeBase 기반 구현
 *
 * 도메인 로직:
 * - LayerTreeNode 변환 (useLayerTreeData)
 * - VirtualChild 처리
 * - Validation (isValidDrop)
 * - Store 동기화 (syncToStore)
 */
export function LayerTree({
  elements,
  selectedElementId,
  selectedTab,
  expandedKeys,
  onExpandedChange,
  onItemClick,
  onItemDelete,
  onSelectTabElement,
}: LayerTreeProps) {
  const { tree, treeNodes, nodeMap, focusNodeMap, disabledKeys, syncToStore } =
    useLayerTreeData(elements);
  const [internalExpandedKeys, setInternalExpandedKeys] = useState<Set<Key>>(
    new Set(),
  );

  // 포커스 관리 훅
  const { focusedKey, handleAfterMove } = useFocusManagement({
    nodeMap: focusNodeMap,
    onSelectionChange: (keys) => {
      const key = [...keys][0] as string;
      if (key) {
        const node = nodeMap.get(key);
        if (node && !node.virtualChildType) {
          onItemClick(node.element);
        }
      }
    },
  });

  const resolvedExpandedKeys = expandedKeys ?? internalExpandedKeys;
  const effectiveExpandedKeys = useMemo(() => {
    if (!selectedElementId) return resolvedExpandedKeys;
    const next = new Set<Key>(resolvedExpandedKeys);
    let parentId = nodeMap.get(selectedElementId)?.parentId ?? null;
    while (parentId) {
      next.add(parentId);
      parentId = nodeMap.get(parentId)?.parentId ?? null;
    }
    return next;
  }, [nodeMap, resolvedExpandedKeys, selectedElementId]);

  const handleExpandedChange = useCallback(
    (keys: Set<Key>) => {
      if (!expandedKeys) {
        setInternalExpandedKeys(keys);
      }
      onExpandedChange?.(keys as Set<string | number>);
    },
    [expandedKeys, onExpandedChange],
  );

  const handleSelectionChange = useCallback(
    (keys: Set<Key>) => {
      const key = [...keys][0] as string;
      if (!key) return;

      const node = nodeMap.get(key);
      if (!node || node.virtualChildType) return;
      onItemClick(node.element);
    },
    [nodeMap, onItemClick],
  );

  // DnD 유효성 검사 (클로저로 tree 캡처)
  const handleIsValidDrop = useCallback(
    (draggedKey: Key, targetKey: Key, position: "before" | "after" | "on") => {
      return isValidDrop(String(draggedKey), String(targetKey), position, {
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
        node: LayerTreeNode;
        dropPosition: "before" | "after" | "on";
      };
    }) => {
      const updates = calculateMoveUpdates({
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

  // 드래그 가능 여부
  const canDrag = useCallback((node: LayerTreeNode) => {
    return (
      !node.virtualChildType &&
      !node.isSyntheticRefChild &&
      node.type !== "body"
    );
  }, []);

  // 렌더링
  const renderContent = useCallback(
    (node: LayerTreeNode, state: TreeItemState) => (
      <LayerTreeItemContent
        node={node}
        state={state}
        onDelete={onItemDelete}
        selectedTab={selectedTab}
        onSelectTabElement={onSelectTabElement}
      />
    ),
    [onItemDelete, selectedTab, onSelectTabElement],
  );

  const sharedTreeProps = {
    "aria-label": "Layers" as const,
    items: treeNodes,
    getKey: (node: LayerTreeNode) => node.id,
    getTextValue: (node: LayerTreeNode) => node.name,
    renderContent,
    selectedKeys: selectedElementId
      ? new Set([selectedElementId])
      : new Set<Key>(),
    expandedKeys: effectiveExpandedKeys,
    disabledKeys,
    focusedKey,
    onSelectionChange: handleSelectionChange,
    onExpandedChange: handleExpandedChange,
    dnd: {
      canDrag,
      isValidDrop: handleIsValidDrop,
      onMove: handleMove,
      dragType: "application/x-layer-tree-item",
    },
  };

  if (treeNodes.length >= 12) {
    return (
      <VirtualizedTree<LayerTreeNode>
        {...sharedTreeProps}
        itemHeight={32}
        overscan={8}
        className="layer-tree layer-tree--virtualized"
      />
    );
  }

  return (
    <TreeBase<LayerTreeNode>
      {...sharedTreeProps}
      dropIndicatorClassName="layer-drop-indicator"
    />
  );
}

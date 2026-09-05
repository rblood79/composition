import React, { useCallback, useMemo, useState } from "react";
import type { Key } from "react-stately";
import { ListLayout, Virtualizer } from "react-aria-components";
import { TreeBase, VirtualizedTree } from "../TreeBase";
import type { TreeBaseDndConfig, TreeItemState } from "../TreeBase/types";
import type { PanelNode } from "../../../panelNode";
import type { LayerTreeNode, LayerTreeProps } from "./types";
import { useLayerTreeData } from "./useLayerTreeData";
import { calculateMoveUpdates } from "./useLayerTreeDnd";
import { isValidDrop } from "./validation";
import { LayerTreeItemContent } from "./LayerTreeItemContent";
import { useFocusManagement } from "../hooks";
import { LAYER_TREE_ROW_SIZE_PX } from "./virtualization";

const LAYER_TREE_LAYOUT_OPTIONS = { rowSize: LAYER_TREE_ROW_SIZE_PX };
const getLayerTreeKey = (node: LayerTreeNode) => node.id;
const getLayerTreeTextValue = (node: LayerTreeNode) => node.name;

function readDragPreviewText(item: unknown): string | null {
  if (!item || typeof item !== "object") return null;
  const text = (item as Record<string, unknown>)["text/plain"];
  return typeof text === "string" && text.length > 0 ? text : null;
}

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
  selectedElementIds,
  selectedTab,
  expandedKeys,
  onExpandedChange,
  onSelectionChange,
  onItemDelete,
  onSelectTabElement,
}: LayerTreeProps) {
  const { tree, treeNodes, nodeMap, focusNodeMap, disabledKeys, syncToStore } =
    useLayerTreeData(elements);
  const [internalExpandedKeys, setInternalExpandedKeys] = useState<Set<Key>>(
    new Set(),
  );

  /** 가상 자식 행(projected row/cell 등)은 canonical 요소가 아니라 선택에서 뺀다. */
  const resolveSelectedElements = useCallback(
    (keys: Iterable<Key>) => {
      const elementsForKeys: PanelNode[] = [];
      for (const key of keys) {
        const node = nodeMap.get(String(key));
        if (!node || node.virtualChildType) continue;
        elementsForKeys.push(node.element);
      }
      return elementsForKeys;
    },
    [nodeMap],
  );

  // 포커스 관리 훅
  const { focusedKey, handleAfterMove } = useFocusManagement({
    nodeMap: focusNodeMap,
    onSelectionChange: (keys) => {
      const selected = resolveSelectedElements(keys);
      if (selected.length > 0) onSelectionChange(selected);
    },
  });

  const activeSelectedIds = useMemo(() => {
    if (selectedElementIds && selectedElementIds.length > 0) {
      return selectedElementIds;
    }
    return selectedElementId ? [selectedElementId] : [];
  }, [selectedElementId, selectedElementIds]);

  const selectedKeys = useMemo(
    () => new Set<Key>(activeSelectedIds),
    [activeSelectedIds],
  );

  const resolvedExpandedKeys = expandedKeys ?? internalExpandedKeys;
  const effectiveExpandedKeys = useMemo(() => {
    if (activeSelectedIds.length === 0) return resolvedExpandedKeys;
    const next = new Set<Key>(resolvedExpandedKeys);
    // 선택된 요소 **전부**의 조상을 펼친다 — 하나만 펼치면 다중 선택의 나머지가
    // 접힌 채 남아 선택 표시가 부분적으로만 보인다.
    const visited = new Set<string>();
    for (const selectedId of activeSelectedIds) {
      let parentId = nodeMap.get(selectedId)?.parentId ?? null;
      while (parentId && !visited.has(parentId)) {
        visited.add(parentId);
        next.add(parentId);
        parentId = nodeMap.get(parentId)?.parentId ?? null;
      }
    }
    return next;
  }, [activeSelectedIds, nodeMap, resolvedExpandedKeys]);

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
      // 가상 자식만 클릭한 경우 (걸러진 결과가 비었는데 원본은 비지 않음) 는
      // 선택 해제가 아니라 무시다.
      if (keys.size > 0) {
        const selected = resolveSelectedElements(keys);
        if (selected.length === 0) return;
        onSelectionChange(selected);
        return;
      }
      onSelectionChange([]);
    },
    [onSelectionChange, resolveSelectedElements],
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

  const renderDragPreview = useCallback<
    NonNullable<TreeBaseDndConfig<LayerTreeNode>["renderDragPreview"]>
  >((items) => {
    const label =
      items.length > 1
        ? `${items.length} layers`
        : (readDragPreviewText(items[0]) ?? "Layer");
    return <div className="tree-drag-preview">{label}</div>;
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
    getKey: getLayerTreeKey,
    getTextValue: getLayerTreeTextValue,
    renderContent,
    selectedKeys,
    // 캔버스와 같은 다중 선택을 트리에서도 만들고 표시한다. 수식어 의미는 RAC
    // 규칙을 그대로 쓴다 — shift 는 구간, meta/ctrl 은 개별 토글 (D1 권위).
    // RAC 기본 `toggle` 은 수식어 없는 클릭까지 토글로 만들어(체크박스 목록 어법)
    // 레이어 패널에서는 "클릭했는데 선택이 풀린다" 가 된다.
    selectionMode: "multiple" as const,
    selectionBehavior: "replace" as const,
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
      renderDragPreview,
    },
  };

  if (treeNodes.length >= 300) {
    return (
      <VirtualizedTree<LayerTreeNode>
        {...sharedTreeProps}
        itemHeight={28}
        overscan={8}
        className="layer-tree layer-tree--virtualized"
      />
    );
  }

  return (
    <Virtualizer layout={ListLayout} layoutOptions={LAYER_TREE_LAYOUT_OPTIONS}>
      <TreeBase<LayerTreeNode>
        {...sharedTreeProps}
        className="layer-tree layer-tree--rac-virtualized"
        dropIndicatorClassName="layer-drop-indicator"
      />
    </Virtualizer>
  );
}

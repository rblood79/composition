/**
 * FrameElementTree — frame 의 element 트리 렌더 + Layers 헤더 + Collapse All 버튼.
 *
 * ADR-111 Phase 2 PR-D2: FramesTab.tsx 의 Layers section (Layers 헤더 + tree 렌더
 * + placeholder) 추출.
 *
 * 본 컴포넌트는 프레젠테이션 전용 — element 선택 / 삭제 핸들러 구현은 부모 책임.
 * tree 데이터, expand 상태, 핸들러 모두 props 로 주입받아 결정적 UI 만 렌더.
 *
 * functional 동등 — 추출 전후 동작 차이 없음 (FramesTab 8/8 회귀 0).
 */

import React, { useCallback, useMemo } from "react";
import type { Key } from "react-stately";
import { Button } from "react-aria-components";
import { Minimize, ChevronRight, Box, Trash, Settings2 } from "lucide-react";
import { iconProps } from "../../../../utils/ui/uiConstants";
import type { ElementProps } from "../../../../types/integrations/supabase.types";
import type { ElementTreeItem } from "../../../../types/builder/stately.types";
import { withFrameElementMirrorId } from "../../../../adapters/canonical/frameMirror";
import { PanelHeader } from "../../../components";
import { TreeBase, VirtualizedTree } from "../tree/TreeBase";
import type { BaseTreeNode, TreeItemState } from "../tree/TreeBase";
import type { PanelNode } from "../../panelNode";

interface FrameElementTreeNode extends BaseTreeNode {
  type: string;
  item: ElementTreeItem;
  children?: FrameElementTreeNode[];
}

export interface FrameElementTreeProps {
  /** 렌더할 element 트리 */
  tree: ElementTreeItem[];
  /** 현재 선택된 frame id (없으면 placeholder 표시 + element 의 legacy layout binding source) */
  frameId: string | null;
  /** 현재 선택된 element id (active 표시용) */
  selectedElementId: string | null;
  /** 펼쳐진 element id 집합 */
  expandedKeys: ReadonlySet<string>;
  /** 펼침/접힘 토글 */
  toggleKey: (id: string) => void;
  /** Collapse All 버튼 핸들러 */
  onCollapseAll: () => void;
  /** Frame node 항목 클릭 핸들러 */
  onElementClick: (element: PanelNode) => void;
  /** Frame node 삭제 버튼 핸들러 */
  onElementDelete: (element: PanelNode) => Promise<void> | void;
}

export function FrameElementTree({
  tree,
  frameId,
  selectedElementId,
  expandedKeys,
  toggleKey,
  onCollapseAll,
  onElementClick,
  onElementDelete,
}: FrameElementTreeProps) {
  const treeNodes = useMemo(() => toFrameElementTreeNodes(tree), [tree]);
  const nodeMap = useMemo(() => {
    const map = new Map<string, FrameElementTreeNode>();
    const stack = [...treeNodes];
    while (stack.length > 0) {
      const node = stack.shift();
      if (!node) continue;
      map.set(node.id, node);
      if (node.children) stack.unshift(...node.children);
    }
    return map;
  }, [treeNodes]);
  const selectedKeys = useMemo(
    () =>
      selectedElementId ? new Set<Key>([selectedElementId]) : new Set<Key>(),
    [selectedElementId],
  );
  const resolvedExpandedKeys = useMemo(
    () => new Set<Key>([...expandedKeys]),
    [expandedKeys],
  );

  const toElement = useCallback(
    (node: FrameElementTreeNode): PanelNode =>
      withFrameElementMirrorId(
        {
          id: node.item.id,
          type: node.item.type,
          parent_id: node.item.parent_id || null,
          props: node.item.props as ElementProps,
          deleted: node.item.deleted,
          page_id: null,
          created_at: "",
          updated_at: "",
        },
        frameId ?? null,
      ),
    [frameId],
  );

  const handleSelectionChange = useCallback(
    (keys: Set<Key>) => {
      const key = [...keys][0];
      if (!key) return;
      const node = nodeMap.get(String(key));
      if (!node) return;
      onElementClick(toElement(node));
    },
    [nodeMap, onElementClick, toElement],
  );

  const handleExpandedChange = useCallback(
    (keys: Set<Key>) => {
      const next = new Set([...keys].map(String));
      const previous = new Set([...expandedKeys].map(String));
      for (const key of next) {
        if (!previous.has(key)) toggleKey(key);
      }
      for (const key of previous) {
        if (!next.has(key)) toggleKey(key);
      }
    },
    [expandedKeys, toggleKey],
  );

  const renderContent = useCallback(
    (node: FrameElementTreeNode, state: TreeItemState) => (
      <FrameElementTreeItemContent
        node={node}
        state={state}
        element={toElement(node)}
        onDelete={onElementDelete}
        onReselect={onElementClick}
      />
    ),
    [onElementClick, onElementDelete, toElement],
  );

  return (
    <div className="section">
      <PanelHeader
        title="Layers"
        actions={
          <button
            className="iconButton"
            aria-label="Collapse All"
            onClick={onCollapseAll}
          >
            <Minimize
              color={iconProps.color}
              strokeWidth={iconProps.strokeWidth}
              size={iconProps.size}
            />
          </button>
        }
      />
      <div className="section-content elements">
        {!frameId ? (
          <p className="no_element">Select a frame to view elements</p>
        ) : tree.length === 0 ? (
          <p className="no_element">No elements in this frame</p>
        ) : treeNodes.length >= 12 ? (
          <VirtualizedTree<FrameElementTreeNode>
            aria-label="Layers"
            items={treeNodes}
            getKey={(node) => node.id}
            getTextValue={getFrameElementDisplayName}
            renderContent={renderContent}
            selectedKeys={selectedKeys}
            expandedKeys={resolvedExpandedKeys}
            onSelectionChange={handleSelectionChange}
            onExpandedChange={handleExpandedChange}
            itemHeight={32}
            overscan={8}
            className="frame-tree frame-tree--virtualized"
          />
        ) : (
          <TreeBase<FrameElementTreeNode>
            aria-label="Layers"
            items={treeNodes}
            getKey={(node) => node.id}
            getTextValue={getFrameElementDisplayName}
            renderContent={renderContent}
            selectedKeys={selectedKeys}
            expandedKeys={resolvedExpandedKeys}
            onSelectionChange={handleSelectionChange}
            onExpandedChange={handleExpandedChange}
            className="frame-tree"
          />
        )}
      </div>
    </div>
  );
}

function toFrameElementTreeNodes(
  items: ElementTreeItem[],
  depth = 0,
): FrameElementTreeNode[] {
  return items.map((item) => {
    const children = toFrameElementTreeNodes(item.children ?? [], depth + 1);
    return {
      id: item.id,
      parentId: item.parent_id ?? null,
      depth,
      hasChildren: children.length > 0,
      children,
      type: item.type,
      item,
    };
  });
}

function getFrameElementDisplayName(node: FrameElementTreeNode): string {
  if (node.type === "Slot" && node.item.props) {
    return `Slot: ${
      (node.item.props as Record<string, unknown>).name || "unnamed"
    }`;
  }
  return node.type;
}

interface FrameElementTreeItemContentProps {
  node: FrameElementTreeNode;
  state: TreeItemState;
  element: PanelNode;
  onDelete: (element: PanelNode) => Promise<void> | void;
  onReselect: (element: PanelNode) => void;
}

function FrameElementTreeItemContent({
  node,
  state,
  element,
  onDelete,
  onReselect,
}: FrameElementTreeItemContentProps) {
  const { isSelected, isExpanded, isFocusVisible } = state;

  return (
    <div
      className={`elementItem ${isSelected ? "active" : ""} ${
        isFocusVisible ? "focused" : ""
      }`}
      onClick={(event) => {
        if (!isSelected) return;
        const target = event.target;
        if (target instanceof globalThis.Element && target.closest("button")) {
          return;
        }
        onReselect(element);
      }}
    >
      <div
        className="elementItemIndent"
        style={{ width: node.depth > 0 ? `${node.depth * 8}px` : "0px" }}
      />
      <div className="elementItemIcon">
        {node.hasChildren ? (
          <Button
            slot="chevron"
            className="layer-expand-button"
            aria-label={`${isExpanded ? "Collapse" : "Expand"} ${getFrameElementDisplayName(node)}`}
          >
            <ChevronRight
              color={iconProps.color}
              strokeWidth={iconProps.strokeWidth}
              size={iconProps.size}
              data-chevron="true"
            />
          </Button>
        ) : (
          <Box
            color={iconProps.color}
            strokeWidth={iconProps.strokeWidth}
            size={iconProps.size}
            style={{ padding: "2px" }}
          />
        )}
      </div>
      <div className="elementItemLabel">{getFrameElementDisplayName(node)}</div>
      <div className="elementItemActions">
        {node.type === "body" && (
          <Button className="iconButton" aria-label="Settings">
            <Settings2
              color={iconProps.color}
              strokeWidth={iconProps.strokeWidth}
              size={iconProps.size}
            />
          </Button>
        )}
        {node.type !== "body" && (
          <Button
            className="iconButton"
            aria-label={`Delete ${node.type}`}
            onPress={() => onDelete(element)}
          >
            <Trash
              color={iconProps.color}
              strokeWidth={iconProps.strokeWidth}
              size={iconProps.size}
            />
          </Button>
        )}
      </div>
    </div>
  );
}

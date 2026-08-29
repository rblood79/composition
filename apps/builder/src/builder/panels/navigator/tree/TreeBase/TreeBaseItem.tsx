import React from "react";
import { Collection, TreeItem, TreeItemContent } from "react-aria-components";
import type { Key } from "react-stately";
import type { BaseTreeNode, TreeItemState } from "./types";

interface TreeBaseItemProps<TNode extends BaseTreeNode> {
  node: TNode;
  getKey: (node: TNode) => Key;
  getTextValue: (node: TNode) => string;
  renderContent: (node: TNode, state: TreeItemState) => React.ReactNode;
  canDrag?: (node: TNode) => boolean;
}

/**
 * TreeBaseItem - 공통 TreeItem 래퍼
 *
 * react-aria TreeItem을 래핑하여:
 * - 재귀적 자식 렌더링
 * - TreeItemContent 상태를 TreeItemState로 변환
 * - 도메인별 renderContent에 위임
 */
export function TreeBaseItem<TNode extends BaseTreeNode>({
  node,
  getKey,
  getTextValue,
  renderContent,
}: TreeBaseItemProps<TNode>) {
  const children = (node.children ?? []) as TNode[];
  const key = getKey(node);
  const textValue = getTextValue(node);

  return (
    <TreeItem id={key} textValue={textValue}>
      <TreeItemContent>
        {({ isSelected, isExpanded, isDisabled, isFocusVisible }) =>
          renderContent(node, {
            isSelected,
            isExpanded,
            isDisabled,
            isFocusVisible,
          })
        }
      </TreeItemContent>
      {children.length > 0 ? (
        <Collection items={children}>
          {(child) => (
            <TreeBaseItem
              node={child}
              getKey={getKey}
              getTextValue={getTextValue}
              renderContent={renderContent}
            />
          )}
        </Collection>
      ) : null}
    </TreeItem>
  );
}

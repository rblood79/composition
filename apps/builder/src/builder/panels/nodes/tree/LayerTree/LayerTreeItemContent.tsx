import React from "react";
import { Button } from "react-aria-components";
import {
  ChevronRight,
  Box,
  Folder,
  File,
  Settings2,
  Trash,
  GripVertical,
} from "lucide-react";
import { ICON_EDIT_PROPS, type TreeItem as TreeItemType } from "../helpers";
import type { Element } from "../../../../../types/core/store.types";
import type { ElementProps } from "../../../../../types/integrations/supabase.types";
import type { TreeItemState } from "../TreeBase/types";
import type { LayerTreeNode } from "./types";
import { useStore } from "../../../../stores";
import { useKeyboardShortcutsRegistry } from "../../../../hooks/useKeyboardShortcutsRegistry";
import { requestEditingSemanticsDetachConfirmation } from "../../../../utils/editingSemanticsImpactConfirmation";
import {
  canDetachInstance,
  getEditingSemanticsLabel,
  getEditingSemanticsRole,
} from "../../../../utils/editingSemantics";

interface LayerTreeItemContentProps {
  node: LayerTreeNode;
  state: TreeItemState;
  onDelete: (element: Element) => Promise<void>;
  selectedTab?: { parentId: string; tabIndex: number } | null;
  onSelectTabElement?: (
    parentId: string,
    props: ElementProps,
    index: number,
  ) => void;
}

/**
 * LayerTree 아이템 렌더링
 * - 일반 요소: 드래그/삭제 가능
 * - VirtualChild: 선택만 가능 (드래그/삭제 불가)
 */
export function LayerTreeItemContent({
  node,
  state,
  onDelete,
  selectedTab,
  onSelectTabElement,
}: LayerTreeItemContentProps) {
  const { isFocusVisible } = state;

  // VirtualChild 렌더링
  if (node.virtualChildType) {
    return (
      <VirtualChildContent
        node={node}
        isFocusVisible={isFocusVisible}
        selectedTab={selectedTab}
        onSelectTabElement={onSelectTabElement}
      />
    );
  }

  // 일반 요소 렌더링
  return <NormalItemContent node={node} state={state} onDelete={onDelete} />;
}

// ============================================
// 일반 요소 콘텐츠
// ============================================

interface NormalItemContentProps {
  node: LayerTreeNode;
  state: TreeItemState;
  onDelete: (element: Element) => Promise<void>;
}

function NormalItemContent({ node, state, onDelete }: NormalItemContentProps) {
  const { depth, hasChildren, type, element, name, isSyntheticRefChild } = node;
  const { isSelected, isExpanded, isFocusVisible } = state;
  const detachInstance = useStore((store) => store.detachInstance);
  const semanticsRole = getEditingSemanticsRole(element);
  const semanticsLabel = getEditingSemanticsLabel(semanticsRole);
  const isDetachableInstance = canDetachInstance(element);
  const [contextMenuPosition, setContextMenuPosition] = React.useState<{
    x: number;
    y: number;
  } | null>(null);
  const closeContextMenu = React.useCallback(() => {
    setContextMenuPosition(null);
  }, []);

  React.useEffect(() => {
    if (!contextMenuPosition) return;

    window.addEventListener("pointerdown", closeContextMenu);
    return () => {
      window.removeEventListener("pointerdown", closeContextMenu);
    };
  }, [closeContextMenu, contextMenuPosition]);

  useKeyboardShortcutsRegistry(
    [
      {
        key: "Escape",
        modifier: "none",
        handler: closeContextMenu,
        preventDefault: false,
        disabled: !contextMenuPosition,
        category: "nodes",
        description: "Close layer item context menu",
      },
    ],
    [closeContextMenu, contextMenuPosition],
  );

  const handleContextMenu = (event: React.MouseEvent) => {
    if (isSyntheticRefChild || !isDetachableInstance) return;
    event.preventDefault();
    event.stopPropagation();
    setContextMenuPosition({ x: event.clientX, y: event.clientY });
  };

  const handleDetachInstance = async () => {
    if (!isDetachableInstance) return;
    setContextMenuPosition(null);
    const confirmed = await requestEditingSemanticsDetachConfirmation({
      instanceId: element.id,
      instanceLabel: name,
    });
    if (!confirmed) return;
    detachInstance(element.id);
  };

  return (
    <div
      className={`elementItem ${isSelected ? "active" : ""} ${
        isFocusVisible ? "focused" : ""
      }`}
      onContextMenu={handleContextMenu}
    >
      <div
        className="elementItemIndent"
        style={{ width: depth > 0 ? `${depth * 8}px` : "0px" }}
      />
      <div className="elementItemIcon">
        {hasChildren ? (
          <Button
            slot="chevron"
            className="layer-expand-button"
            aria-label={`${isExpanded ? "Collapse" : "Expand"} ${name}`}
          >
            <ChevronRight
              color={ICON_EDIT_PROPS.color}
              strokeWidth={ICON_EDIT_PROPS.stroke}
              size={ICON_EDIT_PROPS.size}
              data-chevron="true"
            />
          </Button>
        ) : (
          <Box
            color={ICON_EDIT_PROPS.color}
            strokeWidth={ICON_EDIT_PROPS.stroke}
            size={ICON_EDIT_PROPS.size}
            style={{ padding: "2px" }}
          />
        )}
      </div>
      <div className="elementItemLabel">
        {semanticsRole && semanticsLabel && (
          <span
            className={`editing-semantics-dot editing-semantics-dot--${semanticsRole}`}
            aria-label={semanticsLabel}
            title={semanticsLabel}
          />
        )}
        <span className="elementItemLabelText">{name}</span>
      </div>
      <div className="elementItemActions">
        <Button
          slot="drag"
          className={`iconButton layer-drag-handle${
            type === "body" || isSyntheticRefChild
              ? " layer-drag-handle--hidden"
              : ""
          }`}
          aria-label={`Drag ${name}`}
          aria-hidden={type === "body" || isSyntheticRefChild}
          isDisabled={type === "body" || isSyntheticRefChild}
        >
          <GripVertical
            color={ICON_EDIT_PROPS.color}
            strokeWidth={ICON_EDIT_PROPS.stroke}
            size={ICON_EDIT_PROPS.size}
          />
        </Button>
        {type === "body" && (
          <Button className="iconButton" aria-label="Settings">
            <Settings2
              color={ICON_EDIT_PROPS.color}
              strokeWidth={ICON_EDIT_PROPS.stroke}
              size={ICON_EDIT_PROPS.size}
            />
          </Button>
        )}
        {type !== "body" && !isSyntheticRefChild && (
          <Button
            className="iconButton"
            aria-label={`Delete ${type}`}
            onPress={() => onDelete(element)}
          >
            <Trash
              color={ICON_EDIT_PROPS.color}
              strokeWidth={ICON_EDIT_PROPS.stroke}
              size={ICON_EDIT_PROPS.size}
            />
          </Button>
        )}
      </div>
      {contextMenuPosition && (
        <div
          className="layer-context-menu"
          role="menu"
          style={{
            left: `${contextMenuPosition.x}px`,
            top: `${contextMenuPosition.y}px`,
          }}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            className="layer-context-menu-item"
            onClick={handleDetachInstance}
            role="menuitem"
            type="button"
          >
            Detach instance
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================
// VirtualChild 콘텐츠
// ============================================

interface VirtualChildContentProps {
  node: LayerTreeNode;
  isFocusVisible: boolean;
  selectedTab?: { parentId: string; tabIndex: number } | null;
  onSelectTabElement?: (
    parentId: string,
    props: ElementProps,
    index: number,
  ) => void;
}

function VirtualChildContent({
  node,
  isFocusVisible,
  selectedTab,
  onSelectTabElement,
}: VirtualChildContentProps) {
  const {
    depth,
    name,
    virtualChildType,
    virtualChildIndex,
    virtualChildData,
    parentId,
    element,
  } = node;

  if (virtualChildIndex === undefined) return null;

  const isTabSelected =
    selectedTab?.parentId === parentId &&
    selectedTab?.tabIndex === virtualChildIndex;

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!onSelectTabElement || !parentId) return;
    onSelectTabElement(
      parentId,
      element.props as ElementProps,
      virtualChildIndex,
    );
  };

  const icon = getVirtualChildIcon(virtualChildType, virtualChildData);

  return (
    <div
      className={`elementItem ${isTabSelected ? "active" : ""} ${
        isFocusVisible ? "focused" : ""
      }`}
      onClick={handleClick}
      aria-disabled="true"
    >
      <div
        className="elementItemIndent"
        style={{ width: depth > 0 ? `${depth * 8}px` : "0px" }}
      />
      <div className="elementItemIcon">{icon}</div>
      <div className="elementItemLabel">{name}</div>
      <div className="elementItemActions">
        {/* react-aria DnD requires slot="drag" on all items for a11y */}
        <Button
          slot="drag"
          className="iconButton layer-drag-handle layer-drag-handle--hidden"
          aria-label={`Drag ${name}`}
          aria-hidden
          style={{ pointerEvents: "none" }}
          isDisabled
        >
          <GripVertical
            color={ICON_EDIT_PROPS.color}
            strokeWidth={ICON_EDIT_PROPS.stroke}
            size={ICON_EDIT_PROPS.size}
          />
        </Button>
      </div>
    </div>
  );
}

function getVirtualChildIcon(
  type: LayerTreeNode["virtualChildType"],
  data: unknown,
) {
  if (type === "tree") {
    const treeItem = data as TreeItemType;
    return treeItem.children && treeItem.children.length > 0 ? (
      <Folder
        color={ICON_EDIT_PROPS.color}
        strokeWidth={ICON_EDIT_PROPS.stroke}
        size={ICON_EDIT_PROPS.size}
      />
    ) : (
      <File
        color={ICON_EDIT_PROPS.color}
        strokeWidth={ICON_EDIT_PROPS.stroke}
        size={ICON_EDIT_PROPS.size}
      />
    );
  }

  return (
    <Box
      color={ICON_EDIT_PROPS.color}
      strokeWidth={ICON_EDIT_PROPS.stroke}
      size={ICON_EDIT_PROPS.size}
      style={{ padding: "2px" }}
    />
  );
}

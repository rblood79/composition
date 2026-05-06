import React from "react";
import { Button } from "react-aria-components";
import {
  ChevronRight,
  File,
  Home,
  Settings2,
  Trash,
  GripVertical,
} from "lucide-react";
import { ICON_EDIT_PROPS } from "../helpers";
import type { Page } from "../../../../../types/builder/unified.types";
import type { TreeItemState } from "../TreeBase/types";
import type { PageTreeNode } from "./types";

interface PageTreeItemContentProps {
  node: PageTreeNode;
  state: TreeItemState;
  onDelete: (page: Page) => Promise<void>;
  onSettings?: (page: Page) => void;
  onReselect?: (page: Page) => void;
}

/**
 * PageTree 아이템 콘텐츠
 * - 일반 페이지: 드래그/삭제 가능
 * - Home 페이지: 드래그/삭제 불가
 */
export function PageTreeItemContent({
  node,
  state,
  onDelete,
  onSettings,
  onReselect,
}: PageTreeItemContentProps) {
  const { depth, hasChildren, isRoot, page, name } = node;
  const { isSelected, isExpanded, isFocusVisible } = state;

  return (
    <div
      className={`elementItem ${isSelected ? "active" : ""} ${
        isFocusVisible ? "focused" : ""
      }`}
      onClick={(event) => {
        if (!isSelected) return;
        const target = event.target;
        if (target instanceof Element && target.closest("button")) return;
        onReselect?.(page);
      }}
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
        ) : isRoot ? (
          <Home
            color={ICON_EDIT_PROPS.color}
            strokeWidth={ICON_EDIT_PROPS.stroke}
            size={ICON_EDIT_PROPS.size}
            style={{ padding: "2px" }}
          />
        ) : (
          <File
            color={ICON_EDIT_PROPS.color}
            strokeWidth={ICON_EDIT_PROPS.stroke}
            size={ICON_EDIT_PROPS.size}
            style={{ padding: "2px" }}
          />
        )}
      </div>
      <div className="elementItemLabel">{name}</div>
      <div className="elementItemActions">
        {/* react-aria DnD requires slot="drag" on all items for a11y */}
        <Button
          slot="drag"
          className={`iconButton layer-drag-handle${
            isRoot ? " layer-drag-handle--hidden" : ""
          }`}
          aria-label={`Drag ${name}`}
          aria-hidden={isRoot}
          style={{ pointerEvents: isRoot ? "none" : "auto" }}
          isDisabled={isRoot}
        >
          <GripVertical
            color={ICON_EDIT_PROPS.color}
            strokeWidth={ICON_EDIT_PROPS.stroke}
            size={ICON_EDIT_PROPS.size}
          />
        </Button>
        {isRoot && (
          <Button
            className="iconButton"
            aria-label={`Settings for ${name}`}
            onPress={() => onSettings?.(page)}
          >
            <Settings2
              color={ICON_EDIT_PROPS.color}
              strokeWidth={ICON_EDIT_PROPS.stroke}
              size={ICON_EDIT_PROPS.size}
            />
          </Button>
        )}
        {!isRoot && (
          <Button
            className="iconButton"
            aria-label={`Delete ${name}`}
            onPress={() => onDelete(page)}
          >
            <Trash
              color={ICON_EDIT_PROPS.color}
              strokeWidth={ICON_EDIT_PROPS.stroke}
              size={ICON_EDIT_PROPS.size}
            />
          </Button>
        )}
      </div>
    </div>
  );
}

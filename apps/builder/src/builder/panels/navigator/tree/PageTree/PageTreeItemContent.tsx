import React, { useRef, useState } from "react";
import { Button } from "react-aria-components";
import {
  ChevronRight,
  File,
  Home,
  Settings2,
  GripVertical,
} from "lucide-react";
import { ICON_EDIT_PROPS } from "../helpers";
import type { Page } from "../../../../../types/builder/unified.types";
import type { TreeItemState } from "../TreeBase/types";
import type { PageTreeNode } from "./types";
import { ACTION_ICONS } from "../../../../config/actionIcons";

/** 여러 화면에 공통으로 나오는 액션의 아이콘 정본 (`config/actionIcons.ts`). */
const DeleteIcon = ACTION_ICONS.delete;

interface PageTreeItemContentProps {
  node: PageTreeNode;
  state: TreeItemState;
  onDelete: (page: Page) => Promise<void>;
  onSettings?: (page: Page) => void;
  onReselect?: (page: Page) => void;
  onRename?: (page: Page, title: string) => void;
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
  onRename,
}: PageTreeItemContentProps) {
  const { depth, hasChildren, isRoot, isSystemPage, page, name } = node;
  const { isSelected, isExpanded, isFocusVisible } = state;
  const isImmutablePage = isRoot || isSystemPage;
  const [isRenaming, setIsRenaming] = useState(false);
  const renameCancelRef = useRef(false);

  const beginRename = () => {
    if (isSystemPage || !onRename) return;
    renameCancelRef.current = false;
    onReselect?.(page);
    setIsRenaming(true);
  };

  const commitRename = (title: string) => {
    setIsRenaming(false);
    if (renameCancelRef.current) {
      renameCancelRef.current = false;
      return;
    }
    onRename?.(page, title);
  };

  return (
    <div
      className={`elementItem ${isSelected ? "active" : ""} ${
        isFocusVisible ? "focused" : ""
      }`}
      onClick={(event) => {
        if (!isSelected) return;
        const target = event.target;
        if (target instanceof Element && target.closest("button, input"))
          return;
        onReselect?.(page);
      }}
      onDoubleClick={(event) => {
        const target = event.target;
        if (target instanceof Element && target.closest("button, input"))
          return;
        event.stopPropagation();
        beginRename();
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
      <div className="elementItemLabel">
        {isRenaming ? (
          <input
            className="page-title-rename-input"
            aria-label={`Rename page ${name}`}
            defaultValue={page.title}
            autoFocus
            onFocus={(event) => event.currentTarget.select()}
            onPointerDown={(event) => event.stopPropagation()}
            onBlur={(event) => commitRename(event.currentTarget.value)}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              } else if (event.key === "Escape") {
                event.preventDefault();
                renameCancelRef.current = true;
                event.currentTarget.blur();
              }
            }}
          />
        ) : (
          name
        )}
      </div>
      <div className="elementItemActions">
        {/* react-aria DnD requires slot="drag" on all items for a11y */}
        <Button
          slot="drag"
          className={`iconButton layer-drag-handle${
            isImmutablePage ? " layer-drag-handle--hidden" : ""
          }`}
          aria-label={isImmutablePage ? undefined : `Drag ${name}`}
          aria-hidden={isImmutablePage}
          isDisabled={isImmutablePage}
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
        {!isImmutablePage && (
          <Button
            className="iconButton"
            aria-label={`Delete ${name}`}
            onPress={() => onDelete(page)}
          >
            <DeleteIcon
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

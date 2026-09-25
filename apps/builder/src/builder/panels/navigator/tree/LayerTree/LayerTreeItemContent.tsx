import React, { memo } from "react";
import { Button } from "react-aria-components/Button";
import {
  ChevronRight,
  Box,
  Folder,
  File,
  Settings2,
  GripVertical,
} from "lucide-react";
import { useContextMenu } from "../../../../components";
import { resolveContextMenuDisposition } from "../../../../components/overlay/contextMenu";
import { ICON_EDIT_PROPS, type TreeItem as TreeItemType } from "../helpers";
import type { ElementProps } from "../../../../../types/builder/elementProps.types";
import type { TreeItemState } from "../TreeBase/types";
import type { LayerTreeNode } from "./types";
import { useStore } from "../../../../stores";
import {
  getEditingSemanticsLabel,
  getEditingSemanticsRole,
} from "../../../../utils/editingSemantics";
import type { PanelNode } from "../../../panelNode";
import { ACTION_ICONS } from "../../../../config/actionIcons";
import { isBodyType } from "@composition/shared";

/** 여러 화면에 공통으로 나오는 액션의 아이콘 정본 (`config/actionIcons.ts`). */
const DeleteIcon = ACTION_ICONS.delete;

interface LayerTreeItemContentProps {
  node: LayerTreeNode;
  state: TreeItemState;
  onDelete: (element: PanelNode) => Promise<void>;
  selectedTab?: { parentId: string; tabIndex: number } | null;
  onSelectTabElement?: (
    parentId: string,
    props: ElementProps,
    index: number,
  ) => void;
  /** 안내선 k (1‥depth) 강조 여부 — index k−1. 생략하면 전부 기본색. */
  activeGuides?: readonly boolean[];
}

/**
 * 들여쓰기 안내선 (panel-ui 07, 2026-09-14) — depth 마다 16, 선은 expand 상자 (16) 중앙
 * x = 16k − 4 (행 padding 4 + 16(k−1) + 8). 행 높이 전체를 지나 위아래 행과 이어진다.
 * 종전 8/depth + 8 마다 gradient 선은 5단 이상에서 소속을 읽기 어려웠다.
 */
const INDENT_PER_DEPTH = 16;

function IndentGuides({
  depth,
  activeGuides,
}: {
  depth: number;
  activeGuides?: readonly boolean[];
}) {
  if (depth <= 0) return null;
  return (
    <div
      className="elementItemIndent"
      style={{ width: `${depth * INDENT_PER_DEPTH}px` }}
      aria-hidden="true"
    >
      {Array.from({ length: depth }, (_, k) => (
        <span
          key={k}
          className="layer-indent-guide"
          data-active={activeGuides?.[k] ? "true" : undefined}
          style={{ left: `${k * INDENT_PER_DEPTH + INDENT_PER_DEPTH / 2}px` }}
        />
      ))}
    </div>
  );
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
  activeGuides,
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
        activeGuides={activeGuides}
      />
    );
  }

  // 일반 요소 렌더링
  return (
    <NormalItemContent
      node={node}
      isSelected={state.isSelected}
      isExpanded={state.isExpanded}
      isFocusVisible={state.isFocusVisible}
      onDelete={onDelete}
      activeGuides={activeGuides}
    />
  );
}

// ============================================
// 일반 요소 콘텐츠
// ============================================

interface NormalItemContentProps {
  node: LayerTreeNode;
  isSelected: boolean;
  isExpanded: boolean;
  isFocusVisible: boolean;
  onDelete: (element: PanelNode) => Promise<void>;
  activeGuides?: readonly boolean[];
}

// RAC가 만드는 state 객체의 참조 변화가 무관한 가시 행의 content까지 재실행하지
// 않도록 소비하는 상태만 전달한다. 버튼의 RAC context 갱신은 memo 아래에서도 유지된다.
const NormalItemContent = memo(function NormalItemContent({
  node,
  isSelected,
  isExpanded,
  isFocusVisible,
  onDelete,
  activeGuides,
}: NormalItemContentProps) {
  const { depth, hasChildren, type, element, name, isSyntheticRefChild } = node;
  const { open: openContextMenu } = useContextMenu();
  const semanticsRole = getEditingSemanticsRole(element);
  const semanticsLabel = getEditingSemanticsLabel(semanticsRole);

  const handleContextMenu = (event: React.MouseEvent) => {
    // ADR-138 A-2: instance 뿐 아니라 일반 element 도 우클릭 메뉴 노출
    // ("Add as component" 진입점). body / synthetic ref child 만 제외.
    if (isSyntheticRefChild || isBodyType(type)) return;
    const disposition = resolveContextMenuDisposition({
      altKey: event.altKey,
      target: event.target,
    });
    if (disposition !== "suppress") return;

    const store = useStore.getState();
    const selectedIds = store.selectedElementIds.includes(element.id)
      ? [...store.selectedElementIds]
      : [element.id];
    const targetPageId = element.page_id ?? null;
    if (!store.selectedElementIds.includes(element.id)) {
      if (targetPageId && targetPageId !== store.currentPageId) {
        store.selectElementWithPageTransition(element.id, targetPageId);
      } else {
        store.setSelectedElement(element.id, element.props);
      }
    }

    openContextMenu({
      clientX: event.clientX,
      clientY: event.clientY,
      surface: "layer-item",
      targetElementIds: selectedIds,
    });
  };

  return (
    <div
      className={`elementItem ${isSelected ? "active" : ""} ${
        isFocusVisible ? "focused" : ""
      }`}
      onContextMenu={handleContextMenu}
    >
      <IndentGuides depth={depth} activeGuides={activeGuides} />
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
            isBodyType(type) || isSyntheticRefChild
              ? " layer-drag-handle--hidden"
              : ""
          }`}
          aria-label={`Drag ${name}`}
          aria-hidden={isBodyType(type) || isSyntheticRefChild}
          isDisabled={isBodyType(type) || isSyntheticRefChild}
        >
          <GripVertical
            color={ICON_EDIT_PROPS.color}
            strokeWidth={ICON_EDIT_PROPS.stroke}
            size={ICON_EDIT_PROPS.size}
          />
        </Button>
        {isBodyType(type) && (
          <Button className="iconButton" aria-label="Settings">
            <Settings2
              color={ICON_EDIT_PROPS.color}
              strokeWidth={ICON_EDIT_PROPS.stroke}
              size={ICON_EDIT_PROPS.size}
            />
          </Button>
        )}
        {!isBodyType(type) && !isSyntheticRefChild && (
          <Button
            className="iconButton"
            aria-label={`Delete ${type}`}
            onPress={() => onDelete(element)}
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
});

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
  activeGuides?: readonly boolean[];
}

function VirtualChildContent({
  node,
  isFocusVisible,
  selectedTab,
  onSelectTabElement,
  activeGuides,
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
      <IndentGuides depth={depth} activeGuides={activeGuides} />
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

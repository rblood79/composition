import {
  Button,
  Tree as AriaTree,
  TreeItem as AriaTreeItem,
  TreeItemContent as AriaTreeItemContent,
  TreeItemContentProps,
  TreeItemContentRenderProps,
  TreeItemProps as AriaTreeItemProps,
  TreeProps,
  Collection,
  composeRenderProps,
} from "react-aria-components";
import { InfoIcon, ChevronRightIcon, Minus } from "lucide-react";
import { MyCheckbox } from "./Checkbox";
import { resolveSelectionBehavior } from "./selectionStyle";
import type { DataBinding } from "../types";
import type { ComponentSize } from "../types";
import { useCollectionData } from "../hooks";
import { Skeleton } from "./Skeleton";

import "./styles/Tree.css";

export interface MyTreeProps<T extends object> extends TreeProps<T> {
  /**
   * M3 variant
   * @default 'primary'
   */
  variant?: string;
  /**
   * Size variant
   * @default 'md'
   */
  size?: ComponentSize;
  /**
   * Data binding configuration
   */
  dataBinding?: DataBinding;
  /**
   * Show loading skeleton instead of tree
   * @default false
   */
  isLoading?: boolean;
  /**
   * Number of skeleton tree nodes to show when loading
   * @default 3
   */
  skeletonNodeCount?: number;
  /**
   * RSP TreeView `selectionStyle` (2026-08-21) — 선택을 **무엇으로 표시하는가**.
   * - `"checkbox"`(기본): 행에 선택 체크박스를 그린다.
   * - `"highlight"`: 체크박스 없이 배경 강조만으로 표시하고, 클릭이 선택을 교체한다.
   *
   * RAC 는 같은 축을 `selectionBehavior`(`"toggle"` | `"replace"`)로 부른다 — D2 표면은
   * RSP 이름을 쓰고 변환은 아래 한 곳에서만 한다. 체크박스 자체는 `TreeItemContent` 가
   * RAC renderProps(`selectionBehavior`)로 판정하므로 이 값이 그대로 전파된다.
   */
  selectionStyle?: "checkbox" | "highlight";
}

/**
 * Tree Component with Material Design 3 support
 *
 * 🚀 Phase 4: data-* 패턴 전환
 * - tailwind-variants 제거
 * - data-variant, data-size 속성 사용
 *
 * M3 Features:
 * - 3 variants: primary, secondary, tertiary
 * - 3 sizes: sm, md, lg
 * - M3 color tokens for consistent theming
 *
 * Features:
 * - Hierarchical data display
 * - Expandable/collapsible nodes
 * - Selection support (single/multiple)
 * - Drag and drop support
 * - Keyboard navigation (Arrow keys, Home, End)
 * - Data binding support (Static, API, Supabase)
 *
 * @example
 * <Tree variant="primary" size="md">
 *   <TreeItem title="Folder 1">
 *     <TreeItem title="File 1.1" />
 *     <TreeItem title="File 1.2" />
 *   </TreeItem>
 * </Tree>
 */
export function Tree<T extends object>(props: MyTreeProps<T>) {
  const {
    variant = "primary",
    size = "md",
    dataBinding,
    isLoading: externalLoading,
    skeletonNodeCount = 3,
    children,
    selectionStyle,
    ...rest
  } = props;

  // selectionStyle(RSP) → selectionBehavior(RAC) 변환 단일 지점. 두 `<AriaTree>` 경로
  //   (dataBinding / static children)가 같은 객체를 spread 하므로 한쪽만 걸리는 일이 없다.
  //   호출자가 selectionBehavior 를 직접 준 경우는 그대로 존중.
  const restProps = {
    ...rest,
    // fallback 이 GridList("toggle")와 다르다 — Tree 는 렌더러가 오래 `"replace"` 를 넘겨
    //   체크박스 없는 상태가 실질 기본이었다. 무지정 문서의 동작을 보존한다.
    selectionBehavior: resolveSelectionBehavior({
      selectionStyle,
      selectionBehavior: rest.selectionBehavior,
      fallback: "replace",
    }),
  };

  // useCollectionData Hook - 항상 최상단에서 호출 (Rules of Hooks)
  const {
    data: treeData,
    loading,
    // error, // TODO: Add error handling UI
  } = useCollectionData({
    dataBinding,
    componentName: "Tree",
    fallbackData: [],
  });

  // External loading state - show skeleton tree
  if (externalLoading) {
    return (
      <div
        className={
          restProps.className
            ? `react-aria-Tree ${restProps.className}`
            : "react-aria-Tree"
        }
        data-composition-tree="true"
        data-variant={variant}
        data-size={size}
        role="tree"
        aria-busy="true"
        aria-label="Loading tree..."
      >
        {Array.from({ length: skeletonNodeCount }).map((_, i) => (
          <div
            key={i}
            className="react-aria-TreeItem"
            style={{ paddingLeft: i === 1 ? "24px" : i === 2 ? "48px" : "0" }}
          >
            <Skeleton componentVariant="tree-node" size={size} index={i} />
          </div>
        ))}
      </div>
    );
  }

  const treeClassName = composeRenderProps(restProps.className, (cls) =>
    cls ? `react-aria-Tree ${cls}` : "react-aria-Tree",
  );

  // DataBinding이 있고 데이터가 로드된 경우
  if (dataBinding && treeData.length > 0) {
    const renderTreeItemsRecursively = (
      items: Record<string, unknown>[],
    ): React.ReactNode => {
      return items.map((item) => {
        const itemId = String(item.id || item.name || Math.random());
        const displayTitle = String(
          item.name || item.label || item.title || itemId,
        );
        const hasChildren =
          Array.isArray(item.children) && item.children.length > 0;

        return (
          <TreeItem
            key={itemId}
            id={itemId}
            title={displayTitle}
            hasChildren={hasChildren}
            showInfoButton={false}
            childItems={
              hasChildren
                ? renderTreeItemsRecursively(
                    item.children as Record<string, unknown>[],
                  )
                : undefined
            }
          />
        );
      });
    };

    return (
      <AriaTree
        {...restProps}
        className={treeClassName}
        data-composition-tree="true"
        data-variant={variant}
        data-size={size}
      >
        {loading ? (
          <TreeItem
            key="loading"
            id="loading"
            title="Loading..."
            hasChildren={false}
            showInfoButton={false}
          />
        ) : (
          renderTreeItemsRecursively(treeData)
        )}
      </AriaTree>
    );
  }

  // Static children
  return (
    <AriaTree
      {...restProps}
      className={treeClassName}
      data-composition-tree="true"
      data-variant={variant}
      data-size={size}
    >
      {children}
    </AriaTree>
  );
}

export function TreeItemContent(
  props: Omit<TreeItemContentProps, "children"> & {
    children?: React.ReactNode;
    hasChildren?: boolean;
  },
) {
  return (
    <AriaTreeItemContent {...props}>
      {(renderProps: TreeItemContentRenderProps) => (
        <>
          {renderProps.selectionBehavior === "toggle" &&
            renderProps.selectionMode !== "none" && (
              <MyCheckbox slot="selection" />
            )}
          <Button slot="chevron">
            {props.hasChildren ? (
              <ChevronRightIcon size={16} data-chevron="true" />
            ) : (
              <Minus size={16} data-minus="true" />
            )}
          </Button>
          {props.children}
        </>
      )}
    </AriaTreeItemContent>
  );
}

export interface TreeItemProps extends Omit<
  Partial<AriaTreeItemProps>,
  "value"
> {
  title?: string;
  value?: string;
  label?: string;
  children?: React.ReactNode;
  showInfoButton?: boolean;
  onInfoClick?: () => void;
  hasChildren?: boolean;
  childItems?: React.ReactNode; // 하위 TreeItem들을 위한 별도 prop
}

export function TreeItem(props: TreeItemProps) {
  const {
    title,
    value,
    label,
    children,
    showInfoButton = true,
    onInfoClick,
    hasChildren,
    childItems,
    ...restProps
  } = props;

  const displayTitle = String(title || label || value || "");
  const actualHasChildren = hasChildren ?? childItems != null;

  return (
    <AriaTreeItem
      textValue={displayTitle}
      {...restProps}
      className="react-aria-TreeItem"
    >
      <TreeItemContent hasChildren={actualHasChildren}>
        <span className="tree-item-title">{displayTitle}</span>
        {children} {/* 다른 컴포넌트들 (Button, Text 등) */}
        {showInfoButton && (
          <Button
            aria-label={`${displayTitle} 정보`}
            onPress={onInfoClick}
            className="tree-item-info-button"
          >
            <InfoIcon size={16} />
          </Button>
        )}
      </TreeItemContent>

      {/* 하위 TreeItem들을 Collection으로 래핑 */}
      {childItems && <Collection items={[]}>{childItems}</Collection>}
    </AriaTreeItem>
  );
}

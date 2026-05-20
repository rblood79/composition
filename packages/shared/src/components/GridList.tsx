/**
 * GridList Component - Material Design 3
 *
 * M3 Variants: primary, secondary, tertiary, error, filled
 * Sizes: sm, md, lg
 */

import React from "react";
import {
  Button,
  GridList as AriaGridList,
  GridListHeader as AriaGridListHeader,
  GridListItem as AriaGridListItem,
  GridListItemProps,
  GridListProps,
  GridListSection as AriaGridListSection,
} from "react-aria-components";
import { MyCheckbox } from "./Checkbox";
import type { DataBinding, ColumnMapping, DataBindingValue } from "../types";
import {
  toGridListRacProps,
  type GridListCanonicalProps,
  type GridListEntryDescriptor,
  type GridListItemDescriptor,
} from "../catalog/outputs/toRacProps";

import { useCollectionData } from "../hooks";

import "./styles/GridList.css";

/**
 * 🚀 Phase 4: data-* 패턴 전환
 * - tailwind-variants 제거
 * - data-variant, data-size 속성 사용
 */

interface ExtendedGridListProps<T extends object> extends Omit<
  GridListProps<T>,
  "renderEmptyState"
> {
  dataBinding?: DataBinding | DataBindingValue;
  columnMapping?: ColumnMapping;
  // Layout
  layout?: "stack" | "grid";
  columns?: number;
  // M3 props
  variant?: string;
  /**
   * React Aria 1.13.0: 커스텀 필터 함수
   * @example filter={(item) => item.status === 'active'}
   */
  filter?: (item: T) => boolean;
  /**
   * React Aria 1.13.0: 텍스트 기반 필터링
   * @example filterText="search query"
   */
  filterText?: string;
  /**
   * React Aria 1.13.0: 필터링 대상 필드 목록
   * @default ['label', 'name', 'title']
   */
  filterFields?: (keyof T)[];
  renderEmptyState?: boolean | GridListProps<T>["renderEmptyState"];
}

export function GridList<T extends object>({
  children,
  dataBinding,
  columnMapping,
  items: inputItems,
  layout = "stack",
  columns = 2,
  variant = "primary",
  filter,
  filterText,
  filterFields = ["label", "name", "title"] as (keyof T)[],
  renderEmptyState,
  ...props
}: ExtendedGridListProps<T>) {
  const projectedProps = toGridListRacProps({
    ...props,
    items: inputItems,
    variant,
    layout,
    columns,
    filterText,
    filterFields,
    renderEmptyState,
  } as GridListCanonicalProps);
  const projectedAriaProps = {
    "aria-label": projectedProps["aria-label"],
    selectionMode: projectedProps.selectionMode,
    selectionBehavior: projectedProps.selectionBehavior,
    disallowEmptySelection: projectedProps.disallowEmptySelection,
    autoFocus: projectedProps.autoFocus,
    isDisabled: projectedProps.isDisabled,
    allowsDragging: projectedProps.allowsDragging,
    validationBehavior: projectedProps.validationBehavior,
    ...(typeof renderEmptyState === "function" ? { renderEmptyState } : {}),
  };
  // useCollectionData Hook으로 데이터 가져오기 (Static, API, Supabase 통합)
  const {
    data: boundData,
    loading,
    error,
  } = useCollectionData({
    dataBinding: dataBinding as DataBinding,
    componentName: "GridList",
    fallbackData: [
      { id: 1, name: "Item 1", description: "Description 1" },
      { id: 2, name: "Item 2", description: "Description 2" },
    ],
  });

  // React Aria 1.13.0: 필터링 로직
  const filteredData = React.useMemo(() => {
    let result = [...boundData];

    // 커스텀 필터 적용
    if (filter) {
      result = result.filter((item) => filter(item as unknown as T));
    }

    // 텍스트 필터 적용
    if (projectedProps.filterText && projectedProps.filterText.trim()) {
      const searchText = projectedProps.filterText.toLowerCase().trim();
      const projectedFilterFields =
        projectedProps.filterFields ??
        filterFields.map((field) => String(field));
      result = result.filter((item) =>
        projectedFilterFields.some((field) => {
          const value = item[field as string];
          return value && String(value).toLowerCase().includes(searchText);
        }),
      );
    }

    return result;
  }, [
    boundData,
    filter,
    projectedProps.filterText,
    projectedProps.filterFields,
    filterFields,
  ]);

  // DataBinding이 있고 데이터가 로드되었을 때 동적 아이템 생성
  // PropertyDataBinding 형식 (source, name) 또는 DataBinding 형식 (type: "collection") 둘 다 지원
  const isPropertyBinding =
    dataBinding &&
    "source" in dataBinding &&
    "name" in dataBinding &&
    !("type" in dataBinding);
  const hasDataBinding =
    (!isPropertyBinding &&
      dataBinding &&
      "type" in dataBinding &&
      dataBinding.type === "collection") ||
    isPropertyBinding;

  // GridList className generator (reused across all conditional renders)
  // 🚀 ClassNameOrFunction 타입 지원 - 문자열로 단순화
  const baseClassName = projectedProps.className;
  const gridListClassName = baseClassName
    ? `react-aria-GridList ${baseClassName}`
    : "react-aria-GridList";
  const gridListStyle = {
    ...projectedProps.style,
    ...(projectedProps.layout === "grid"
      ? ({ "--gl-columns": projectedProps.columns } as React.CSSProperties)
      : {}),
  };

  // ColumnMapping이 있으면 각 데이터 항목마다 GridListItem 렌더링
  // ListBox와 동일한 패턴: Element tree의 GridListItem 템플릿 + Field 자식 사용
  if (hasDataBinding && columnMapping) {
    console.log("🎯 GridList: columnMapping 감지 - 데이터로 아이템 렌더링", {
      columnMapping,
      hasChildren: !!children,
      childrenType: typeof children,
      isChildrenFunction: typeof children === "function",
      dataCount: filteredData.length,
      loading,
      error,
    });

    // Loading 상태
    if (loading) {
      return (
        <AriaGridList
          {...props}
          {...projectedAriaProps}
          className={gridListClassName}
          data-variant={projectedProps.variant}
          data-layout={projectedProps.layout}
          layout={projectedProps.layout}
          style={gridListStyle}
        >
          <AriaGridListItem
            key="loading"
            value={{}}
            className="react-aria-GridListItem"
          >
            {({ selectionMode, selectionBehavior, allowsDragging }) => (
              <>
                {allowsDragging && <Button slot="drag">≡</Button>}
                {selectionMode === "multiple" &&
                  selectionBehavior === "toggle" && (
                    <MyCheckbox slot="selection" />
                  )}
                ⏳ 데이터 로딩 중...
              </>
            )}
          </AriaGridListItem>
        </AriaGridList>
      );
    }

    // Error 상태
    if (error) {
      return (
        <AriaGridList
          {...props}
          {...projectedAriaProps}
          className={gridListClassName}
          data-variant={projectedProps.variant}
          data-layout={projectedProps.layout}
          layout={projectedProps.layout}
          style={gridListStyle}
        >
          <AriaGridListItem
            key="error"
            value={{}}
            className="react-aria-GridListItem"
          >
            {({ selectionMode, selectionBehavior, allowsDragging }) => (
              <>
                {allowsDragging && <Button slot="drag">≡</Button>}
                {selectionMode === "multiple" &&
                  selectionBehavior === "toggle" && (
                    <MyCheckbox slot="selection" />
                  )}
                ❌ 오류: {error}
              </>
            )}
          </AriaGridListItem>
        </AriaGridList>
      );
    }

    // 데이터가 있을 때: items prop 사용
    if (filteredData.length > 0) {
      const items = filteredData.map((item, index) => ({
        id: String(item.id || index),
        ...item,
      })) as T[];

      console.log("✅ GridList with columnMapping - items:", items);

      return (
        <AriaGridList
          {...props}
          {...projectedAriaProps}
          className={gridListClassName}
          data-variant={projectedProps.variant}
          data-layout={projectedProps.layout}
          layout={projectedProps.layout}
          style={gridListStyle}
          items={items}
        >
          {children}
        </AriaGridList>
      );
    }

    // 데이터 없음
    return (
      <AriaGridList
        {...props}
        {...projectedAriaProps}
        className={gridListClassName}
        data-variant={projectedProps.variant}
        data-layout={projectedProps.layout}
        layout={projectedProps.layout}
        style={gridListStyle}
      >
        {children}
      </AriaGridList>
    );
  }

  // Dynamic Collection: items prop 사용 (columnMapping 없을 때)
  if (hasDataBinding) {
    // Loading 상태
    if (loading) {
      return (
        <AriaGridList
          {...props}
          {...projectedAriaProps}
          className={gridListClassName}
          data-variant={projectedProps.variant}
          data-layout={projectedProps.layout}
          layout={projectedProps.layout}
          style={gridListStyle}
        >
          <AriaGridListItem
            key="loading"
            value={{}}
            className="react-aria-GridListItem"
          >
            {({ selectionMode, selectionBehavior, allowsDragging }) => (
              <>
                {allowsDragging && <Button slot="drag">≡</Button>}
                {selectionMode === "multiple" &&
                  selectionBehavior === "toggle" && (
                    <MyCheckbox slot="selection" />
                  )}
                ⏳ 데이터 로딩 중...
              </>
            )}
          </AriaGridListItem>
        </AriaGridList>
      );
    }

    // Error 상태
    if (error) {
      return (
        <AriaGridList
          {...props}
          {...projectedAriaProps}
          className={gridListClassName}
          data-variant={projectedProps.variant}
          data-layout={projectedProps.layout}
          layout={projectedProps.layout}
          style={gridListStyle}
        >
          <AriaGridListItem
            key="error"
            value={{}}
            className="react-aria-GridListItem"
          >
            {({ selectionMode, selectionBehavior, allowsDragging }) => (
              <>
                {allowsDragging && <Button slot="drag">≡</Button>}
                {selectionMode === "multiple" &&
                  selectionBehavior === "toggle" && (
                    <MyCheckbox slot="selection" />
                  )}
                ❌ 오류: {error}
              </>
            )}
          </AriaGridListItem>
        </AriaGridList>
      );
    }

    // 데이터가 로드되었을 때
    if (filteredData.length > 0) {
      const items = filteredData.map((item, index) => ({
        id: String(item.id || index),
        label: String(
          item.name || item.title || item.label || `Item ${index + 1}`,
        ),
        ...item,
      }));

      console.log("✅ GridList Dynamic Collection - items:", items);

      return (
        <AriaGridList
          {...props}
          {...projectedAriaProps}
          className={gridListClassName}
          data-variant={projectedProps.variant}
          data-layout={projectedProps.layout}
          layout={projectedProps.layout}
          style={gridListStyle}
          items={items}
        >
          {(item) => (
            <AriaGridListItem
              key={item.id}
              id={item.id}
              textValue={item.label}
              className="react-aria-GridListItem"
            >
              {({ selectionMode, selectionBehavior, allowsDragging }) => (
                <>
                  {allowsDragging && <Button slot="drag">≡</Button>}
                  {selectionMode === "multiple" &&
                    selectionBehavior === "toggle" && (
                      <MyCheckbox slot="selection" />
                    )}
                  <span className="gridlist-item-label">{item.label}</span>
                  {(item as Record<string, unknown>).description && (
                    <span className="gridlist-item-description">
                      {String((item as Record<string, unknown>).description)}
                    </span>
                  )}
                </>
              )}
            </AriaGridListItem>
          )}
        </AriaGridList>
      );
    }
  }

  // Static Children (기존 방식)
  const staticChildren =
    children ??
    projectedProps.items?.map((entry) => renderStaticGridListEntry(entry));
  const shouldPassInputItems =
    inputItems !== undefined && typeof children === "function";

  return (
    <AriaGridList
      {...props}
      {...projectedAriaProps}
      {...(shouldPassInputItems ? { items: inputItems } : {})}
      className={gridListClassName}
      data-variant={projectedProps.variant}
      data-layout={projectedProps.layout}
      layout={projectedProps.layout}
      style={gridListStyle}
    >
      {staticChildren}
    </AriaGridList>
  );
}

export { GridList as MyGridList };

export function GridListItem({
  children,
  ...props
}: Omit<GridListItemProps, "children"> & {
  children?: React.ReactNode;
}) {
  const textValue = typeof children === "string" ? children : undefined;
  return (
    <AriaGridListItem
      textValue={textValue}
      {...props}
      className="react-aria-GridListItem"
    >
      {({ selectionMode, selectionBehavior, allowsDragging }) => (
        <>
          {/* Add elements for drag and drop and selection. */}
          {allowsDragging && <Button slot="drag">≡</Button>}
          {selectionMode === "multiple" && selectionBehavior === "toggle" && (
            <MyCheckbox slot="selection" />
          )}
          {children}
        </>
      )}
    </AriaGridListItem>
  );
}

function renderStaticGridListEntry(
  entry: GridListEntryDescriptor,
): React.ReactNode {
  if (entry.type === "section") {
    return (
      <AriaGridListSection key={entry.id} aria-label={entry.ariaLabel}>
        <AriaGridListHeader>{entry.header}</AriaGridListHeader>
        {entry.items.map((item) => renderStaticGridListItem(item))}
      </AriaGridListSection>
    );
  }

  return renderStaticGridListItem(entry);
}

function renderStaticGridListItem(
  item: GridListItemDescriptor,
): React.ReactNode {
  return (
    <AriaGridListItem
      key={item.id}
      id={item.id}
      textValue={item.textValue ?? item.label}
      isDisabled={item.isDisabled}
      className="react-aria-GridListItem"
    >
      {({ selectionMode, selectionBehavior, allowsDragging }) => (
        <>
          {allowsDragging && <Button slot="drag">≡</Button>}
          {selectionMode === "multiple" && selectionBehavior === "toggle" && (
            <MyCheckbox slot="selection" />
          )}
          <span className="gridlist-item-label">{item.label}</span>
          {item.description ? (
            <span className="gridlist-item-description">
              {item.description}
            </span>
          ) : null}
        </>
      )}
    </AriaGridListItem>
  );
}

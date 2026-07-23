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
  GridListItem as AriaGridListItem,
  GridListItemProps,
  GridListProps,
  Text,
} from "react-aria-components";
import { MyCheckbox } from "./Checkbox";
import type { DataBinding, ColumnMapping, DataBindingValue } from "../types";

import { useResolvedCollectionItems } from "../hooks";

import "./styles/GridList.css";

/**
 * 🚀 Phase 4: data-* 패턴 전환
 * - tailwind-variants 제거
 * - data-variant, data-size 속성 사용
 */

interface ExtendedGridListProps<T extends object> extends Omit<
  GridListProps<T>,
  "items"
> {
  dataBinding?: DataBinding | DataBindingValue;
  columnMapping?: ColumnMapping;
  /**
   * ADR-912 영역 B Task 5: 정적 items[] SSOT (StoredGridListItem[] 직렬화 형태).
   *   RAC `GridListProps.items`(Iterable<T>)를 재의미화 — dataBinding 없을 때 source.
   *   useResolvedCollectionItems 가 dataBinding 과 동일 normalizer 로 흡수한다.
   *   section entry(`type:"section"`)가 섞이면 정적 children 경로로 보존(flat guard).
   */
  items?: unknown[];
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
}

export function GridList<T extends object>({
  children,
  dataBinding,
  columnMapping,
  items,
  layout = "stack",
  columns = 2,
  variant = "primary",
  filter,
  filterText,
  filterFields = ["label", "name", "title"] as (keyof T)[],
  ...props
}: ExtendedGridListProps<T>) {
  // ADR-912 영역 B Task 5: flat guard — 정적 items 에 section entry(`type:"section"`)가
  //   섞이면 useResolvedCollectionItems(toItemProjectionRow)는 section 을 모르고 flat item 으로
  //   잘못 펴므로(header 소실), 이번 slice 에서 강제 normalize 하지 않고 정적 children 경로로
  //   보존한다. section 통합은 legacy renderGridList / Skia section projector 에 격리(설계 §Task 5 보류).
  const hasSectionEntry = React.useMemo(
    () =>
      Array.isArray(items) &&
      items.some(
        (entry) =>
          entry != null &&
          typeof entry === "object" &&
          (entry as { type?: string }).type === "section",
      ),
    [items],
  );

  // ADR-912 영역 B Task 5: collection source acquisition 단일화.
  //   useCollectionData 직접 호출(이중 source)을 제거하고 useResolvedCollectionItems 단일 진입점으로 통일.
  //   dataBinding(async/dataTable/API)과 정적 props.items 가 같은 toItemProjectionRow normalizer 를
  //   통과 → DOM wrapper 와 Skia projector(getFlatProjectionRows)가 동일 row 형태(CollectionProjectionRow).
  //   section entry 가 섞인 경우(flat guard)는 정적 source 를 hook 에 넘기지 않아 children 경로로 보존.
  const {
    rows: resolvedRows,
    loading,
    error,
  } = useResolvedCollectionItems({
    dataBinding: dataBinding as DataBinding,
    items: hasSectionEntry ? undefined : items,
    componentName: "GridList",
    fallbackData: [
      { id: 1, name: "Item 1", description: "Description 1" },
      { id: 2, name: "Item 2", description: "Description 2" },
    ],
  });

  // React Aria 1.13.0: 필터링 로직 (raw item 기반 — row.item 에 원본 보존).
  //   filter/filterText 는 raw item 시그니처(T)를 받으므로 정규화 rows 의 row.item 으로 적용.
  const filteredRows = React.useMemo(() => {
    let result = resolvedRows;

    // 커스텀 필터 적용
    if (filter) {
      result = result.filter((row) => filter(row.item as unknown as T));
    }

    // 텍스트 필터 적용
    if (filterText && filterText.trim()) {
      const searchText = filterText.toLowerCase().trim();
      result = result.filter((row) => {
        const item = row.item as Record<string, unknown>;
        if (!item || typeof item !== "object") {
          return row.label.toLowerCase().includes(searchText);
        }
        return filterFields.some((field) => {
          const value = item[field as string];
          return value && String(value).toLowerCase().includes(searchText);
        });
      });
    }

    return result;
  }, [resolvedRows, filter, filterText, filterFields]);

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

  // ADR-912 영역 B Task 5: dataBinding 유무와 무관하게 해소된 row 가 있으면 카드 렌더.
  //   정적 flat items(props.items)도 useResolvedCollectionItems 가 resolvedRows 로 채우므로
  //   기존 `if (hasDataBinding)` 분기를 `hasResolvedRows` 로 확장 → 정적 items 가 Static Children
  //   으로 떨어지지 않고 실제 카드로 렌더(catalog DOM seam 해소). dataBinding 전용 columnMapping
  //   분기는 hasDataBinding 게이트 유지(템플릿 모드는 dataBinding 계약).
  const hasResolvedRows = filteredRows.length > 0;

  // GridList className generator (reused across all conditional renders)
  // 🚀 ClassNameOrFunction 타입 지원 - 문자열로 단순화
  const baseClassName =
    typeof props.className === "string" ? props.className : undefined;
  const gridListClassName = baseClassName
    ? `react-aria-GridList ${baseClassName}`
    : "react-aria-GridList";
  const gridListStyle = {
    ...props.style,
    ...(layout === "grid"
      ? ({ "--gl-columns": columns } as React.CSSProperties)
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
      dataCount: filteredRows.length,
      loading,
      error,
    });

    // Loading 상태
    if (loading) {
      return (
        <AriaGridList
          {...props}
          className={gridListClassName}
          data-variant={variant}
          layout={layout}
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
          className={gridListClassName}
          data-variant={variant}
          layout={layout}
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

    // 데이터가 있을 때: items prop 사용 (resolvedRows 의 원본 item 보존)
    if (hasResolvedRows) {
      const items = filteredRows.map((row) => ({
        ...(row.item as Record<string, unknown>),
        id: row.itemKey,
      })) as T[];

      console.log("✅ GridList with columnMapping - items:", items);

      return (
        <AriaGridList
          {...props}
          className={gridListClassName}
          data-variant={variant}
          layout={layout}
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
        className={gridListClassName}
        data-variant={variant}
      >
        {children}
      </AriaGridList>
    );
  }

  // Dynamic Collection: items prop 사용 (columnMapping 없을 때)
  //   ADR-912 Task 5: hasResolvedRows 게이트 — 정적 flat items 도 여기서 카드 렌더
  //   (기존 hasDataBinding 게이트는 정적 items 를 Static Children 으로 떨어뜨려 카드 미렌더).
  if (hasResolvedRows) {
    // Loading 상태
    if (loading) {
      return (
        <AriaGridList
          {...props}
          className={gridListClassName}
          data-variant={variant}
          layout={layout}
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
          className={gridListClassName}
          data-variant={variant}
          layout={layout}
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

    // 데이터가 로드되었을 때 (resolvedRows 의 정규화 label/itemKey + 원본 item 필드 보존)
    if (hasResolvedRows) {
      const items = filteredRows.map((row) => ({
        ...(row.item as Record<string, unknown>),
        id: row.itemKey,
        label: row.label,
      }));

      console.log("✅ GridList Dynamic Collection - items:", items);

      return (
        <AriaGridList
          {...props}
          className={gridListClassName}
          data-variant={variant}
          layout={layout}
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
                  {/* RAC GridListItem 의 TextContext 는 DEFAULT_SLOT + description 만
                      제공(label slot 없음) — `slot="label"` 은 "Invalid slot" 크래시.
                      label 은 default slot Text 로 렌더하고 CSS 로 스타일(GridList.css
                      `.react-aria-Text:not([slot="description"])`). accessible name 은
                      AriaGridListItem `textValue` 가 담당. */}
                  <Text>{item.label}</Text>
                  {(item as Record<string, unknown>).description && (
                    <Text slot="description">
                      {String((item as Record<string, unknown>).description)}
                    </Text>
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
  return (
    <AriaGridList
      {...props}
      className={gridListClassName}
      data-variant={variant}
      layout={layout}
      style={gridListStyle}
    >
      {children}
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

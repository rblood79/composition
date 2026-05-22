/**
 * ListBox Component - Material Design 3
 *
 * M3 Variants: primary, secondary, tertiary, error, filled
 * Sizes: sm, md, lg
 *
 * Virtualization: 대용량 데이터 성능 최적화 (enableVirtualization=true)
 * - @tanstack/react-virtual 사용
 * - 10,000+ 아이템 원활 처리 가능
 *
 * React Aria 1.13.0: 필터링 기능 추가
 * - filter: 커스텀 필터 함수
 * - filterText: 텍스트 기반 필터링
 * - filterFields: 필터링 대상 필드
 */

import React, {
  useRef,
  useCallback,
  useMemo,
  useEffect,
  useState,
} from "react";
import {
  ListBox as AriaListBox,
  ListBoxItem as AriaListBoxItem,
  ListBoxItemProps,
  ListBoxProps,
  composeRenderProps,
} from "react-aria-components";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { DataBinding, ColumnMapping, DataBindingValue } from "../types";

import { useCollectionData } from "../hooks";
import {
  CollectionLoadingState,
  CollectionErrorDisplay,
} from "./CollectionErrorState";
import { Skeleton } from "./Skeleton";

import "./styles/ListBox.css";

// 아이템 높이 고정값 (가상화용)
const ITEM_HEIGHT = 40;

interface ExtendedListBoxProps<T extends object> extends ListBoxProps<T> {
  dataBinding?: DataBinding | DataBindingValue;
  columnMapping?: ColumnMapping;
  // M3 props
  variant?: string;
  // Virtualization props
  enableVirtualization?: boolean;
  height?: number; // 컨테이너 높이 (px), default: 300
  overscan?: number; // 뷰포트 외 추가 렌더 아이템 수, default: 5
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
  /**
   * Show loading skeleton instead of list
   * Overrides internal loading state
   * @default false
   */
  isLoading?: boolean;
  /**
   * Number of skeleton items to show when loading
   * @default 5
   */
  skeletonCount?: number;
}

/**
 * 🚀 Phase 4: data-* 패턴 전환
 * - tailwind-variants 제거
 * - data-variant, data-size 속성 사용
 */

export function ListBox<T extends object>({
  children,
  dataBinding,
  columnMapping,
  variant = "primary",
  enableVirtualization = false,
  height = 300,
  overscan = 5,
  filter,
  filterText,
  filterFields = ["label", "name", "title"] as (keyof T)[],
  isLoading: externalLoading,
  skeletonCount = 5,
  ...props
}: ExtendedListBoxProps<T>) {
  // ================================================================
  // Hooks - 항상 최상단에서 무조건 호출 (Rules of Hooks)
  // ================================================================

  const { onSelectionChange, selectedKeys } = props;

  // Refs for virtualization
  const parentRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  // useCollectionData Hook으로 데이터 가져오기 (Static, API, Supabase 통합)
  const {
    data: boundData,
    loading,
    error,
    reload,
  } = useCollectionData({
    dataBinding: dataBinding as DataBinding,
    componentName: "ListBox",
    fallbackData: [
      { id: 1, name: "User 1", email: "user1@example.com", role: "Admin" },
      { id: 2, name: "User 2", email: "user2@example.com", role: "User" },
    ],
  });

  // 아이템 높이 고정값
  const itemHeight = ITEM_HEIGHT;

  // React Aria 1.13.0: 필터링 로직
  const filteredData = React.useMemo(() => {
    let result = [...boundData];

    // 커스텀 필터 적용
    if (filter) {
      result = result.filter((item) => filter(item as unknown as T));
    }

    // 텍스트 필터 적용
    if (filterText && filterText.trim()) {
      const searchText = filterText.toLowerCase().trim();
      result = result.filter((item) =>
        filterFields.some((field) => {
          const value = item[field as string];
          return value && String(value).toLowerCase().includes(searchText);
        }),
      );
    }

    return result;
  }, [boundData, filter, filterText, filterFields]);

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

  // ListBox className generator (reused across all conditional renders)
  const getListBoxClassName = (baseClassName?: ListBoxProps<T>["className"]) =>
    composeRenderProps(baseClassName, (className) => {
      return className
        ? `react-aria-ListBox ${className}`
        : "react-aria-ListBox";
    });

  // 가상화용 아이템 배열 (메모이제이션) - filteredData 사용
  const virtualItems = useMemo(() => {
    if (!hasDataBinding || filteredData.length === 0) return [];
    return filteredData.map((item, index) => ({
      id: String(item.id || index),
      label: String(
        item.name || item.title || item.label || `Item ${index + 1}`,
      ),
      ...item,
    }));
  }, [hasDataBinding, filteredData]);

  // useVirtualizer 설정
  // eslint-disable-next-line react-hooks/incompatible-library -- useVirtualizer()는 React Compiler에서 memoize 불가
  const virtualizer = useVirtualizer({
    count: enableVirtualization ? virtualItems.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemHeight,
    overscan,
    enabled: enableVirtualization && virtualItems.length > 0,
  });

  // 선택된 아이템으로 스크롤
  useEffect(() => {
    if (!enableVirtualization || !selectedKeys) return;

    const keys = selectedKeys as Iterable<string | number>;
    const firstKey = Array.from(keys)[0];
    if (firstKey !== undefined) {
      const index = virtualItems.findIndex(
        (item) => item.id === String(firstKey),
      );
      if (index !== -1) {
        virtualizer.scrollToIndex(index, { align: "auto" });
        setFocusedIndex(index);
      }
    }
  }, [enableVirtualization, selectedKeys, virtualItems, virtualizer]);

  // 키보드 네비게이션 핸들러
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!enableVirtualization) return;

      const count = virtualItems.length;
      if (count === 0) return;

      let newIndex = focusedIndex;
      let handled = false;

      switch (e.key) {
        case "ArrowDown":
          newIndex = Math.min(focusedIndex + 1, count - 1);
          handled = true;
          break;
        case "ArrowUp":
          newIndex = Math.max(focusedIndex - 1, 0);
          handled = true;
          break;
        case "Home":
          newIndex = 0;
          handled = true;
          break;
        case "End":
          newIndex = count - 1;
          handled = true;
          break;
        case "Enter":
        case " ":
          if (focusedIndex >= 0 && focusedIndex < count && onSelectionChange) {
            const item = virtualItems[focusedIndex];
            onSelectionChange(new Set([item.id]));
            handled = true;
          }
          break;
      }

      if (handled) {
        e.preventDefault();
        e.stopPropagation();
        if (newIndex !== focusedIndex) {
          setFocusedIndex(newIndex);
          virtualizer.scrollToIndex(newIndex, { align: "auto" });
        }
      }
    },
    [
      enableVirtualization,
      focusedIndex,
      virtualItems,
      virtualizer,
      onSelectionChange,
    ],
  );

  // ================================================================
  // Early Returns (모든 Hooks 호출 후)
  // ================================================================

  // External isLoading prop - shows skeleton immediately
  if (externalLoading) {
    return (
      <div
        className={`react-aria-ListBox ${variant}`}
        role="listbox"
        aria-busy="true"
        aria-label="Loading list..."
      >
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <Skeleton key={i} componentVariant="list-item" size="md" index={i} />
        ))}
      </div>
    );
  }

  // ========== 가상화 렌더링 ==========
  if (enableVirtualization && hasDataBinding && virtualItems.length > 0) {
    // Loading 상태
    if (loading) {
      return (
        <div
          className={`react-aria-ListBox virtualized ${variant}`}
          style={{ height }}
        >
          <CollectionLoadingState size="md" height={height} />
        </div>
      );
    }

    // Error 상태
    if (error) {
      return (
        <div
          className={`react-aria-ListBox virtualized ${variant}`}
          style={{ height }}
        >
          <CollectionErrorDisplay
            error={error}
            onRetry={reload}
            height={height}
          />
        </div>
      );
    }

    const virtualRows = virtualizer.getVirtualItems();
    const totalSize = virtualizer.getTotalSize();

    return (
      <div
        ref={parentRef}
        role="listbox"
        aria-label={props["aria-label"] || "List"}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className={`react-aria-ListBox virtualized ${variant}`}
        style={{
          height,
          overflow: "auto",
          position: "relative",
        }}
      >
        <div
          style={{
            height: totalSize,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualRows.map((virtualRow) => {
            const item = virtualItems[virtualRow.index];
            if (!item) return null;

            const isSelected = props.selectedKeys
              ? Array.from(
                  props.selectedKeys as Iterable<string | number>,
                ).includes(item.id)
              : false;
            const isFocused = focusedIndex === virtualRow.index;

            return (
              <div
                key={item.id}
                role="option"
                aria-selected={isSelected}
                data-selected={isSelected || undefined}
                data-focused={isFocused || undefined}
                data-focus-visible={isFocused || undefined}
                className="react-aria-ListBoxItem"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: virtualRow.size,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                onClick={() => {
                  setFocusedIndex(virtualRow.index);
                  if (props.onSelectionChange) {
                    props.onSelectionChange(new Set([item.id]));
                  }
                }}
              >
                {/* children이 render function이면 사용, 아니면 기본 label */}
                {typeof children === "function"
                  ? (children as (item: T) => React.ReactNode)(
                      item as unknown as T,
                    )
                  : item.label}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ColumnMapping이 있으면 각 데이터 항목마다 ListBoxItem 렌더링
  // Table과 동일한 패턴: Element tree의 ListBoxItem 템플릿 + Field 자식 사용
  if (hasDataBinding && columnMapping) {
    // Loading 상태
    if (loading) {
      return (
        <AriaListBox
          {...props}
          className={getListBoxClassName(props.className)}
          data-variant={variant}
        >
          <AriaListBoxItem
            key="loading"
            value={{}}
            isDisabled
            className="react-aria-ListBoxItem"
          >
            ⏳ 데이터 로딩 중...
          </AriaListBoxItem>
        </AriaListBox>
      );
    }

    // Error 상태
    if (error) {
      return (
        <AriaListBox
          {...props}
          className={getListBoxClassName(props.className)}
          data-variant={variant}
        >
          <AriaListBoxItem
            key="error"
            value={{}}
            isDisabled
            className="react-aria-ListBoxItem"
          >
            ❌오류: {error}
          </AriaListBoxItem>
        </AriaListBox>
      );
    }

    // 데이터가 있을 때: items prop 사용
    if (filteredData.length > 0) {
      const items = filteredData.map((item, index) => ({
        id: String(item.id || index),
        ...item,
      })) as T[];

      return (
        <AriaListBox
          {...props}
          className={getListBoxClassName(props.className)}
          data-variant={variant}
          items={items}
        >
          {children}
        </AriaListBox>
      );
    }

    // 데이터 없음
    return (
      <AriaListBox
        {...props}
        className={getListBoxClassName(props.className)}
        data-variant={variant}
      >
        {children}
      </AriaListBox>
    );
  }

  // Dynamic Collection: items prop 사용 (columnMapping 없을 때)
  if (hasDataBinding) {
    // Loading 상태
    if (loading) {
      return (
        <AriaListBox
          {...props}
          className={getListBoxClassName(props.className)}
          data-variant={variant}
        >
          <AriaListBoxItem
            key="loading"
            value={{}}
            isDisabled
            className="react-aria-ListBoxItem"
          >
            ⏳ 데이터 로딩 중...
          </AriaListBoxItem>
        </AriaListBox>
      );
    }

    // Error 상태
    if (error) {
      return (
        <AriaListBox
          {...props}
          className={getListBoxClassName(props.className)}
          data-variant={variant}
        >
          <AriaListBoxItem
            key="error"
            value={{}}
            isDisabled
            className="react-aria-ListBoxItem"
          >
            ❌오류: {error}
          </AriaListBoxItem>
        </AriaListBox>
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
      })) as T[];

      // children이 함수(render function)이면 그것을 사용
      // 이는 renderListBox에서 Field 자식들을 포함한 템플릿 렌더 함수를 전달받는 경우
      if (typeof children === "function") {
        return (
          <AriaListBox
            {...props}
            className={getListBoxClassName(props.className)}
            data-variant={variant}
            items={items}
          >
            {children}
          </AriaListBox>
        );
      }

      // 기본 렌더링 (children이 없거나 정적 children일 때)
      return (
        <AriaListBox
          {...props}
          className={getListBoxClassName(props.className)}
          data-variant={variant}
          items={items}
        >
          {(item) => {
            const itemWithLabel = item as T & { id: string; label: string };
            return (
              <AriaListBoxItem
                key={itemWithLabel.id}
                id={itemWithLabel.id}
                textValue={itemWithLabel.label}
                className="react-aria-ListBoxItem"
              >
                {itemWithLabel.label}
              </AriaListBoxItem>
            );
          }}
        </AriaListBox>
      );
    }
  }

  // Static Children (기존 방식)
  return (
    <AriaListBox
      {...props}
      className={getListBoxClassName(props.className)}
      data-variant={variant}
    >
      {children}
    </AriaListBox>
  );
}

export function ListBoxItem(props: ListBoxItemProps) {
  return <AriaListBoxItem {...props} className="react-aria-ListBoxItem" />;
}

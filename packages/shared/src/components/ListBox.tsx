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

import { useResolvedCollectionItems } from "../hooks";
// ADR-159 P3 — 행 텍스트 템플릿: Skia projection 과 동일 shared resolver (G2).
import {
  compileFieldTemplate,
  interpolateCollectionRowTemplate,
} from "../collections/fieldTemplate";
import {
  CollectionLoadingState,
  CollectionErrorDisplay,
} from "./CollectionErrorState";
import { Skeleton } from "./Skeleton";

import "./styles/ListBox.css";
import { useComponentStrings } from "../i18n";

// 아이템 높이 고정값 (가상화용)
const ITEM_HEIGHT = 40;

interface ExtendedListBoxProps<T extends object> extends Omit<
  ListBoxProps<T>,
  "items"
> {
  dataBinding?: DataBinding | DataBindingValue;
  columnMapping?: ColumnMapping;
  /**
   * ADR-912 영역 B Task 4: 정적 items[] SSOT (StoredListBoxItem[] 직렬화 형태).
   *   RAC `ListBoxProps.items`(Iterable<T>)를 재의미화 — dataBinding 없을 때 source.
   *   useResolvedCollectionItems 가 dataBinding 과 동일 normalizer 로 흡수한다.
   *   section entry(`type:"section"`)가 섞이면 정적 children 경로로 보존(flat guard).
   */
  items?: unknown[];
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
  /**
   * ADR-159 P3: 행 텍스트 `{field}` 템플릿 소스 (renderer 가 slot text > template item
   * props precedence 로 이미 판정한 문자열). 내부 기본/가상화 렌더가 shared resolver 로
   * 보간 — 토큰 없으면 compile null → 기존 label 휴리스틱 (BC).
   */
  rowTemplateSources?: { label?: string | null; description?: string | null };
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
  items,
  variant = "primary",
  enableVirtualization = false,
  height = 300,
  overscan = 5,
  filter,
  filterText,
  filterFields = ["label", "name", "title"] as (keyof T)[],
  isLoading: externalLoading,
  skeletonCount = 5,
  rowTemplateSources,
  ...props
}: ExtendedListBoxProps<T>) {
  const t = useComponentStrings();
  // ADR-159 P3: label 템플릿 compile — 렌더 당 1회 (compileFieldTemplate 은 text 키
  //   캐시라 재compile 비용 없음). 토큰 없는 소스는 null → 기존 item.label (BC).
  //   내부 기본/가상화 렌더는 label 단일 표시 — description 은 renderer slot emit 소관.
  const rowLabelTemplate = rowTemplateSources?.label
    ? compileFieldTemplate(rowTemplateSources.label)
    : null;
  const resolveRowLabel = (item: Record<string, unknown>): string =>
    rowLabelTemplate
      ? interpolateCollectionRowTemplate(rowLabelTemplate, item)
      : String((item as { label?: unknown }).label ?? "");
  // ================================================================
  // Hooks - 항상 최상단에서 무조건 호출 (Rules of Hooks)
  // ================================================================

  const { onSelectionChange, selectedKeys } = props;

  // Refs for virtualization
  const parentRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  // ADR-912 영역 B Task 4: flat guard — 정적 items 에 section entry(`type:"section"`)가
  //   섞이면 useResolvedCollectionItems(toItemProjectionRow)는 section 을 모르고 flat item 으로
  //   잘못 펴므로(header 소실), 이번 slice 에서 강제 normalize 하지 않고 정적 children 경로로
  //   보존한다. section 통합은 별도 slice 로 남긴다(설계 §Task 4 보류).
  const hasSectionEntry = useMemo(
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

  // ADR-912 영역 B Task 4: collection source acquisition 단일화.
  //   useCollectionData 직접 호출(이중 source)을 제거하고 useResolvedCollectionItems 단일 진입점으로 통일.
  //   dataBinding(async/dataTable/API)과 정적 props.items 가 같은 toItemProjectionRow normalizer 를
  //   통과 → DOM wrapper 와 Skia projector(getFlatProjectionRows)가 동일 row 형태(CollectionProjectionRow).
  //   section entry 가 섞인 경우(flat guard)는 정적 source 를 hook 에 넘기지 않아 children 경로로 보존.
  const {
    rows: resolvedRows,
    loading,
    error,
    reload,
  } = useResolvedCollectionItems({
    dataBinding: dataBinding as DataBinding,
    items: hasSectionEntry ? undefined : items,
    componentName: "ListBox",
    fallbackData: [
      { id: 1, name: "User 1", email: "user1@example.com", role: "Admin" },
      { id: 2, name: "User 2", email: "user2@example.com", role: "User" },
    ],
    windowLimit: enableVirtualization ? Number.MAX_SAFE_INTEGER : undefined,
  });

  // 아이템 높이 고정값
  const itemHeight = ITEM_HEIGHT;

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

  // ListBox className generator (reused across all conditional renders)
  const getListBoxClassName = (baseClassName?: ListBoxProps<T>["className"]) =>
    composeRenderProps(baseClassName, (className) => {
      return className
        ? `react-aria-ListBox ${className}`
        : "react-aria-ListBox";
    });

  // 가상화용 아이템 배열 (메모이제이션) - filteredRows 사용
  //   기존 동작 보존: dataBinding 모드에서만 가상화(정적 items 가상화는 별도 영역).
  //   row.itemKey/label 은 정규화 값, ...row.item 으로 원본 필드(render function 용) 보존.
  const virtualItems = useMemo(() => {
    if (!hasDataBinding || filteredRows.length === 0) return [];
    return filteredRows.map((row) => ({
      ...(row.item as Record<string, unknown>),
      id: row.itemKey,
      label: row.label,
    }));
  }, [hasDataBinding, filteredRows]);

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
                {/* children이 render function이면 사용, 아니면 기본 label (ADR-159 템플릿 적용) */}
                {typeof children === "function"
                  ? (children as (item: T) => React.ReactNode)(
                      item as unknown as T,
                    )
                  : resolveRowLabel(item as Record<string, unknown>)}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ADR-912 영역 B Task 4: 정규화 rows source 가 있으면 columnMapping/dynamic 경로를 탄다.
  //   dataBinding(boundData) 또는 정적 props.items 모두 resolvedRows 로 흡수됐으므로,
  //   hasDataBinding 단독이 아니라 hasResolvedRows 로 정적 items 도 실제 row 로 렌더된다
  //   (catalog Preview DOM items 누락 seam 닫기). section guard 적용된 경우 resolvedRows 는
  //   정적 source 를 제외하므로 자연히 Static Children 경로로 떨어진다.
  const hasResolvedRows = filteredRows.length > 0;

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
            {t("loadingData")}
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
            {t("errorWithMessage", { message: String(error) })}
          </AriaListBoxItem>
        </AriaListBox>
      );
    }

    // 데이터가 있을 때: items prop 사용 (raw item 은 row.item 에 보존 → Field/template 소비).
    if (hasResolvedRows) {
      const items = filteredRows.map((row) => ({
        ...(row.item as Record<string, unknown>),
        id: row.itemKey,
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

  // Dynamic Collection + 정적 items: items prop 사용 (columnMapping 없을 때).
  //   ADR-912 Task 4: hasDataBinding 단독이 아니라 hasResolvedRows 로 정적 props.items 도 흡수.
  if (hasResolvedRows) {
    // Loading 상태 (dataBinding 비동기 해소 중 — 정적 items 는 loading=false 즉시 통과)
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
            {t("loadingData")}
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
            {t("errorWithMessage", { message: String(error) })}
          </AriaListBoxItem>
        </AriaListBox>
      );
    }

    // 데이터가 로드되었을 때 (정규화 rows — label/itemKey 보존 + raw item spread)
    const items = filteredRows.map((row) => ({
      ...(row.item as Record<string, unknown>),
      id: row.itemKey,
      label: row.label,
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
          // ADR-159 P3: 템플릿 존재 시 보간 — 없으면 정규화 label (BC).
          const rowLabel = resolveRowLabel(
            itemWithLabel as unknown as Record<string, unknown>,
          );
          return (
            <AriaListBoxItem
              key={itemWithLabel.id}
              id={itemWithLabel.id}
              textValue={rowLabel}
              className="react-aria-ListBoxItem"
            >
              {rowLabel}
            </AriaListBoxItem>
          );
        }}
      </AriaListBox>
    );
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

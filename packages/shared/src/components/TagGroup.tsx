import React, { JSX, useState, useRef, useEffect, useCallback } from "react";
import { flushSync } from "react-dom";
import {
  Button,
  Label,
  Tag as AriaTag,
  TagGroup as AriaTagGroup,
  TagGroupProps as AriaTagGroupProps,
  TagList,
  TagListProps,
  TagProps,
  Text,
  type Key,
  type Selection,
} from "react-aria-components";
import { X } from "lucide-react";
import type { DataBinding, ColumnMapping, DataBindingValue } from "../types";

import { useCollectionData } from "../hooks";
import "./styles/TagGroup.css";

export interface TagGroupProps<T>
  extends
    Omit<AriaTagGroupProps, "children">,
    Pick<TagListProps<T>, "items" | "children" | "renderEmptyState"> {
  label?: string;
  description?: string;
  errorMessage?: string;
  allowsRemoving?: boolean;
  onRemove?: (keys: Selection) => void;
  // 선택 관련 프로퍼티 추가
  selectionMode?: "none" | "single" | "multiple";
  selectionBehavior?: "toggle" | "replace";
  selectedKeys?: "all" | Iterable<Key>;
  defaultSelectedKeys?: "all" | Iterable<Key>;
  onSelectionChange?: (keys: Selection) => void;
  // 비활성화 관련 프로퍼티 추가
  isDisabled?: boolean;
  // 기타 유용한 프로퍼티들
  orientation?: "horizontal" | "vertical";
  disallowEmptySelection?: boolean;
  // 데이터 바인딩
  dataBinding?: DataBinding | DataBindingValue;
  columnMapping?: ColumnMapping;
  // 제거된 항목 추적 (columnMapping 모드에서 동적 데이터 항목 제거용)
  removedItemIds?: string[];
  // Tag 스타일 제어
  variant?: string;
  size?: "sm" | "md" | "lg";
  /**
   * React Aria 1.13.0: 커스텀 필터 함수
   * @example filter={(item) => item.status === 'active'}
   */
  filter?: (item: T) => boolean;
  /**
   * Limit the number of rows initially shown.
   * Renders a button that allows the user to expand to show all tags.
   * @example maxRows={2}
   */
  maxRows?: number;
  labelPosition?: "top" | "side";
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

export function TagGroup<T extends object>({
  label,
  description,
  errorMessage,
  style,
  items,
  children,
  renderEmptyState,
  allowsRemoving,
  onRemove,
  selectionMode = "none",
  selectionBehavior = "toggle",
  selectedKeys,
  defaultSelectedKeys,
  onSelectionChange,
  disallowEmptySelection = false,
  dataBinding,
  columnMapping,
  removedItemIds = [],
  variant = "default",
  size = "md",
  maxRows,
  filter,
  filterText,
  filterFields = ["label", "name", "title"] as (keyof T)[],
  labelPosition = "top",
  ...props
}: TagGroupProps<T>): JSX.Element {
  // Build className with variant and size (재사용을 위해 최상위에 선언)
  const tagGroupClassName = "react-aria-TagGroup";

  // maxRows: S2 패턴 — 숨겨진 미러 DOM에서 측정, 실제 DOM에서 슬라이스
  // 핵심: 미러 DOM은 항상 전체 태그 렌더 (상태 무관) → 무한 루프 방지
  const [isCollapsed, setIsCollapsed] = useState(true);
  const hiddenRef = useRef<HTMLDivElement>(null);
  const [visibleTagCount, setVisibleTagCount] = useState<number>(Infinity);

  const hasMaxRows = maxRows != null && maxRows > 0;
  const showCollapsed = hasMaxRows && isCollapsed;

  const computeVisibleTagCount = useCallback(() => {
    if (!hiddenRef.current || !maxRows) return;
    const items = hiddenRef.current.children;
    if (items.length === 0) return;

    let currY = -Infinity;
    let rowCount = 0;
    let index = 0;
    for (let i = 0; i < items.length; i++) {
      const { y } = items[i].getBoundingClientRect();
      if (y !== currY) {
        currY = y;
        rowCount++;
      }
      if (rowCount > maxRows) break;
      index++;
    }

    flushSync(() => {
      setVisibleTagCount(index);
    });
  }, [maxRows]);

  // 초기 측정 + 컬렉션 변경 시 재측정
  useEffect(() => {
    if (hasMaxRows && isCollapsed) {
      // microtask로 DOM 렌더 완료 후 측정
      queueMicrotask(computeVisibleTagCount);
    }
  }, [hasMaxRows, isCollapsed, computeVisibleTagCount]);

  // ResizeObserver: 컨테이너 크기 변경 시 재측정
  useEffect(() => {
    if (!hasMaxRows || !hiddenRef.current) return;
    const el = hiddenRef.current.parentElement;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (isCollapsed) computeVisibleTagCount();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMaxRows, isCollapsed, computeVisibleTagCount]);

  useEffect(() => {
    queueMicrotask(() => {
      setIsCollapsed(true);
      setVisibleTagCount(Infinity);
    });
  }, [maxRows]);

  // useCollectionData Hook으로 데이터 가져오기 (Static, API, Supabase 통합)
  const {
    data: boundData,
    loading,
    error,
  } = useCollectionData({
    dataBinding: dataBinding as DataBinding,
    componentName: "TagGroup",
    fallbackData: [
      { id: 1, name: "Tag 1", label: "Tag 1" },
      { id: 2, name: "Tag 2", label: "Tag 2" },
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

  // Static Children: data-binding 경로에서는 사용하지 않으므로 스킵
  const allMappedChildren = hasDataBinding
    ? children
    : typeof children === "function"
      ? children
      : React.Children.map(children as React.ReactNode, (child) => {
          if (!React.isValidElement(child)) return child;
          const { children: tagContent, ...tagProps } = child.props as TagProps;
          const textValue =
            typeof tagContent === "string" ? tagContent : undefined;
          return (
            <AriaTag
              textValue={textValue}
              {...tagProps}
              className="react-aria-Tag"
            >
              {({ allowsRemoving }) => (
                <>
                  {tagContent}
                  {allowsRemoving && (
                    <Button slot="remove" className="tag-remove-btn">
                      <X size={14} />
                    </Button>
                  )}
                </>
              )}
            </AriaTag>
          );
        });

  // children에서 텍스트 추출 (미러 DOM용, data-binding 경로에서는 빈 배열)
  const tagTexts = React.useMemo(() => {
    if (hasDataBinding || !Array.isArray(allMappedChildren)) return [];
    return allMappedChildren.map((child) => {
      if (!React.isValidElement(child)) return "";
      const p = child.props as { textValue?: string; children?: unknown };
      return p.textValue || String(p.children || "");
    });
  }, [hasDataBinding, allMappedChildren]);

  // children이 render function인지 확인 (Field children 렌더링 모드)
  const isRenderFunction = typeof children === "function";

  // ColumnMapping이 있거나 children이 render function이면 Field 렌더링 모드 사용
  // ListBox와 동일한 패턴: Element tree의 Tag 템플릿 + Field 자식 사용
  if (hasDataBinding && (columnMapping || isRenderFunction)) {
    // Loading 상태
    if (loading) {
      return (
        <AriaTagGroup
          {...props}
          selectionMode="none"
          className={tagGroupClassName}
          data-type-variant={variant}
          data-type-size={size}
          data-label-position={labelPosition}
        >
          {label && <Label>{label}</Label>}
          <TagList className="react-aria-TagList">
            <AriaTag textValue="Loading">⏳ 데이터 로딩 중...</AriaTag>
          </TagList>
          {description && <Text slot="description">{description}</Text>}
        </AriaTagGroup>
      );
    }

    // Error 상태
    if (error) {
      return (
        <AriaTagGroup
          {...props}
          selectionMode="none"
          className={tagGroupClassName}
          data-type-variant={variant}
          data-type-size={size}
          data-label-position={labelPosition}
        >
          {label && <Label>{label}</Label>}
          <TagList className="react-aria-TagList">
            <AriaTag textValue="Error">❌ 오류: {error}</AriaTag>
          </TagList>
          {description && <Text slot="description">{description}</Text>}
        </AriaTagGroup>
      );
    }

    // 데이터가 있을 때: items prop 사용
    if (filteredData.length > 0) {
      // removedItemIds로 필터링 (map 전에 필터링)
      const tagItems = filteredData
        .filter((item, index) => {
          // 원본 데이터의 id를 문자열로 변환하여 비교
          const itemId = String(item.id ?? index);
          const isRemoved = removedItemIds.includes(itemId);
          return !isRemoved;
        })
        .map((item, index) => ({
          id: String(item.id || index),
          ...item,
        })) as T[];

      return (
        <AriaTagGroup
          {...props}
          selectionMode={selectionMode}
          selectionBehavior={selectionBehavior}
          selectedKeys={selectedKeys}
          defaultSelectedKeys={defaultSelectedKeys}
          onSelectionChange={onSelectionChange}
          disallowEmptySelection={disallowEmptySelection}
          onRemove={allowsRemoving ? onRemove : undefined}
          className={tagGroupClassName}
          data-type-variant={variant}
          data-type-size={size}
          data-label-position={labelPosition}
        >
          {label && <Label>{label}</Label>}
          <TagList
            items={tagItems}
            renderEmptyState={renderEmptyState}
            className="react-aria-TagList"
          >
            {children}
          </TagList>
          {description && <Text slot="description">{description}</Text>}
          {errorMessage && <Text slot="errorMessage">{errorMessage}</Text>}
        </AriaTagGroup>
      );
    }

    // 데이터 없음
    return (
      <AriaTagGroup
        {...props}
        selectionMode={selectionMode}
        selectionBehavior={selectionBehavior}
        selectedKeys={selectedKeys}
        defaultSelectedKeys={defaultSelectedKeys}
        onSelectionChange={onSelectionChange}
        disallowEmptySelection={disallowEmptySelection}
        onRemove={allowsRemoving ? onRemove : undefined}
        className={tagGroupClassName}
        data-type-variant={variant}
        data-type-size={size}
        data-label-position={labelPosition}
      >
        {label && <Label>{label}</Label>}
        <TagList
          items={items}
          renderEmptyState={renderEmptyState}
          className="react-aria-TagList"
        >
          {children}
        </TagList>
        {description && <Text slot="description">{description}</Text>}
        {errorMessage && <Text slot="errorMessage">{errorMessage}</Text>}
      </AriaTagGroup>
    );
  }

  // Dynamic Collection: items prop 사용 (columnMapping 없을 때)
  if (hasDataBinding) {
    // Loading 상태
    if (loading) {
      return (
        <AriaTagGroup
          {...props}
          selectionMode="none"
          className={tagGroupClassName}
          data-type-variant={variant}
          data-type-size={size}
          data-label-position={labelPosition}
        >
          {label && <Label>{label}</Label>}
          <TagList className="react-aria-TagList">
            <AriaTag textValue="Loading">⏳ 데이터 로딩 중...</AriaTag>
          </TagList>
          {description && <Text slot="description">{description}</Text>}
        </AriaTagGroup>
      );
    }

    // Error 상태
    if (error) {
      return (
        <AriaTagGroup
          {...props}
          selectionMode="none"
          className={tagGroupClassName}
          data-type-variant={variant}
          data-type-size={size}
          data-label-position={labelPosition}
        >
          {label && <Label>{label}</Label>}
          <TagList className="react-aria-TagList">
            <AriaTag textValue="Error">❌ 오류: {error}</AriaTag>
          </TagList>
          {description && <Text slot="description">{description}</Text>}
        </AriaTagGroup>
      );
    }

    // 데이터가 로드되었을 때
    if (filteredData.length > 0) {
      const tagItems = filteredData.map((item, index) => ({
        id: String(item.id || index),
        label: String(
          item.name || item.title || item.label || `Tag ${index + 1}`,
        ),
        ...item,
      }));

      return (
        <AriaTagGroup
          {...props}
          selectionMode={selectionMode}
          selectionBehavior={selectionBehavior}
          selectedKeys={selectedKeys}
          defaultSelectedKeys={defaultSelectedKeys}
          onSelectionChange={onSelectionChange}
          disallowEmptySelection={disallowEmptySelection}
          onRemove={allowsRemoving ? onRemove : undefined}
          className={tagGroupClassName}
          data-type-variant={variant}
          data-type-size={size}
          data-label-position={labelPosition}
        >
          {label && <Label>{label}</Label>}
          <TagList
            items={tagItems}
            renderEmptyState={renderEmptyState}
            className="react-aria-TagList"
          >
            {(item) => (
              <AriaTag
                key={item.id}
                id={item.id}
                textValue={item.label}
                className="react-aria-Tag"
              >
                {({ allowsRemoving: removing }) => (
                  <>
                    {item.label}
                    {removing && (
                      <Button slot="remove" className="tag-remove-btn">
                        <X size={14} />
                      </Button>
                    )}
                  </>
                )}
              </AriaTag>
            )}
          </TagList>
          {description && <Text slot="description">{description}</Text>}
          {errorMessage && <Text slot="errorMessage">{errorMessage}</Text>}
        </AriaTagGroup>
      );
    }
  }

  const totalChildCount = tagTexts.length;

  // 실제 렌더링할 children: collapsed 시 visibleTagCount만큼 슬라이스
  const displayChildren =
    showCollapsed && Array.isArray(allMappedChildren)
      ? allMappedChildren.slice(0, visibleTagCount)
      : allMappedChildren;

  const showAllButton = showCollapsed && visibleTagCount < totalChildCount;

  return (
    <div style={{ position: "relative", ...style }}>
      {/* S2 패턴: 숨겨진 미러 DOM — 항상 전체 태그를 span으로 렌더 (측정 전용) */}
      {hasMaxRows && (
        <div
          ref={hiddenRef}
          inert
          aria-hidden="true"
          className="react-aria-TagList"
          data-type-size={size}
          data-label-position={labelPosition}
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--spacing-xs)",
            position: "absolute",
            visibility: "hidden",
            overflow: "hidden",
            opacity: 0,
            pointerEvents: "none",
            width: "100%",
          }}
        >
          {tagTexts.map((text, i) => (
            <span key={i} className="react-aria-Tag">
              {text}
            </span>
          ))}
        </div>
      )}
      <AriaTagGroup
        {...props}
        selectionMode={selectionMode}
        selectionBehavior={selectionBehavior}
        selectedKeys={selectedKeys}
        defaultSelectedKeys={defaultSelectedKeys}
        onSelectionChange={onSelectionChange}
        disallowEmptySelection={disallowEmptySelection}
        onRemove={allowsRemoving ? onRemove : undefined}
        className={tagGroupClassName}
        data-type-variant={variant}
        data-type-size={size}
        data-label-position={labelPosition}
      >
        {label && <Label>{label}</Label>}
        <div className="tag-list-wrapper">
          <TagList
            items={items}
            renderEmptyState={renderEmptyState}
            className="react-aria-TagList"
          >
            {displayChildren}
          </TagList>
          {showAllButton && (
            <button
              className="tag-show-all-btn"
              onClick={() => setIsCollapsed(false)}
              type="button"
            >
              Show all ({totalChildCount})
            </button>
          )}
          {hasMaxRows && !isCollapsed && (
            <button
              className="tag-show-all-btn"
              onClick={() => setIsCollapsed(true)}
              type="button"
            >
              Show less
            </button>
          )}
        </div>
        {description && <Text slot="description">{description}</Text>}
        {errorMessage && <Text slot="errorMessage">{errorMessage}</Text>}
      </AriaTagGroup>
    </div>
  );
}

export function Tag({ children, ...props }: TagProps): JSX.Element {
  const textValue = typeof children === "string" ? children : undefined;
  return (
    <AriaTag textValue={textValue} {...props} className="react-aria-Tag">
      {({ allowsRemoving }) => (
        <>
          {children}
          {allowsRemoving && (
            <Button slot="remove" className="tag-remove-btn">
              <X size={14} />
            </Button>
          )}
        </>
      )}
    </AriaTag>
  );
}

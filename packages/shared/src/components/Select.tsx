/**
 * Select Component - Material Design 3
 *
 * M3 Variants: primary, secondary, tertiary, error, filled
 * Sizes: sm, md, lg
 */

import React, { useRef, useState, useEffect } from "react";
import {
  Button,
  FieldError,
  Label,
  ListBox,
  ListBoxItem,
  ListBoxItemProps,
  Popover,
  Select as AriaSelect,
  SelectProps as AriaSelectProps,
  SelectValue,
  Text,
  ValidationResult,
  composeRenderProps,
} from "react-aria-components";
import { getIconData } from "@composition/specs";
import type {
  ComponentSize,
  DataBinding,
  ColumnMapping,
  DataBindingValue,
} from "../types";

import { resolveTriggerIconSize } from "../catalog/resolvers/resolveTriggerIconSize";
import { useResolvedCollectionItems } from "../hooks";
import {
  type NecessityIndicator,
  renderNecessityIndicator,
} from "./FieldNecessityIndicator";
import { Skeleton } from "./Skeleton";
import "./styles/generated/Select.css";

export interface SelectProps<T extends object> extends Omit<
  AriaSelectProps<T>,
  "children" | "selectionMode" | "items"
> {
  label?: string;
  description?: string;
  errorMessage?: string | ((validation: ValidationResult) => string);
  /**
   * ADR-912 영역 B Task 6: 정적 items[] SSOT (StoredSelectItem[] 직렬화 형태).
   *   RAC `AriaSelectProps.items`(Iterable<T>)를 재의미화 — dataBinding 없을 때 source.
   *   useResolvedCollectionItems 가 dataBinding 과 동일 normalizer(toItemProjectionRow)로 흡수하고,
   *   selectItems 가 정규화 rows 를 RAC ListBox 가 받는 형태(id=itemKey 보존)로 재구성한다.
   */
  items?: unknown[];
  children?: React.ReactNode | ((item: T) => React.ReactNode);
  placeholder?: string;
  itemKey?: keyof T | ((item: T) => React.Key);
  dataBinding?: DataBinding | DataBindingValue;
  columnMapping?: ColumnMapping;
  size?: ComponentSize;
  /**
   * React Aria 1.13.0: 선택 모드
   * @default 'single'
   */
  selectionMode?: "single" | "multiple";
  /**
   * 다중 선택 시 표시 형식
   * - 'count': "3개 선택됨"
   * - 'list': "항목1, 항목2, 항목3"
   * - 'custom': renderMultipleValue 사용
   * @default 'count'
   */
  multipleDisplayMode?: "count" | "list" | "custom";
  /**
   * 다중 선택 시 커스텀 렌더러
   */
  renderMultipleValue?: (selectedItems: T[]) => React.ReactNode;
  /** 트리거 아이콘 이름 (Lucide 아이콘) */
  iconName?: string;
  /**
   * Show loading skeleton instead of select
   * @default false
   */
  isLoading?: boolean;
  necessityIndicator?: NecessityIndicator;
  labelPosition?: "top" | "side";
  isQuiet?: boolean;
}

export function Select<T extends object>({
  label,
  description,
  errorMessage,
  children,
  items,
  placeholder,
  dataBinding,
  columnMapping,
  size = "md",
  iconName,
  selectionMode = "single",
  // Note: 다중 선택 관련 기능은 현재 미구현 상태
  multipleDisplayMode: _multipleDisplayMode = "count",
  renderMultipleValue: _renderMultipleValue,
  isLoading: externalLoading,
  labelPosition = "top",
  isQuiet,
  ...props
}: SelectProps<T>) {
  // chevron glyph 크기 — Skia SelectIcon 과 **동일한** catalog 값(D3 대칭). `.select-chevron`
  //   span 은 `--select-chevron-size` 로 **박스**만 잡고, 안의 svg 는 `width={16}` 하드코딩이라
  //   size 를 바꿔도 glyph 가 16 고정이었다 (DatePicker 와 동일 결함 — 2026-07-14).
  const chevronIconSize = resolveTriggerIconSize(size);

  const selectRef = useRef<HTMLDivElement>(null);
  const [popoverWidth, setPopoverWidth] = useState(0);

  useEffect(() => {
    const el = selectRef.current;
    if (!el) return;
    const update = () =>
      setPopoverWidth(Math.round(el.getBoundingClientRect().width));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 다중 선택 기능 구현 예정 (현재는 미사용)
  void _multipleDisplayMode;
  void _renderMultipleValue;
  // ADR-912 영역 B Task 6: collection source acquisition 단일화.
  //   useCollectionData 직접 호출(이중 source)을 제거하고 useResolvedCollectionItems 단일 진입점으로 통일.
  //   dataBinding(async/dataTable/API)과 정적 props.items 가 같은 toItemProjectionRow normalizer 를
  //   통과 → DOM wrapper 와 Skia projector(getFlatProjectionRows)가 동일 row 형태(CollectionProjectionRow).
  //   StoredSelectItem 은 section discriminant 가 없어(flat-only) section guard 불필요.
  const {
    rows: resolvedRows,
    loading,
    error,
  } = useResolvedCollectionItems({
    dataBinding: dataBinding as DataBinding,
    items,
    componentName: "Select",
    fallbackData: [
      { id: 1, name: "Option 1", value: "option-1" },
      { id: 2, name: "Option 2", value: "option-2" },
    ],
  });

  // Label 및 ARIA 처리
  const hasVisibleLabel = label && String(label).trim();
  const ariaLabel = hasVisibleLabel
    ? undefined
    : props["aria-label"] || placeholder || "Select an option";

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

  // ADR-912 영역 B Task 6: 내부 RAC ListBox 가 받는 items 를 정규화 rows 에서 파생.
  //   dataBinding(boundData) 과 정적 props.items 가 모두 resolvedRows(toItemProjectionRow)로
  //   흡수됐으므로, 수동 selectItems useMemo(이중 source map)을 단일 파생으로 통일.
  //   raw item(...row.item) 을 보존해 description/icon/value 등 기존 field 유지하고,
  //   id=row.itemKey / label=row.label 을 강제 — RAC selectedKey 해석은 ListBoxItem id 기준이므로
  //   itemKey 보존이 selected value 표시 무회귀의 핵심(legacy String(item.id) 와 동일 값).
  //   loading/error 중에는 listBoxContent 가 상태 메시지를 렌더하므로 items 는 빈 배열로 둔다.
  const selectItems = React.useMemo(() => {
    if (hasDataBinding && (loading || error)) {
      return [] as unknown as Iterable<T>;
    }
    return resolvedRows.map((row) => ({
      ...(row.item as Record<string, unknown>),
      id: row.itemKey,
      label: row.label,
    })) as unknown as Iterable<T>;
  }, [hasDataBinding, loading, error, resolvedRows]);

  // ADR-912 영역 B Task 6: 정규화 rows source 가 있으면 dynamic/static 공통 render 경로를 탄다.
  //   dataBinding(boundData) 또는 정적 props.items 모두 resolvedRows 로 흡수됐으므로,
  //   기존 boundData.length 분기를 hasResolvedRows 로 일반화 — 정적 items 도 popover 내부에
  //   role=option 으로 렌더(catalog Preview DOM items 누락 seam 닫기).
  const hasResolvedRows = resolvedRows.length > 0;

  // Render ListBox content based on state - memoized to prevent unnecessary re-renders
  const listBoxContent: React.ReactNode | ((item: T) => React.ReactNode) =
    React.useMemo(() => {
      // Loading state (dataBinding 비동기 해소 중 — 정적 items 는 loading=false 즉시 통과)
      if (hasDataBinding && loading) {
        return (
          <ListBoxItem
            key="loading"
            textValue="Loading"
            className="react-aria-ListBoxItem"
          >
            ⏳ 데이터 로딩 중...
          </ListBoxItem>
        );
      }

      // Error state
      if (hasDataBinding && error) {
        return (
          <ListBoxItem
            key="error"
            textValue="Error"
            className="react-aria-ListBoxItem"
          >
            ❌ 오류: {error}
          </ListBoxItem>
        );
      }

      // ColumnMapping mode with children (Field-based template rendering — 자식이 row 소비)
      if (hasDataBinding && columnMapping && hasResolvedRows) {
        return children;
      }

      // 사용자 정의 render function(children) 우선 — selectItems(id/label 정규화)를 받아 렌더
      if (typeof children === "function") {
        return children as (item: T) => React.ReactNode;
      }

      // 정규화 rows 기반 기본 render function (정적 items / columnMapping 없는 dynamic 공통)
      if (hasResolvedRows) {
        return ((item: Record<string, unknown>) => {
          const itemId =
            item.id !== undefined && item.id !== null
              ? String(item.id)
              : undefined;
          const itemLabel =
            item.label !== undefined && item.label !== null
              ? String(item.label)
              : undefined;

          return (
            <ListBoxItem
              key={itemId}
              id={itemId}
              textValue={itemLabel}
              className="react-aria-ListBoxItem"
            >
              {itemLabel}
            </ListBoxItem>
          );
        }) as (item: T) => React.ReactNode;
      }

      // Static children (정규화 rows 없음 — JSX children 그대로)
      return children;
    }, [
      hasDataBinding,
      loading,
      error,
      columnMapping,
      hasResolvedRows,
      children,
    ]);

  // Single unified return structure - prevents popover remounting
  if (externalLoading) {
    return (
      <Skeleton
        componentVariant="input"
        size={size}
        className={props.className as string}
        aria-label="Loading select..."
      />
    );
  }

  return (
    <AriaSelect
      {...props}
      ref={selectRef}
      data-size={size}
      data-label-position={labelPosition}
      data-quiet={isQuiet ? "true" : undefined}
      className={composeRenderProps(props.className, (cls) =>
        cls ? `react-aria-Select ${cls}` : "react-aria-Select",
      )}
      aria-label={ariaLabel}
      placeholder={placeholder}
      isDisabled={props.isDisabled || (hasDataBinding && (loading || !!error))}
      data-selection-mode={selectionMode}
    >
      {() => (
        <>
          {hasVisibleLabel && (
            <Label className="react-aria-Label">
              {String(label)}
              {renderNecessityIndicator(
                props.necessityIndicator,
                props.isRequired,
              )}
            </Label>
          )}

          <Button className="react-aria-Button">
            <SelectValue />
            <span aria-hidden="true" className="select-chevron">
              {(() => {
                const data = iconName ? getIconData(iconName) : null;
                if (data) {
                  return (
                    <svg
                      width={chevronIconSize}
                      height={chevronIconSize}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      {data.paths.map((d: string, i: number) => (
                        <path key={i} d={d} />
                      ))}
                      {data.circles?.map(
                        (
                          c: { cx: number; cy: number; r: number },
                          i: number,
                        ) => (
                          <circle key={`c${i}`} cx={c.cx} cy={c.cy} r={c.r} />
                        ),
                      )}
                    </svg>
                  );
                }
                // Default: chevron-down
                const defaultData = getIconData("chevron-down");
                return defaultData ? (
                  <svg
                    width={chevronIconSize}
                    height={chevronIconSize}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {defaultData.paths.map((d: string, i: number) => (
                      <path key={i} d={d} />
                    ))}
                  </svg>
                ) : null;
              })()}
            </span>
          </Button>

          {description && String(description).trim() && (
            <Text slot="description" className="react-aria-Description">
              {String(description)}
            </Text>
          )}

          {/* Show loading message */}
          {hasDataBinding && loading && (
            <Text slot="description" className="react-aria-Description">
              ⏳ 데이터 로딩 중...
            </Text>
          )}

          {/* Show error message */}
          {hasDataBinding && error && (
            <FieldError className="react-aria-FieldError">
              ❌ 오류: {error}
            </FieldError>
          )}

          {/* Show validation error */}
          {errorMessage && !error && (
            <FieldError className="react-aria-FieldError">
              {typeof errorMessage === "function"
                ? errorMessage({ isInvalid: true } as ValidationResult)
                : String(errorMessage)}
            </FieldError>
          )}

          <Popover
            className="react-aria-Popover"
            triggerRef={selectRef}
            placement="bottom start"
            offset={4}
            style={
              popoverWidth > 0 ? { width: `${popoverWidth}px` } : undefined
            }
          >
            <ListBox
              items={selectItems}
              className="react-aria-ListBox"
              selectionMode={selectionMode}
              data-size={size}
            >
              {listBoxContent}
            </ListBox>
          </Popover>
        </>
      )}
    </AriaSelect>
  );
}

export { Select as MySelect };

export function SelectItem(props: ListBoxItemProps) {
  return <ListBoxItem {...props} className="react-aria-ListBoxItem" />;
}

/**
 * ComboBox Component - Material Design 3
 *
 * M3 Variants: primary, secondary, tertiary, error, filled
 * Sizes: sm, md, lg
 */

import React, { useRef, useState, useEffect } from "react";
import {
  Button,
  ComboBox as AriaComboBox,
  ComboBoxProps as AriaComboBoxProps,
  FieldError,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  ListBoxItemProps,
  Popover,
  Text,
  ValidationResult,
} from "react-aria-components";
import { getIconData } from "@composition/specs";
import type { ComponentSize } from "../types";
import type { DataBinding, ColumnMapping, DataBindingValue } from "../types";

import { resolveTriggerIconSize } from "../catalog/resolvers/resolveTriggerIconSize";
import { renderListBoxItemSlotContent } from "./listBoxItemSlotContent";
import { useResolvedCollectionItems } from "../hooks";
import {
  type NecessityIndicator,
  renderNecessityIndicator,
} from "./FieldNecessityIndicator";
import { Skeleton } from "./Skeleton";
import "./styles/generated/ComboBox.css";

/**
 * 🚀 Phase 4: data-* 패턴 전환
 * - tailwind-variants 제거
 * - data-variant, data-size 속성 사용
 */

export interface ComboBoxProps<T extends object> extends Omit<
  AriaComboBoxProps<T>,
  "children" | "items"
> {
  label?: string;
  description?: string | null;
  errorMessage?: string | ((validation: ValidationResult) => string);
  /**
   * ADR-912 영역 B Task 7: 정적 items[] SSOT (StoredComboBoxItem[] 직렬화 형태).
   *   RAC `AriaComboBoxProps.items`(Iterable<T>)를 재의미화 — dataBinding 없을 때 source.
   *   Select Task 6 과 달리 ComboBox 는 기존 interface 에 items prop 이 없었으므로 신설(additive).
   *   useResolvedCollectionItems 가 dataBinding 과 동일 normalizer(toItemProjectionRow)로 흡수하고,
   *   comboBoxItems 가 정규화 rows 를 RAC ListBox 가 받는 형태(id=itemKey 보존)로 재구성한다.
   */
  items?: unknown[];
  placeholder?: string;
  inputValue?: string;
  onInputChange?: (value: string) => void;
  children?: React.ReactNode | ((item: T) => React.ReactNode);
  dataBinding?: DataBinding | DataBindingValue;
  columnMapping?: ColumnMapping;
  popoverClassName?: string;
  size?: ComponentSize;
  /** 트리거 아이콘 이름 (Lucide 아이콘) */
  iconName?: string;
  /**
   * Show loading skeleton instead of combobox
   * @default false
   */
  isLoading?: boolean;
  necessityIndicator?: NecessityIndicator;
  labelPosition?: "top" | "side";
  /**
   * side 라벨 컬럼 안에서의 라벨 텍스트 정렬 (RSP `labelAlign`). Form 조상이 지정하면
   * 상속하고, 자신이 지정하면 그것이 우선 (renderer 의 nearest-wins).
   * @default 'start'
   */
  labelAlign?: "start" | "center" | "end";
  isQuiet?: boolean;
}

export function ComboBox<T extends object>({
  label,
  description,
  errorMessage,
  children,
  items,
  placeholder,
  inputValue,
  onInputChange,
  dataBinding,
  columnMapping,
  popoverClassName,
  size = "md",
  iconName,
  isLoading: externalLoading,
  labelPosition = "top",
  labelAlign,
  isQuiet,
  ...props
}: ComboBoxProps<T>) {
  // chevron glyph 크기 — Skia SelectIcon 과 동일한 catalog 값 (Select/DatePicker 동형).
  //   구 `width={16}` 하드코딩은 size 를 바꿔도 glyph 가 16 고정이었다 (2026-07-14).
  const chevronIconSize = resolveTriggerIconSize(size);

  // ADR-912 영역 B Task 7: collection source acquisition 단일화.
  //   useCollectionData 직접 호출(이중 source)을 제거하고 useResolvedCollectionItems 단일 진입점으로 통일.
  //   dataBinding(async/dataTable/API)과 정적 props.items 가 같은 toItemProjectionRow normalizer 를
  //   통과 → DOM wrapper 와 Skia projector(getFlatProjectionRows)가 동일 row 형태(CollectionProjectionRow).
  //   StoredComboBoxItem 은 section discriminant 가 없어(flat-only) section guard 불필요.
  const {
    rows: resolvedRows,
    loading,
    error,
  } = useResolvedCollectionItems({
    dataBinding: dataBinding as DataBinding,
    items,
    componentName: "ComboBox",
    fallbackData: [
      { id: 1, name: "Option 1", value: "option-1" },
      { id: 2, name: "Option 2", value: "option-2" },
    ],
  });

  const comboBoxRef = useRef<HTMLDivElement>(null);
  const [popoverWidth, setPopoverWidth] = useState(0);

  useEffect(() => {
    const el = comboBoxRef.current;
    if (!el) return;
    const update = () => {
      const nextWidth = Math.round(el.getBoundingClientRect().width);
      setPopoverWidth((prev) => (prev === nextWidth ? prev : nextWidth));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Label 처리
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

  // ComboBox className generator (reused across all conditional renders)
  // 🚀 ClassNameOrFunction 타입 지원 - 문자열로 단순화
  const baseClassName =
    typeof props.className === "string" ? props.className : undefined;
  const comboBoxClassName = baseClassName
    ? `react-aria-ComboBox ${baseClassName}`
    : "react-aria-ComboBox";
  const popoverStyle =
    popoverWidth > 0 ? { width: `${popoverWidth}px` } : undefined;
  const isLoadingState = hasDataBinding && loading;
  const isErrorState = hasDataBinding && !!error;
  const isTemplateMode = hasDataBinding && !!columnMapping;
  const shouldRenderPopover = !isLoadingState && !isErrorState;
  const comboBoxDisabled =
    Boolean(props.isDisabled) || isLoadingState || isErrorState;

  // ADR-912 영역 B Task 7: 정규화 rows source 가 있으면 dynamic/static 공통 render 경로를 탄다.
  //   dataBinding(boundData) 또는 정적 props.items 모두 resolvedRows 로 흡수됐으므로,
  //   기존 boundData.length 기반 hasBoundItems 를 hasResolvedRows 로 일반화 — 정적 items 도
  //   popover 내부에 role=option 으로 렌더(catalog Preview DOM items 누락 seam 닫기).
  const hasResolvedRows = resolvedRows.length > 0;

  // ADR-912 영역 B Task 7: 내부 RAC ListBox 가 받는 items 를 정규화 rows 에서 파생.
  //   dataBinding(boundData) 과 정적 props.items 가 모두 resolvedRows(toItemProjectionRow)로
  //   흡수됐으므로, 수동 comboBoxItems useMemo(이중 source map + config 휴리스틱)을 단일 파생으로 통일.
  //   raw item(...row.item) 을 보존해 description/icon/value 등 기존 field 유지하고,
  //   id=row.itemKey / label=row.label 을 강제 — RAC defaultSelectedKey 해석은 ListBoxItem id 기준이므로
  //   itemKey 보존이 selected value/custom value 무회귀의 핵심(legacy String(item.id) 와 동일 값).
  //   loading/error 중에는 popover 가 닫혀 있으므로 items 는 빈 배열로 둔다.
  const comboBoxItems = React.useMemo(() => {
    if (hasDataBinding && (loading || error)) {
      return undefined;
    }
    if (!hasResolvedRows) {
      return undefined;
    }
    return resolvedRows.map((row) => ({
      ...(row.item as Record<string, unknown>),
      id: row.itemKey,
      label: row.label,
    })) as unknown as T[];
  }, [hasDataBinding, loading, error, hasResolvedRows, resolvedRows]);

  const listBoxChildren: React.ReactNode | ((item: T) => React.ReactNode) =
    React.useMemo(() => {
      // ColumnMapping mode with children (Field-based template rendering — 자식이 row 소비)
      if (isTemplateMode && hasResolvedRows) {
        return children;
      }

      // 사용자 정의 render function(children) 우선 — comboBoxItems(id/label 정규화)를 받아 렌더
      if (typeof children === "function") {
        return children as (item: T) => React.ReactNode;
      }

      // 정규화 rows 기반 기본 render function (정적 items / columnMapping 없는 dynamic 공통)
      if (hasResolvedRows) {
        // itemSchema 의 icon/description 렌더 (2026-08-21, Select 동형) — 이전에는 label
        //   문자열만 emit 해서 두 필드가 편집만 되고 화면에 안 나왔다.
        return ((item: Record<string, unknown>) => (
          <ListBoxItem
            key={String(item.id)}
            id={String(item.id)}
            textValue={String(item.label)}
          >
            {({ isSelected }) =>
              renderListBoxItemSlotContent({
                label: String(item.label),
                description:
                  typeof item.description === "string" &&
                  item.description.length > 0
                    ? item.description
                    : null,
                iconName:
                  typeof item.icon === "string" && item.icon.length > 0
                    ? item.icon
                    : null,
                isSelected,
                // 팝오버는 좌측 gutter ::before ✓ 를 이미 그린다 — 우측 체크 중복 방지.
                showSelectionCheck: false,
              })
            }
          </ListBoxItem>
        )) as (item: T) => React.ReactNode;
      }

      // Static children (정규화 rows 없음 — JSX children 그대로)
      return children;
    }, [children, columnMapping, hasResolvedRows, isTemplateMode]);

  // External loading state (from isLoading prop) - show skeleton
  // NOTE: early return은 모든 훅 호출 이후에 위치해야 함 (Rules of Hooks)
  if (externalLoading) {
    return (
      <Skeleton
        componentVariant="input"
        size={size}
        className={props.className as string}
        aria-label="Loading combobox..."
      />
    );
  }

  return (
    <AriaComboBox
      {...props}
      ref={comboBoxRef}
      inputValue={inputValue}
      onInputChange={onInputChange}
      className={comboBoxClassName}
      data-size={size}
      data-label-position={labelPosition}
      data-label-align={labelAlign}
      data-quiet={isQuiet ? "true" : undefined}
      aria-label={ariaLabel}
      isDisabled={comboBoxDisabled}
    >
      {hasVisibleLabel && (
        <Label>
          {String(label)}
          {renderNecessityIndicator(props.necessityIndicator, props.isRequired)}
        </Label>
      )}
      <div className="combobox-container">
        <Input placeholder={placeholder} />
        <Button>
          {(() => {
            const name = iconName || "chevron-down";
            const data = getIconData(name);
            if (!data) return null;
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
                  (c: { cx: number; cy: number; r: number }, i: number) => (
                    <circle key={`c${i}`} cx={c.cx} cy={c.cy} r={c.r} />
                  ),
                )}
              </svg>
            );
          })()}
        </Button>
      </div>
      {description && <Text slot="description">{description}</Text>}
      {isLoadingState && <Text slot="description">⏳ 데이터 로딩 중...</Text>}
      {isErrorState && <FieldError>❌ 오류: {error}</FieldError>}
      {errorMessage && !isErrorState && <FieldError>{errorMessage}</FieldError>}
      {shouldRenderPopover && (
        <Popover
          className={popoverClassName}
          triggerRef={comboBoxRef}
          placement="bottom start"
          offset={4}
          style={popoverStyle}
        >
          <ListBox
            className="react-aria-ListBox"
            items={comboBoxItems}
            data-size={size}
          >
            {listBoxChildren}
          </ListBox>
        </Popover>
      )}
    </AriaComboBox>
  );
}

/**
 * ComboBoxItem Props
 * React Aria 1.13.0: onAction 지원으로 "Create new item" 패턴 구현 가능
 */
export interface ComboBoxItemProps extends ListBoxItemProps {
  /**
   * React Aria 1.13.0: 아이템 클릭 시 실행되는 액션
   * "Create" 옵션 구현에 유용 (예: 검색 결과 없을 때 새 항목 생성)
   * @example
   * <ComboBoxItem
   *   id="create-new"
   *   textValue="Create new item"
   *   onAction={() => handleCreateItem(inputValue)}
   * >
   *   + Create "{inputValue}"
   * </ComboBoxItem>
   */
  onAction?: () => void;
}

export function ComboBoxItem({ onAction, ...props }: ComboBoxItemProps) {
  return <ListBoxItem {...props} onAction={onAction} />;
}

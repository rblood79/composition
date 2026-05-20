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
import {
  toComboBoxRacProps,
  type ComboBoxCanonicalProps,
  type ComboBoxItemDescriptor,
} from "../catalog/outputs/toRacProps";

import { useCollectionData } from "../hooks";
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
  "children"
> {
  label?: string;
  description?: string | null;
  errorMessage?: string | ((validation: ValidationResult) => string);
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
  isQuiet,
  ...props
}: ComboBoxProps<T>) {
  const projectedProps = toComboBoxRacProps({
    ...props,
    label,
    description,
    errorMessage,
    placeholder,
    inputValue,
    items,
    size,
    iconName,
    labelPosition,
    isQuiet,
  } as ComboBoxCanonicalProps);
  const projectedItems = projectedProps.items ?? [];
  const effectiveLabel = projectedProps.label ?? label;
  const effectiveDescription = projectedProps.description ?? description;
  const effectiveErrorMessage = projectedProps.errorMessage ?? errorMessage;
  const effectivePlaceholder = projectedProps.placeholder;
  const effectiveInputValue = projectedProps.inputValue ?? inputValue;
  const effectiveSize = projectedProps.size;
  const effectiveIconName = projectedProps.iconName;
  const effectiveLabelPosition = projectedProps.labelPosition;
  const effectiveIsQuiet = projectedProps.isQuiet;
  const effectiveIsDisabled = projectedProps.isDisabled;
  const effectiveIsInvalid = projectedProps.isInvalid;
  const effectiveIsReadOnly = projectedProps.isReadOnly;
  const effectiveIsRequired = projectedProps.isRequired;
  const effectiveAllowsCustomValue = projectedProps.allowsCustomValue;
  const effectiveNecessityIndicator = projectedProps.necessityIndicator;
  const effectiveSelectedKey = projectedProps.selectedKey;
  const effectiveDefaultSelectedKey = projectedProps.defaultSelectedKey;
  const effectiveDefaultInputValue = projectedProps.defaultInputValue;
  const effectiveAutoFocus = projectedProps.autoFocus;
  const effectiveMenuTrigger = projectedProps.menuTrigger;
  const effectiveValidationBehavior = projectedProps.validationBehavior;

  // useCollectionData Hook - 항상 최상단에서 호출 (Rules of Hooks)
  const {
    data: boundData,
    loading,
    error,
  } = useCollectionData({
    dataBinding: dataBinding as DataBinding,
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
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Label 처리
  const hasVisibleLabel = effectiveLabel && String(effectiveLabel).trim();
  const ariaLabel = hasVisibleLabel
    ? undefined
    : props["aria-label"] || effectivePlaceholder || "Select an option";

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
  const hasBoundItems = hasDataBinding && boundData.length > 0;
  const hasProjectedStaticItems = !hasDataBinding && projectedItems.length > 0;
  const shouldRenderPopover = !isLoadingState && !isErrorState;
  const comboBoxDisabled =
    effectiveIsDisabled || isLoadingState || isErrorState;

  const comboBoxItems = React.useMemo(() => {
    if (hasProjectedStaticItems) {
      return projectedItems as unknown as T[];
    }

    if (!hasBoundItems) {
      return undefined;
    }

    if (isTemplateMode) {
      const items = boundData.map((item, index) => ({
        id: String(item.id || index),
        ...item,
      })) as T[];

      console.log("✅ ComboBox with columnMapping - items:", items);
      return items;
    }

    const config = (dataBinding as { config?: Record<string, unknown> })
      ?.config as
      | {
          columnMapping?: {
            id: string;
            label: string;
          };
          dataMapping?: {
            idField: string;
            labelField: string;
          };
        }
      | undefined;

    const idField =
      config?.columnMapping?.id || config?.dataMapping?.idField || "id";
    const labelField =
      config?.columnMapping?.label ||
      config?.dataMapping?.labelField ||
      "label";

    const items = boundData.map((item, index) => ({
      id: String(item[idField] || item.id || index),
      label: String(
        item[labelField] || item.label || item.name || `Item ${index + 1}`,
      ),
      ...item,
    })) as T[];

    console.log("✅ ComboBox Dynamic Collection - items:", items);
    return items;
  }, [
    boundData,
    dataBinding,
    hasBoundItems,
    hasProjectedStaticItems,
    isTemplateMode,
    projectedItems,
  ]);

  const listBoxChildren: React.ReactNode | ((item: T) => React.ReactNode) =
    React.useMemo(() => {
      if (hasProjectedStaticItems) {
        if (typeof children === "function") {
          return children;
        }

        return ((item: ComboBoxItemDescriptor) => (
          <ListBoxItem
            key={item.id}
            id={item.id}
            textValue={item.textValue ?? item.label}
            isDisabled={item.isDisabled}
          >
            {item.label}
          </ListBoxItem>
        )) as (item: T) => React.ReactNode;
      }

      if (isTemplateMode) {
        console.log(
          "🎯 ComboBox: columnMapping 감지 - 데이터로 아이템 렌더링",
          {
            columnMapping,
            hasChildren: !!children,
            dataCount: boundData.length,
          },
        );

        if (!hasBoundItems) {
          return children;
        }

        return children;
      }

      if (hasBoundItems) {
        return ((item: Record<string, unknown>) => (
          <ListBoxItem
            key={String(item.id)}
            id={String(item.id)}
            textValue={String(item.label)}
          >
            {String(item.label)}
          </ListBoxItem>
        )) as (item: T) => React.ReactNode;
      }

      return children;
    }, [
      boundData.length,
      children,
      columnMapping,
      hasBoundItems,
      hasProjectedStaticItems,
      isTemplateMode,
    ]);

  // External loading state (from isLoading prop) - show skeleton
  // NOTE: early return은 모든 훅 호출 이후에 위치해야 함 (Rules of Hooks)
  if (externalLoading) {
    return (
      <Skeleton
        componentVariant="input"
        size={effectiveSize}
        className={props.className as string}
        aria-label="Loading combobox..."
      />
    );
  }

  return (
    <AriaComboBox
      {...props}
      ref={comboBoxRef}
      inputValue={effectiveInputValue}
      defaultInputValue={effectiveDefaultInputValue}
      onInputChange={onInputChange}
      selectedKey={effectiveSelectedKey}
      defaultSelectedKey={effectiveDefaultSelectedKey}
      allowsCustomValue={effectiveAllowsCustomValue}
      isInvalid={effectiveIsInvalid}
      isReadOnly={effectiveIsReadOnly}
      isRequired={effectiveIsRequired}
      autoFocus={effectiveAutoFocus}
      menuTrigger={effectiveMenuTrigger}
      validationBehavior={effectiveValidationBehavior}
      className={comboBoxClassName}
      data-size={effectiveSize}
      data-label-position={effectiveLabelPosition}
      data-quiet={effectiveIsQuiet ? "true" : undefined}
      aria-label={ariaLabel}
      isDisabled={comboBoxDisabled}
    >
      {hasVisibleLabel && (
        <Label>
          {String(effectiveLabel)}
          {renderNecessityIndicator(
            effectiveNecessityIndicator,
            effectiveIsRequired,
          )}
        </Label>
      )}
      <div className="combobox-container">
        <Input placeholder={effectivePlaceholder} />
        <Button>
          {(() => {
            const name = effectiveIconName || "chevron-down";
            const data = getIconData(name);
            if (!data) return null;
            return (
              <svg
                width={16}
                height={16}
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
      {effectiveDescription && (
        <Text slot="description">{effectiveDescription}</Text>
      )}
      {isLoadingState && <Text slot="description">⏳ 데이터 로딩 중...</Text>}
      {isErrorState && <FieldError>❌ 오류: {error}</FieldError>}
      {effectiveErrorMessage && !isErrorState && (
        <FieldError>{effectiveErrorMessage}</FieldError>
      )}
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
            data-size={effectiveSize}
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

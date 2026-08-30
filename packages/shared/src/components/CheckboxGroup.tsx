import {
  Checkbox as AriaCheckbox,
  CheckboxGroup as AriaCheckboxGroup,
  CheckboxGroupProps as AriaCheckboxGroupProps,
  FieldError,
  Label,
  Text,
  ValidationResult,
  composeRenderProps,
} from "react-aria-components";
import { CheckIcon, Minus } from "lucide-react";
import type { DataBinding, ColumnMapping, DataBindingValue } from "../types";

import type { ComponentSizeSubset } from "../types";
import {
  type NecessityIndicator,
  renderNecessityIndicator,
} from "./FieldNecessityIndicator";
import { useCollectionData } from "../hooks";

import "./styles/generated/CheckboxGroup.css";
import { useComponentStrings } from "../i18n";

/**
 * 🚀 Phase 4: data-* 패턴 전환
 * - tailwind-variants 제거
 * - data-checkbox-variant, data-checkbox-size 속성 사용
 */

export interface CheckboxGroupProps extends Omit<
  AriaCheckboxGroupProps,
  "children"
> {
  children?: React.ReactNode;
  label?: string;
  description?: string;
  errorMessage?: string | ((validation: ValidationResult) => string);
  orientation?: "horizontal" | "vertical";
  // 데이터 바인딩
  dataBinding?: DataBinding | DataBindingValue;
  columnMapping?: ColumnMapping;
  /**
   * Size for child Checkbox buttons
   * @default 'md'
   */
  size?: ComponentSizeSubset;
  necessityIndicator?: NecessityIndicator;
  labelPosition?: "top" | "side";
}

export function CheckboxGroup({
  label,
  description,
  errorMessage,
  children,
  orientation = "vertical",
  dataBinding,
  columnMapping,
  size = "md",
  labelPosition = "top",
  ...props
}: CheckboxGroupProps) {
  const t = useComponentStrings();
  // useCollectionData Hook으로 데이터 가져오기 (Static, API, Supabase 통합)
  const {
    data: boundData,
    loading,
    error,
  } = useCollectionData({
    dataBinding: dataBinding as DataBinding,
    componentName: "CheckboxGroup",
    fallbackData: [
      { id: 1, name: "Option 1", value: "option-1" },
      { id: 2, name: "Option 2", value: "option-2" },
    ],
  });

  // DataBinding이 있고 데이터가 로드되었을 때 동적 Checkbox 생성
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

  const checkboxGroupClassName = composeRenderProps(
    props.className,
    (className) =>
      className
        ? `react-aria-CheckboxGroup ${className}`
        : "react-aria-CheckboxGroup",
  );

  // ColumnMapping이 있으면 각 데이터 항목마다 Checkbox 렌더링
  // ListBox와 동일한 패턴
  if (hasDataBinding && columnMapping) {
    console.log(
      "🎯 CheckboxGroup: columnMapping 감지 - 데이터로 Checkbox 렌더링",
      {
        columnMapping,
        hasChildren: !!children,
        dataCount: boundData.length,
      },
    );

    // Loading 상태
    if (loading) {
      return (
        <AriaCheckboxGroup
          {...props}
          className={checkboxGroupClassName}
          data-orientation={orientation}
          data-checkbox-size={size}
          data-label-position={labelPosition}
          isDisabled
        >
          {label && (
            <Label>
              {label}
              {renderNecessityIndicator(
                props.necessityIndicator,
                props.isRequired,
              )}
            </Label>
          )}
          <Text>{t("loadingData")}</Text>
          {description && <Text slot="description">{description}</Text>}
        </AriaCheckboxGroup>
      );
    }

    // Error 상태
    if (error) {
      return (
        <AriaCheckboxGroup
          {...props}
          className={checkboxGroupClassName}
          data-orientation={orientation}
          data-checkbox-size={size}
          data-label-position={labelPosition}
          isDisabled
        >
          {label && (
            <Label>
              {label}
              {renderNecessityIndicator(
                props.necessityIndicator,
                props.isRequired,
              )}
            </Label>
          )}
          <Text>{t("errorWithMessage", { message: String(error) })}</Text>
          {description && <Text slot="description">{description}</Text>}
        </AriaCheckboxGroup>
      );
    }

    // 데이터가 있을 때: children 템플릿 사용
    if (boundData.length > 0) {
      console.log(
        "✅ CheckboxGroup with columnMapping - using children template",
      );

      // children은 Checkbox 템플릿 (Field 자식 포함 가능)
      return (
        <AriaCheckboxGroup
          {...props}
          className={checkboxGroupClassName}
          data-orientation={orientation}
          data-checkbox-size={size}
          data-label-position={labelPosition}
        >
          {label && (
            <Label>
              {label}
              {renderNecessityIndicator(
                props.necessityIndicator,
                props.isRequired,
              )}
            </Label>
          )}
          {children}
          {description && <Text slot="description">{description}</Text>}
          <FieldError>{errorMessage}</FieldError>
        </AriaCheckboxGroup>
      );
    }

    // 데이터 없음
    return (
      <AriaCheckboxGroup
        {...props}
        className={checkboxGroupClassName}
        data-orientation={orientation}
        data-checkbox-size={size}
        data-label-position={labelPosition}
      >
        {label && (
          <Label>
            {label}
            {renderNecessityIndicator(
              props.necessityIndicator,
              props.isRequired,
            )}
          </Label>
        )}
        {children}
        {description && <Text slot="description">{description}</Text>}
        <FieldError>{errorMessage}</FieldError>
      </AriaCheckboxGroup>
    );
  }

  // Dynamic Collection: 동적으로 Checkbox 생성 (columnMapping 없을 때)
  if (hasDataBinding) {
    // Loading 상태
    if (loading) {
      return (
        <AriaCheckboxGroup
          {...props}
          className={checkboxGroupClassName}
          data-orientation={orientation}
          data-checkbox-size={size}
          data-label-position={labelPosition}
          isDisabled
        >
          {label && (
            <Label>
              {label}
              {renderNecessityIndicator(
                props.necessityIndicator,
                props.isRequired,
              )}
            </Label>
          )}
          <Text>{t("loadingData")}</Text>
          {description && <Text slot="description">{description}</Text>}
        </AriaCheckboxGroup>
      );
    }

    // Error 상태
    if (error) {
      return (
        <AriaCheckboxGroup
          {...props}
          className={checkboxGroupClassName}
          data-orientation={orientation}
          data-checkbox-size={size}
          data-label-position={labelPosition}
          isDisabled
        >
          {label && (
            <Label>
              {label}
              {renderNecessityIndicator(
                props.necessityIndicator,
                props.isRequired,
              )}
            </Label>
          )}
          <Text>{t("errorWithMessage", { message: String(error) })}</Text>
          {description && <Text slot="description">{description}</Text>}
        </AriaCheckboxGroup>
      );
    }

    // 데이터가 로드되었을 때
    if (boundData.length > 0) {
      const checkboxItems = boundData.map((item, index) => ({
        id: String(item.id || index),
        value: String(item.value || item.id || index),
        label: String(
          item.name || item.title || item.label || `Option ${index + 1}`,
        ),
        isDisabled: Boolean(item.isDisabled),
      }));

      console.log(
        "✅ CheckboxGroup Dynamic Collection - items:",
        checkboxItems,
      );

      return (
        <AriaCheckboxGroup
          {...props}
          className={checkboxGroupClassName}
          data-orientation={orientation}
          data-checkbox-size={size}
          data-label-position={labelPosition}
        >
          {label && (
            <Label>
              {label}
              {renderNecessityIndicator(
                props.necessityIndicator,
                props.isRequired,
              )}
            </Label>
          )}
          {checkboxItems.map((item) => (
            <AriaCheckbox
              key={item.id}
              value={item.value}
              isDisabled={item.isDisabled}
              className="react-aria-Checkbox"
            >
              {({ isSelected, isIndeterminate }) => (
                <>
                  <div className="checkbox">
                    {isIndeterminate ? (
                      <Minus size={16} strokeWidth={4} />
                    ) : (
                      isSelected && <CheckIcon size={16} strokeWidth={4} />
                    )}
                  </div>
                  {item.label}
                </>
              )}
            </AriaCheckbox>
          ))}
          {description && <Text slot="description">{description}</Text>}
          <FieldError>{errorMessage}</FieldError>
        </AriaCheckboxGroup>
      );
    }
  }

  // Static Children — react-aria-starter CheckboxGroup 구조 채택 (ADR-912, 2026-06-14):
  //   자식 Checkbox 를 `<div className="checkbox-items">` 로 self-compose.
  //   CheckboxItems 중간 element 폐기 후, 이 wrapper 가 generated CSS
  //   (.react-aria-CheckboxGroup .checkbox-items { display:flex; flex-direction:column })
  //   의 flex 컨테이너 역할을 담당 → builder Preview(renderCheckboxGroup)와 대칭.
  return (
    <AriaCheckboxGroup
      {...props}
      className={checkboxGroupClassName}
      data-orientation={orientation}
      data-checkbox-size={size}
      data-label-position={labelPosition}
    >
      {label && (
        <Label>
          {label}
          {renderNecessityIndicator(props.necessityIndicator, props.isRequired)}
        </Label>
      )}
      <div className="checkbox-items">{children}</div>
      {description && <Text slot="description">{description}</Text>}
      <FieldError>{errorMessage}</FieldError>
    </AriaCheckboxGroup>
  );
}

export { CheckboxGroup as MyCheckboxGroup };

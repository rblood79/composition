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
import {
  toCheckboxGroupRacProps,
  type CheckboxGroupCanonicalProps,
} from "../catalog/outputs/toRacProps";

import "./styles/generated/CheckboxGroup.css";

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
  labelAlign?: "start" | "end";
  isEmphasized?: boolean;
}

export function CheckboxGroup({
  label: inputLabel,
  description: inputDescription,
  errorMessage: inputErrorMessage,
  children,
  orientation: inputOrientation,
  dataBinding,
  columnMapping,
  size: inputSize,
  necessityIndicator: inputNecessityIndicator,
  labelPosition: inputLabelPosition,
  labelAlign: inputLabelAlign,
  isEmphasized: inputIsEmphasized,
  value: inputValue,
  defaultValue: inputDefaultValue,
  isDisabled: inputIsDisabled,
  isInvalid: inputIsInvalid,
  isReadOnly: inputIsReadOnly,
  isRequired: inputIsRequired,
  name: inputName,
  form,
  validationBehavior: inputValidationBehavior,
  className,
  style,
  ...props
}: CheckboxGroupProps) {
  const projectedProps = toCheckboxGroupRacProps({
    ...props,
    className,
    defaultValue: inputDefaultValue,
    description: inputDescription,
    errorMessage:
      typeof inputErrorMessage === "string" ? inputErrorMessage : undefined,
    form,
    isDisabled: inputIsDisabled,
    isEmphasized: inputIsEmphasized,
    isInvalid: inputIsInvalid,
    isReadOnly: inputIsReadOnly,
    isRequired: inputIsRequired,
    label: inputLabel,
    labelAlign: inputLabelAlign,
    labelPosition: inputLabelPosition,
    name: inputName,
    necessityIndicator: inputNecessityIndicator,
    orientation: inputOrientation,
    size: inputSize,
    style,
    validationBehavior: inputValidationBehavior,
    value: inputValue,
  } as CheckboxGroupCanonicalProps);
  const label = inputLabel ?? projectedProps.label;
  const description = inputDescription ?? projectedProps.description;
  const errorMessage = inputErrorMessage ?? projectedProps.errorMessage;
  const orientation = inputOrientation ?? projectedProps.orientation;
  const size = inputSize ?? projectedProps.size;
  const labelPosition = inputLabelPosition ?? projectedProps.labelPosition;
  const labelAlign = inputLabelAlign ?? projectedProps.labelAlign;
  const isEmphasized =
    inputIsEmphasized ?? projectedProps.isEmphasized ?? false;
  const isRequired = inputIsRequired ?? projectedProps.isRequired;
  const necessityIndicator =
    inputNecessityIndicator ?? projectedProps.necessityIndicator;
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

  const checkboxGroupClassName = composeRenderProps(className, (className) =>
    className
      ? `react-aria-CheckboxGroup ${className}`
      : "react-aria-CheckboxGroup",
  );

  const renderLabel = () =>
    label ? (
      <Label>
        {label}
        {renderNecessityIndicator(necessityIndicator, isRequired)}
      </Label>
    ) : null;

  const renderDescription = () =>
    description ? <Text slot="description">{description}</Text> : null;

  const renderShell = (
    content: React.ReactNode,
    options: { forceDisabled?: boolean; includeFieldError?: boolean } = {},
  ) => {
    const shellIsDisabled = options.forceDisabled
      ? true
      : (inputIsDisabled ?? projectedProps.isDisabled);

    return (
      <AriaCheckboxGroup
        {...props}
        className={checkboxGroupClassName}
        style={style}
        value={inputValue ?? projectedProps.value}
        defaultValue={inputDefaultValue ?? projectedProps.defaultValue}
        isDisabled={shellIsDisabled}
        isInvalid={inputIsInvalid ?? projectedProps.isInvalid}
        isReadOnly={inputIsReadOnly ?? projectedProps.isReadOnly}
        isRequired={isRequired}
        name={inputName ?? projectedProps.name}
        validationBehavior={
          inputValidationBehavior ?? projectedProps.validationBehavior
        }
        data-orientation={orientation}
        data-size={size}
        data-checkbox-size={size}
        data-emphasized={isEmphasized || undefined}
        data-checkbox-emphasized={isEmphasized || undefined}
        data-label-position={labelPosition}
        data-label-align={labelAlign}
      >
        {renderLabel()}
        {content}
        {renderDescription()}
        {options.includeFieldError === false ? null : (
          <FieldError>{errorMessage}</FieldError>
        )}
      </AriaCheckboxGroup>
    );
  };

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
      return renderShell(<Text>⏳ 데이터 로딩 중...</Text>, {
        forceDisabled: true,
        includeFieldError: false,
      });
    }

    // Error 상태
    if (error) {
      return renderShell(<Text>❌ 오류: {error}</Text>, {
        forceDisabled: true,
        includeFieldError: false,
      });
    }

    // 데이터가 있을 때: children 템플릿 사용
    if (boundData.length > 0) {
      console.log(
        "✅ CheckboxGroup with columnMapping - using children template",
      );

      // children은 Checkbox 템플릿 (Field 자식 포함 가능)
      return renderShell(children);
    }

    // 데이터 없음
    return renderShell(children);
  }

  // Dynamic Collection: 동적으로 Checkbox 생성 (columnMapping 없을 때)
  if (hasDataBinding) {
    // Loading 상태
    if (loading) {
      return renderShell(<Text>⏳ 데이터 로딩 중...</Text>, {
        forceDisabled: true,
        includeFieldError: false,
      });
    }

    // Error 상태
    if (error) {
      return renderShell(<Text>❌ 오류: {error}</Text>, {
        forceDisabled: true,
        includeFieldError: false,
      });
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

      return renderShell(
        <>
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
        </>,
      );
    }
  }

  // Static Children (기존 방식)
  return renderShell(children);
}

export { CheckboxGroup as MyCheckboxGroup };

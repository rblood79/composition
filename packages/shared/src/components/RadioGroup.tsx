import {
  FieldError,
  Label,
  Radio as AriaRadio,
  RadioGroup as AriaRadioGroup,
  RadioGroupProps as AriaRadioGroupProps,
  Text,
  ValidationResult,
  composeRenderProps,
} from "react-aria-components";
import type { DataBinding, ColumnMapping, DataBindingValue } from "../types";

import type { ComponentSizeSubset } from "../types";
import {
  type NecessityIndicator,
  renderNecessityIndicator,
} from "./FieldNecessityIndicator";
import { useCollectionData } from "../hooks";
import {
  toRadioGroupRacProps,
  type RadioGroupCanonicalProps,
} from "../catalog/outputs/toRacProps";

import "./styles/generated/RadioGroup.css";

export interface RadioGroupProps extends Omit<AriaRadioGroupProps, "children"> {
  children?: React.ReactNode;
  label?: string;
  description?: string;
  errorMessage?: string | ((validation: ValidationResult) => string);
  dataBinding?: DataBinding | DataBindingValue;
  columnMapping?: ColumnMapping;
  variant?: "default" | "accent";
  size?: ComponentSizeSubset | "xl";
  necessityIndicator?: NecessityIndicator;
  labelPosition?: "top" | "side";
  labelAlign?: "start" | "end";
  isEmphasized?: boolean;
}

export function RadioGroup({
  label: inputLabel,
  description: inputDescription,
  errorMessage: inputErrorMessage,
  children,
  dataBinding,
  columnMapping,
  variant: inputVariant,
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
}: RadioGroupProps) {
  const projectedProps = toRadioGroupRacProps({
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
    orientation: props.orientation,
    size: inputSize,
    style,
    validationBehavior: inputValidationBehavior,
    value: inputValue,
    variant: inputVariant,
  } as RadioGroupCanonicalProps);
  const label = inputLabel ?? projectedProps.label;
  const description = inputDescription ?? projectedProps.description;
  const errorMessage = inputErrorMessage ?? projectedProps.errorMessage;
  const variant = inputVariant ?? projectedProps.variant;
  const orientation = props.orientation ?? projectedProps.orientation;
  const size = inputSize ?? projectedProps.size;
  const labelPosition = inputLabelPosition ?? projectedProps.labelPosition;
  const labelAlign = inputLabelAlign ?? projectedProps.labelAlign;
  const isEmphasized =
    inputIsEmphasized ?? projectedProps.isEmphasized ?? false;
  const isRequired = inputIsRequired ?? projectedProps.isRequired;
  const necessityIndicator =
    inputNecessityIndicator ?? projectedProps.necessityIndicator;

  const {
    data: boundData,
    loading,
    error,
  } = useCollectionData({
    dataBinding: dataBinding as DataBinding,
    componentName: "RadioGroup",
    fallbackData: [
      { id: 1, name: "Option 1", value: "option-1" },
      { id: 2, name: "Option 2", value: "option-2" },
    ],
  });

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

  const radioGroupClassName = composeRenderProps(className, (className) =>
    className ? `react-aria-RadioGroup ${className}` : "react-aria-RadioGroup",
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
      <AriaRadioGroup
        {...props}
        className={radioGroupClassName}
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
        data-radio-size={size}
        data-radio-variant={variant}
        data-emphasized={isEmphasized || undefined}
        data-radio-emphasized={isEmphasized || undefined}
        data-label-position={labelPosition}
        data-label-align={labelAlign}
      >
        {renderLabel()}
        {content}
        {renderDescription()}
        {options.includeFieldError === false ? null : (
          <FieldError>{errorMessage}</FieldError>
        )}
      </AriaRadioGroup>
    );
  };

  if (hasDataBinding && columnMapping) {
    console.log("🎯 RadioGroup: columnMapping 감지 - 데이터로 Radio 렌더링", {
      columnMapping,
      hasChildren: !!children,
      dataCount: boundData.length,
    });

    if (loading) {
      return renderShell(<Text>⏳ 데이터 로딩 중...</Text>, {
        forceDisabled: true,
        includeFieldError: false,
      });
    }

    if (error) {
      return renderShell(<Text>❌ 오류: {error}</Text>, {
        forceDisabled: true,
        includeFieldError: false,
      });
    }

    if (boundData.length > 0) {
      console.log("✅ RadioGroup with columnMapping - using children template");
      return renderShell(<div className="radio-items">{children}</div>);
    }

    return renderShell(<div className="radio-items">{children}</div>);
  }

  if (hasDataBinding) {
    if (loading) {
      return renderShell(<Text>⏳ 데이터 로딩 중...</Text>, {
        forceDisabled: true,
        includeFieldError: false,
      });
    }

    if (error) {
      return renderShell(<Text>❌ 오류: {error}</Text>, {
        forceDisabled: true,
        includeFieldError: false,
      });
    }

    if (boundData.length > 0) {
      const radioItems = boundData.map((item, index) => ({
        id: String(item.id || index),
        value: String(item.value || item.id || index),
        label: String(
          item.name || item.title || item.label || `Option ${index + 1}`,
        ),
        isDisabled: Boolean(item.isDisabled),
      }));

      console.log("✅ RadioGroup Dynamic Collection - items:", radioItems);

      return renderShell(
        <>
          {radioItems.map((item) => (
            <AriaRadio
              key={item.id}
              value={item.value}
              isDisabled={item.isDisabled}
              className="react-aria-Radio"
            >
              {item.label}
            </AriaRadio>
          ))}
        </>,
      );
    }
  }

  return renderShell(<div className="radio-items">{children}</div>);
}

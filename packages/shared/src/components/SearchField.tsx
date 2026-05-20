/**
 * SearchField Component
 *
 * ComboBox와 동일한 구조: Label + Wrapper(SearchIcon + Input + ClearButton)
 * React Aria SearchField 기반
 */

import {
  Button,
  FieldError,
  Input,
  Label,
  SearchField as AriaSearchField,
  SearchFieldProps as AriaSearchFieldProps,
  Text,
  ValidationResult,
  composeRenderProps,
} from "react-aria-components";
import { Search, X } from "lucide-react";
import {
  toSearchFieldRacProps,
  type SearchFieldCanonicalProps,
} from "../catalog/outputs/toRacProps";
import type { ComponentSize } from "../types";
import {
  type NecessityIndicator,
  renderNecessityIndicator,
} from "./FieldNecessityIndicator";

import "./styles/generated/SearchField.css";

export interface SearchFieldProps extends Omit<
  AriaSearchFieldProps,
  "spellCheck"
> {
  label?: string;
  description?: string;
  errorMessage?: string | ((validation: ValidationResult) => string);
  placeholder?: string;
  type?: "text" | "search" | "url" | "tel" | "email";
  inputMode?:
    | "none"
    | "text"
    | "tel"
    | "url"
    | "email"
    | "numeric"
    | "decimal"
    | "search";
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  autoCorrect?: "on" | "off";
  spellCheck?: boolean;
  enterKeyHint?:
    | "enter"
    | "done"
    | "go"
    | "next"
    | "previous"
    | "search"
    | "send";
  size?: ComponentSize;
  necessityIndicator?: NecessityIndicator;
  labelPosition?: "top" | "side";
  isQuiet?: boolean;
}

export function SearchField({
  label,
  description,
  errorMessage,
  placeholder,
  type,
  inputMode,
  pattern,
  minLength,
  maxLength,
  autoCorrect,
  spellCheck,
  enterKeyHint,
  value,
  defaultValue,
  onChange,
  isRequired,
  isDisabled,
  isReadOnly,
  isInvalid,
  size,
  necessityIndicator,
  labelPosition,
  isQuiet,
  ...props
}: SearchFieldProps) {
  const projectedProps = toSearchFieldRacProps({
    ...props,
    label,
    description,
    errorMessage,
    placeholder,
    type,
    inputMode,
    pattern,
    minLength,
    maxLength,
    autoCorrect,
    spellCheck,
    enterKeyHint,
    value,
    defaultValue,
    isRequired,
    isDisabled,
    isReadOnly,
    isInvalid,
    size,
    necessityIndicator,
    labelPosition,
    isQuiet,
  } as SearchFieldCanonicalProps);
  const fieldSize = size ?? projectedProps.size;
  const fieldLabel = label;
  const fieldDescription = description ?? projectedProps.description;
  const fieldErrorMessage = errorMessage ?? projectedProps.errorMessage;
  const fieldIsRequired = isRequired ?? projectedProps.isRequired;

  return (
    <AriaSearchField
      {...props}
      className={composeRenderProps(props.className, (className) =>
        className
          ? `react-aria-SearchField ${className}`
          : "react-aria-SearchField",
      )}
      data-size={fieldSize}
      data-label-position={labelPosition ?? projectedProps.labelPosition}
      data-quiet={(isQuiet ?? projectedProps.isQuiet) ? "true" : undefined}
      value={value ?? projectedProps.value}
      defaultValue={defaultValue ?? projectedProps.defaultValue}
      onChange={onChange}
      isRequired={fieldIsRequired}
      isDisabled={isDisabled ?? projectedProps.isDisabled}
      isReadOnly={isReadOnly ?? projectedProps.isReadOnly}
      isInvalid={isInvalid ?? projectedProps.isInvalid}
    >
      {fieldLabel && (
        <Label>
          {fieldLabel}
          {renderNecessityIndicator(
            necessityIndicator ?? projectedProps.necessityIndicator,
            fieldIsRequired,
          )}
        </Label>
      )}
      <div className="searchfield-container">
        <span className="search-icon" aria-hidden="true">
          <Search width={16} height={16} />
        </span>
        <Input
          type={type ?? projectedProps.type}
          placeholder={placeholder ?? projectedProps.placeholder}
          inputMode={inputMode ?? projectedProps.inputMode}
          pattern={pattern ?? projectedProps.pattern}
          minLength={minLength ?? projectedProps.minLength}
          maxLength={maxLength ?? projectedProps.maxLength}
          autoCorrect={autoCorrect ?? projectedProps.autoCorrect}
          spellCheck={spellCheck ?? projectedProps.spellCheck}
          enterKeyHint={enterKeyHint ?? projectedProps.enterKeyHint}
        />
        <Button aria-label="Clear search">
          <X width={16} height={16} />
        </Button>
      </div>
      {fieldDescription && <Text slot="description">{fieldDescription}</Text>}
      <FieldError>{fieldErrorMessage}</FieldError>
    </AriaSearchField>
  );
}

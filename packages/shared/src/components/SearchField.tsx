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
import type { ComponentSize } from "../types";
import { getIconData } from "@composition/specs";
import {
  type NecessityIndicator,
  renderNecessityIndicator,
} from "./FieldNecessityIndicator";

import "./styles/generated/SearchField.css";

export interface SearchFieldProps extends AriaSearchFieldProps {
  label?: string;
  description?: string;
  errorMessage?: string | ((validation: ValidationResult) => string);
  placeholder?: string;
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
  size = "md",
  necessityIndicator,
  labelPosition = "top",
  isQuiet,
  ...props
}: SearchFieldProps) {
  const searchIconData = getIconData("search");
  const clearIconData = getIconData("x");

  return (
    <AriaSearchField
      {...props}
      className={composeRenderProps(props.className, (className) =>
        className
          ? `react-aria-SearchField ${className}`
          : "react-aria-SearchField",
      )}
      data-size={size}
      data-label-position={labelPosition}
      data-quiet={isQuiet ? "true" : undefined}
    >
      {label && (
        <Label>
          {label}
          {renderNecessityIndicator(necessityIndicator, props.isRequired)}
        </Label>
      )}
      <div className="searchfield-container">
        {searchIconData && (
          <span className="search-icon" aria-hidden="true">
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
              {searchIconData.paths.map((d, i) => (
                <path key={i} d={d} />
              ))}
              {searchIconData.circles?.map((c, i) => (
                <circle key={`c${i}`} cx={c.cx} cy={c.cy} r={c.r} />
              ))}
            </svg>
          </span>
        )}
        <Input placeholder={placeholder} />
        <Button>
          {clearIconData && (
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
              {clearIconData.paths.map((d, i) => (
                <path key={i} d={d} />
              ))}
            </svg>
          )}
        </Button>
      </div>
      {description && <Text slot="description">{description}</Text>}
      <FieldError>{errorMessage}</FieldError>
    </AriaSearchField>
  );
}

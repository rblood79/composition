/**
 * SearchField Component
 *
 * ComboBox와 동일한 구조: Label + Wrapper(SearchIcon + Input + ClearButton)
 * React Aria SearchField 기반
 */

import { Button } from "react-aria-components/Button";
import { FieldError } from "react-aria-components/FieldError";
import { Input } from "react-aria-components/Input";
import {
  SearchField as AriaSearchField,
  SearchFieldProps as AriaSearchFieldProps,
} from "react-aria-components/SearchField";
import { Text } from "react-aria-components/Text";
import { ValidationResult } from "react-aria-components/TextField";
import { composeRenderProps } from "react-aria-components/composeRenderProps";
import type { ReactNode } from "react";
import type { ComponentSize } from "../types";
import { getIconData } from "@composition/rendering";
import { resolveTriggerIconSize } from "../catalog/resolvers/resolveTriggerIconSize";
import {
  type NecessityIndicator,
  renderNecessityIndicator,
  renderFieldLabel,
  renderFieldDescription,
  renderFieldError,
} from "./FieldNecessityIndicator";

export interface SearchFieldProps extends AriaSearchFieldProps {
  label?: string;
  description?: string;
  errorMessage?: string | ((validation: ValidationResult) => string);
  placeholder?: string;
  /**
   * The field's control part node elements (catalog runtime, ADR-253): the search glyph, the
   * Input and the clear button inside the container, in order; absent = composed here.
   */
  controlElements?: ReactNode[];
  size?: ComponentSize;
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

export function SearchField({
  label,
  description,
  errorMessage,
  placeholder,
  size = "md",
  necessityIndicator,
  labelPosition = "top",
  labelAlign,
  isQuiet,
  controlElements,
  ...props
}: SearchFieldProps) {
  const searchIconData = getIconData("search");
  const clearIconData = getIconData("x");
  // search/clear glyph 크기 — Skia SelectIcon 과 동일한 catalog 값 (Select/DatePicker 동형).
  //   구 `width={16}` 하드코딩은 size 를 바꿔도 glyph 가 16 고정이었다 (2026-07-14).
  const iconSize = resolveTriggerIconSize(size);

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
      data-label-align={labelAlign}
      data-quiet={isQuiet ? "true" : undefined}
    >
      {renderFieldLabel(label, necessityIndicator, props.isRequired)}
      <div className="searchfield-container">
        {controlElements ?? (
          <>
            {searchIconData && (
              <span className="search-icon" aria-hidden="true">
                <svg
                  width={iconSize}
                  height={iconSize}
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
            <Input
              placeholder={placeholder}
              data-quiet={isQuiet ? "true" : undefined}
            />
            <Button>
              {clearIconData && (
                <svg
                  width={iconSize}
                  height={iconSize}
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
          </>
        )}
      </div>
      {renderFieldDescription(description)}
      {renderFieldError(errorMessage)}
    </AriaSearchField>
  );
}

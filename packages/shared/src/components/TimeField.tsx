/**
 * TimeField Component - Material Design 3
 *
 * M3 Variants: primary, secondary, tertiary, error, filled
 * Sizes: sm, md, lg
 */

import {
  DateInput,
  DateSegment,
  FieldError,
  Label,
  Text,
  TimeField as AriaTimeField,
  TimeFieldProps as AriaTimeFieldProps,
  TimeValue,
  ValidationResult,
  composeRenderProps,
} from "react-aria-components";
import { Time } from "@internationalized/date";
import type { ComponentSize } from "../types";
import {
  type NecessityIndicator,
  renderNecessityIndicator,
} from "./FieldNecessityIndicator";

import "./styles/generated/TimeField.css";

/**
 * 🚀 Phase 4: data-* 패턴 전환
 * - tailwind-variants 제거
 * - data-variant, data-size 속성 사용
 */

export interface TimeFieldProps<T extends TimeValue> extends Omit<
  AriaTimeFieldProps<T>,
  "placeholderValue" | "minValue" | "maxValue"
> {
  label?: string;
  description?: string;
  errorMessage?: string | ((validation: ValidationResult) => string);
  /**
   * 시간 형식
   * - 12: 12시간 형식 (AM/PM)
   * - 24: 24시간 형식
   * @default 24
   */
  hourCycle?: 12 | 24;
  /**
   * 플레이스홀더 텍스트
   */
  placeholder?: string;
  // S2 props
  size?: ComponentSize;
  necessityIndicator?: NecessityIndicator;
  labelPosition?: "top" | "side";
  isQuiet?: boolean;
  hideTimeZone?: boolean;
  shouldForceLeadingZeros?: boolean;
  /** @example "09:00" */
  placeholderValue?: string | T;
  minValue?: T;
  maxValue?: T;
  form?: string;
  validationBehavior?: "native" | "aria";
}

export function TimeField<T extends TimeValue>({
  label,
  description,
  errorMessage,
  hourCycle = 24,
  placeholder,
  size = "md",
  necessityIndicator,
  labelPosition = "top",
  isQuiet,
  hideTimeZone,
  shouldForceLeadingZeros,
  placeholderValue,
  minValue,
  maxValue,
  form,
  validationBehavior,
  ...props
}: TimeFieldProps<T>) {
  // placeholderValue 문자열 자동 파싱 ("HH:MM" → Time)
  const parsedPlaceholderValue = (() => {
    if (!placeholderValue || typeof placeholderValue !== "string")
      return placeholderValue as T | undefined;
    const parts = placeholderValue.split(":");
    if (parts.length >= 2) {
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const s = parts[2] ? parseInt(parts[2], 10) : 0;
      if (!isNaN(h) && !isNaN(m)) return new Time(h, m, s) as T;
    }
    return undefined;
  })();

  return (
    <AriaTimeField
      {...props}
      className={composeRenderProps(props.className, (className) =>
        className
          ? `react-aria-TimeField ${className}`
          : "react-aria-TimeField",
      )}
      data-size={size}
      data-label-position={labelPosition}
      data-quiet={isQuiet ? "true" : undefined}
      hourCycle={hourCycle}
      placeholderValue={parsedPlaceholderValue}
      hideTimeZone={hideTimeZone}
      shouldForceLeadingZeros={shouldForceLeadingZeros}
      minValue={minValue}
      maxValue={maxValue}
      form={form}
      validationBehavior={validationBehavior}
    >
      {label && (
        <Label>
          {label}
          {renderNecessityIndicator(necessityIndicator, props.isRequired)}
        </Label>
      )}
      <DateInput className="react-aria-DateInput inset">
        {(segment) => (
          <DateSegment
            segment={segment}
            data-placeholder={!segment.isPlaceholder ? undefined : placeholder}
          />
        )}
      </DateInput>
      {description && <Text slot="description">{description}</Text>}
      <FieldError>{errorMessage}</FieldError>
    </AriaTimeField>
  );
}

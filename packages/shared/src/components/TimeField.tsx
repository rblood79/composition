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
  /**
   * side 라벨 컬럼 안에서의 라벨 텍스트 정렬 (RSP `labelAlign`). Form 조상이 지정하면
   * 상속하고, 자신이 지정하면 그것이 우선 (renderer 의 nearest-wins).
   * @default 'start'
   */
  labelAlign?: "start" | "center" | "end";
  isQuiet?: boolean;
  hideTimeZone?: boolean;
  shouldForceLeadingZeros?: boolean;
  /** @example "09:00" */
  placeholderValue?: string | T;
  /** 최소 시각 — "HH:mm(:ss)" 문자열 자동 파싱 (DateField minValue 동형, §1-3 2026-08-21) */
  minValue?: string | T;
  /** 최대 시각 — "HH:mm(:ss)" 문자열 자동 파싱 */
  maxValue?: string | T;
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
  labelAlign,
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
  // "HH:MM(:SS)" 문자열 자동 파싱 — placeholderValue/minValue/maxValue 공용
  //   (min/max 는 DateField 의 safeParseDateString 파싱 동형, §1-3 2026-08-21)
  const parseTimeString = (v: string | T | undefined): T | undefined => {
    if (!v || typeof v !== "string") return v as T | undefined;
    const parts = v.split(":");
    if (parts.length >= 2) {
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const s = parts[2] ? parseInt(parts[2], 10) : 0;
      if (!isNaN(h) && !isNaN(m)) return new Time(h, m, s) as T;
    }
    return undefined;
  };
  const parsedPlaceholderValue = parseTimeString(placeholderValue);
  const parsedMinValue = parseTimeString(minValue);
  const parsedMaxValue = parseTimeString(maxValue);

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
      data-label-align={labelAlign}
      data-quiet={isQuiet ? "true" : undefined}
      hourCycle={hourCycle}
      placeholderValue={parsedPlaceholderValue}
      hideTimeZone={hideTimeZone}
      shouldForceLeadingZeros={shouldForceLeadingZeros}
      minValue={parsedMinValue}
      maxValue={parsedMaxValue}
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

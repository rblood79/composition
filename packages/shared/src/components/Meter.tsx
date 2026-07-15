/**
 * Meter Component
 *
 * A visual indicator for showing a measurement value
 * Based on React Aria Components Meter
 */

import {
  Label,
  Meter as AriaMeter,
  MeterProps as AriaMeterProps,
  composeRenderProps,
} from "react-aria-components";
import type { ComponentSizeSubset, MeterVariant } from "../types";
import { formatPercent } from "../utils/core/numberUtils";
import { Skeleton } from "./Skeleton";

import "./styles/generated/Meter.css";

export interface MeterProps extends AriaMeterProps {
  label?: string;
  /**
   * Visual variant (S2)
   * @default 'informative'
   */
  variant?: MeterVariant;
  /**
   * Size of the meter
   * @default 'md'
   */
  size?: ComponentSizeSubset;
  /**
   * 로케일
   * @default 'ko-KR'
   */
  locale?: string;
  /**
   * Intl.NumberFormat 옵션으로 값 표시 형식 제어
   * - { style: "decimal" } → 숫자로 표시 (75)
   * - { style: "percent" } → 퍼센트로 표시 (75%)
   * @default undefined (percent 표시)
   */
  formatOptions?: Intl.NumberFormatOptions;
  /**
   * 값 레이블 표시 여부
   * @default true
   */
  showValueLabel?: boolean;
  /**
   * 커스텀 값 레이블 문자열 (없으면 value에서 자동 생성)
   */
  valueLabel?: string;
  /**
   * 커스텀 포맷터 함수
   */
  customFormatter?: (value: number) => string;
  /**
   * 레이블 위치
   * @default 'top'
   */
  labelPosition?: "top" | "side";
  /**
   * Show loading skeleton instead of meter
   * @default false
   */
  isLoading?: boolean;
}

/**
 * 🚀 Phase 4: data-* 패턴 전환
 * - tailwind-variants 제거
 * - data-variant, data-size 속성 사용
 */
export function Meter({
  label,
  variant = "informative",
  size = "md",
  locale = "ko-KR",
  formatOptions,
  showValueLabel = true,
  valueLabel,
  customFormatter,
  labelPosition = "top",
  isLoading,
  ...props
}: MeterProps) {
  if (isLoading) {
    return (
      <Skeleton
        componentVariant="meter"
        size={size}
        className={props.className as string}
        aria-label="Loading meter..."
      />
    );
  }
  // formatOptions 유효성 보정: currency/unit style에 필수값 없으면 decimal로 fallback
  const safeFormatOptions = (() => {
    if (!formatOptions) return undefined;
    if (formatOptions.style === "currency" && !formatOptions.currency) {
      return { ...formatOptions, style: "decimal" as const };
    }
    if (formatOptions.style === "unit" && !formatOptions.unit) {
      return { ...formatOptions, style: "decimal" as const };
    }
    return formatOptions;
  })();

  // 값 포맷팅 함수
  const formatValue = (value: number): string => {
    if (customFormatter) {
      return customFormatter(value);
    }

    if (safeFormatOptions) {
      return new Intl.NumberFormat(locale, safeFormatOptions).format(
        safeFormatOptions.style === "percent" ? value / 100 : value,
      );
    }

    // 기본: percent 표시
    return formatPercent(value / 100, locale, 0);
  };

  return (
    <AriaMeter
      {...props}
      formatOptions={safeFormatOptions}
      className={composeRenderProps(props.className, (className) =>
        className ? `react-aria-Meter ${className}` : "react-aria-Meter",
      )}
      data-variant={variant}
      data-size={size}
      data-label-position={labelPosition}
    >
      {({ percentage, valueText }) => (
        <>
          {label && <Label>{label}</Label>}
          {showValueLabel && (
            <span className="value">
              {valueLabel ??
                (props.value !== undefined
                  ? formatValue(props.value as number)
                  : valueText)}
            </span>
          )}
          <div className="bar">
            <div className="fill" style={{ width: percentage + "%" }} />
          </div>
        </>
      )}
    </AriaMeter>
  );
}

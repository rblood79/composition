/**
 * ProgressBar Component
 *
 * A visual indicator for showing progress of a task
 * Based on React Aria Components ProgressBar
 */

import {
  Label,
  ProgressBar as AriaProgressBar,
  ProgressBarProps as AriaProgressBarProps,
  composeRenderProps,
} from "react-aria-components";
import type { ComponentSizeSubset } from "../types";
import { formatPercent } from "../utils/core/numberUtils";
import { Skeleton } from "./Skeleton";

import "./styles/generated/ProgressBar.css";
// 수동 static-color 오버레이 — 고정 흑백(over background)은 catalog 토큰으로 표현 불가 (Button.css 선례).
import "./styles/ProgressBar.css";

export interface ProgressBarProps extends AriaProgressBarProps {
  label?: string;
  /**
   * Visual variant
   * @default 'default'
   */
  variant?: string;
  /**
   * Size of the progress bar
   * @default 'md'
   */
  size?: ComponentSizeSubset;
  /**
   * 로케일
   * @default 'ko-KR'
   */
  locale?: string;
  /**
   * Intl.NumberFormat 포맷 옵션
   * style: 'decimal' → 숫자만 표시 (75), 'percent' → 퍼센트 표시 (75%)
   * @default { style: 'percent' }
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
   * 레이블 위치
   * @default 'top'
   */
  labelPosition?: "top" | "side";
  /**
   * Show loading skeleton instead of progress bar
   * @default false
   */
  isLoading?: boolean;
  /**
   * RSP S2 "over background" — 유색/이미지 배경 위 고정 흑백 스킴.
   * track = static 25% wash / fill·label·value = solid static (Skia value_fill_bar 0.25 대칭).
   * @default 'auto'
   */
  staticColor?: "auto" | "white" | "black";
}

/**
 * 🚀 Phase 4: data-* 패턴 전환
 * - tailwind-variants 제거
 * - data-variant, data-size 속성 사용
 */
export function ProgressBar({
  label,
  variant = "default",
  size = "md",
  locale = "ko-KR",
  formatOptions,
  showValueLabel = true,
  valueLabel,
  labelPosition = "top",
  isLoading,
  isIndeterminate,
  staticColor,
  ...props
}: ProgressBarProps) {
  if (isLoading) {
    return (
      <Skeleton
        componentVariant="progress"
        size={size}
        className={props.className as string}
        aria-label="Loading progress bar..."
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

  // 값 포맷팅 함수 — safeFormatOptions 기반 Intl.NumberFormat 사용
  const formatValue = (value: number): string => {
    if (safeFormatOptions) {
      const v = safeFormatOptions.style === "percent" ? value / 100 : value;
      return new Intl.NumberFormat(locale, safeFormatOptions).format(v);
    }
    return formatPercent(value / 100, locale, 0);
  };

  // indeterminate 여부: prop 명시 또는 value가 undefined/null인 경우
  const isIndet = isIndeterminate ?? props.value == null;

  return (
    <AriaProgressBar
      {...props}
      isIndeterminate={isIndeterminate}
      formatOptions={safeFormatOptions}
      className={composeRenderProps(props.className, (className) =>
        className
          ? `react-aria-ProgressBar ${className}`
          : "react-aria-ProgressBar",
      )}
      data-variant={variant}
      data-size={size}
      data-label-position={labelPosition}
      data-indeterminate={isIndet ? "true" : undefined}
      data-static-color={
        staticColor === "white" || staticColor === "black"
          ? staticColor
          : undefined
      }
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
    </AriaProgressBar>
  );
}

import {
  Label,
  Slider as AriaSlider,
  SliderOutput,
  SliderProps as AriaSliderProps,
  SliderThumb,
  SliderTrack,
  composeRenderProps,
} from "react-aria-components";
import type { ComponentSizeSubset } from "../types";
import { formatNumber } from "../utils/core/numberUtils";
import { Skeleton } from "./Skeleton";

import "./styles/generated/Slider.css";

export interface SliderProps<T> extends AriaSliderProps<T> {
  label?: string;
  thumbLabels?: string[];
  /**
   * Emphasizes the slider with accent color (S2)
   * @default false
   */
  isEmphasized?: boolean;
  /**
   * Size of the slider
   * @default 'md'
   */
  size?: ComponentSizeSubset;
  /**
   * 로케일
   * @default 'ko-KR'
   */
  locale?: string;
  /**
   * Intl.NumberFormat 옵션으로 값 표시 형식 지정
   * @example { style: 'percent' }
   * @example { style: 'unit', unit: 'kilometer' }
   */
  formatOptions?: Intl.NumberFormatOptions;
  /**
   * 커스텀 포맷터 함수
   */
  customFormatter?: (value: number) => string;
  /**
   * Show loading skeleton instead of slider
   * @default false
   */
  isLoading?: boolean;
}

/**
 * S2 variant 전환: isEmphasized data-* 패턴
 * - data-emphasized: accent color 강조 (선택 시)
 * - data-size: 크기
 */
export function Slider<T extends number | number[]>({
  label,
  thumbLabels,
  isEmphasized = false,
  size = "md",
  locale = "ko-KR",
  formatOptions,
  customFormatter,
  isLoading,
  ...props
}: SliderProps<T>) {
  if (isLoading) {
    return (
      <Skeleton
        componentVariant="slider"
        size={size}
        className={props.className as string}
        aria-label="Loading slider..."
      />
    );
  }

  const sliderClassName = composeRenderProps(props.className, (className) =>
    className ? `react-aria-Slider ${className}` : "react-aria-Slider",
  );

  // 값 포맷팅 함수
  const formatValue = (value: number): string => {
    if (customFormatter) {
      return customFormatter(value);
    }

    if (formatOptions) {
      try {
        return new Intl.NumberFormat(locale, formatOptions).format(value);
      } catch {
        return formatNumber(value, locale);
      }
    }

    return formatNumber(value, locale);
  };

  return (
    <AriaSlider
      {...props}
      className={sliderClassName}
      data-emphasized={isEmphasized || undefined}
      data-size={size}
    >
      {label && <Label>{label}</Label>}
      <SliderOutput>
        {({ state }) =>
          state.values.map((value) => formatValue(value)).join(" – ")
        }
      </SliderOutput>
      <SliderTrack>
        {({ state, isDisabled }) => (
          <>
            {/* Track background */}
            <div
              className="slider-track-bg"
              data-disabled={isDisabled || undefined}
            />
            {/* Fill bar */}
            {state.values.length === 1 ? (
              <div
                className="slider-fill"
                style={{
                  width: `${state.getThumbPercent(0) * 100}%`,
                }}
                data-disabled={isDisabled || undefined}
              />
            ) : state.values.length >= 2 ? (
              <div
                className="slider-fill"
                style={{
                  left: `${state.getThumbPercent(0) * 100}%`,
                  width: `${(state.getThumbPercent(1) - state.getThumbPercent(0)) * 100}%`,
                }}
                data-disabled={isDisabled || undefined}
              />
            ) : null}
            {/* Thumbs */}
            {state.values.map((_, i) => (
              <SliderThumb key={i} index={i} aria-label={thumbLabels?.[i]} />
            ))}
          </>
        )}
      </SliderTrack>
    </AriaSlider>
  );
}

import { renderFieldLabel } from "./FieldNecessityIndicator";
import {
  Slider as AriaSlider,
  SliderFill,
  SliderOutput,
  SliderProps as AriaSliderProps,
  SliderThumb,
  SliderTrack,
} from "react-aria-components/Slider";
import { composeRenderProps } from "react-aria-components/composeRenderProps";
import type { ComponentSizeSubset } from "../types";
import { formatNumber } from "../utils/core/numberUtils";
import { Skeleton } from "./Skeleton";

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
   * 값 라벨(SliderOutput) 표시 여부 (RSP showValueLabel).
   * false 면 값 라벨을 숨긴다 — Skia(buildSpecNodeData:800)/layout(utils:2608) 과 대칭.
   * @default true
   */
  showValueLabel?: boolean;
  /**
   * 라벨 위치 (RSP Slider labelPosition 레퍼런스).
   * - "top": Label · Value 상단, Track 하단 (grid 기본)
   * - "side": Label · Track · Value 가로 배치 (flex-row)
   * data-label-position 로 emit → generated Slider.css `[data-label-position="side"]` 소비.
   * @default 'top'
   */
  labelPosition?: "top" | "side";
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
  showValueLabel = true,
  labelPosition = "top",
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
      data-label-position={labelPosition}
    >
      {renderFieldLabel(label)}
      {showValueLabel && (
        <SliderOutput>
          {({ state }) =>
            state.values.map((value) => formatValue(value)).join(" – ")
          }
        </SliderOutput>
      )}
      {/* The Slider size reaches the track box (generated `SliderTrack.css` size blocks). */}
      <SliderTrack data-size={size}>
        {({ state, isDisabled }) => (
          <>
            {/* ADR-256 Phase 7c: the track is its own bar (SliderTrack rule); the fill is RAC's
                SliderFill — from the start, or between a range's thumbs. */}
            <SliderFill data-disabled={isDisabled || undefined} />
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

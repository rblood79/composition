import React from "react";
import {
  Slider as AriaSlider,
  SliderTrack,
  SliderThumb,
  SliderOutput,
} from "react-aria-components/Slider";
import { iconProps } from "../../../utils/ui/uiConstants";
import {
  semanticLabelKeys,
  translateKey,
  useOptionalI18n,
} from "../../../i18n";

interface PropertySliderProps {
  label: string;
  value: number;
  /** 드래그 중 매 값 (연속 입력 — 호출측이 preview 경로로 보낸다). */
  onChange: (value: number) => void;
  /** 드래그 종료 · 키보드 입력 후 최종 값 (commit 경로). 없으면 onChange 만. */
  onChangeEnd?: (value: number) => void;
  /** 출력 텍스트. 기본 `${value}%`. */
  formatValue?: (value: number) => string;
  min?: number;
  max?: number;
  step?: number;
  icon?: React.ComponentType<{
    color?: string;
    size?: number;
    strokeWidth?: number;
  }>;
  className?: string;
}

export function PropertySlider({
  label,
  value,
  onChange,
  onChangeEnd,
  formatValue,
  min = 0,
  max = 100,
  step = 1,
  icon: Icon,
  className,
}: PropertySliderProps) {
  const i18n = useOptionalI18n();
  const displayLabel = i18n
    ? translateKey(i18n.t, semanticLabelKeys[label] ?? label, label)
    : label;
  const toSingle = (newValue: number | number[]): number =>
    Array.isArray(newValue) ? newValue[0] : newValue;
  const handleChange = (newValue: number | number[]) => {
    onChange(toSingle(newValue));
  };
  const handleChangeEnd = onChangeEnd
    ? (newValue: number | number[]) => onChangeEnd(toSingle(newValue))
    : undefined;

  return (
    <fieldset className={`properties-aria ${className || ""}`}>
      <legend className="fieldset-legend">{displayLabel}</legend>
      <div className="react-aria-control react-aria-Group">
        {Icon && (
          <label className="control-label">
            <Icon
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
          </label>
        )}
        <AriaSlider
          className="react-aria-Slider"
          value={value}
          onChange={handleChange}
          onChangeEnd={handleChangeEnd}
          minValue={min}
          maxValue={max}
          step={step}
          aria-label={displayLabel}
        >
          <div className="slider-container">
            <SliderTrack className="slider-track">
              <SliderThumb className="slider-thumb" />
            </SliderTrack>
            <SliderOutput className="slider-output">
              {formatValue ? formatValue(value) : `${value}%`}
            </SliderOutput>
          </div>
        </AriaSlider>
      </div>
    </fieldset>
  );
}

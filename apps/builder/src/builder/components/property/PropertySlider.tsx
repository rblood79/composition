import React from "react";
import {
  Slider as AriaSlider,
  SliderTrack,
  SliderThumb,
  SliderOutput,
} from "react-aria-components";
import { iconProps } from "../../../utils/ui/uiConstants";
import {
  semanticLabelKeys,
  translateKey,
  useOptionalI18n,
} from "../../../i18n";

interface PropertySliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
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
  const handleChange = (newValue: number | number[]) => {
    const singleValue = Array.isArray(newValue) ? newValue[0] : newValue;
    onChange(singleValue);
  };

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
          minValue={min}
          maxValue={max}
          step={step}
          aria-label={displayLabel}
        >
          <div className="slider-container">
            <SliderTrack className="slider-track">
              <SliderThumb className="slider-thumb" />
            </SliderTrack>
            <SliderOutput className="slider-output">{value}%</SliderOutput>
          </div>
        </AriaSlider>
      </div>
    </fieldset>
  );
}

import { createContext, forwardRef, useContext } from "react";
import {
  Slider,
  SliderContext,
  SliderThumb as RacSliderThumb,
  SliderOutput,
  SliderTrack,
  SliderFill,
  type SliderProps,
  type SliderThumbProps,
} from "react-aria-components/Slider";
import { Label } from "react-aria-components/Label";
import { useSlottedContext } from "react-aria-components";
import { rangeSegmentsDefaultChildren } from "./rangeSegmentsDefaults";
import { RANGE_SEGMENT_DEFINITIONS } from "../catalog/document/rangeSegmentsOrigins";
import {
  catalogRangeValue,
  catalogRangeValueFromThumbs,
  type CatalogRangeValue,
} from "../catalog/runtime/rangeSliderValue";

export interface RangeSliderProps extends Omit<
  SliderProps<number[]>,
  "value" | "defaultValue" | "onChange" | "onChangeEnd"
> {
  value?: CatalogRangeValue;
  defaultValue?: CatalogRangeValue;
  onChange?: (value: CatalogRangeValue) => void;
  onChangeEnd?: (value: CatalogRangeValue) => void;
  startName?: string;
  endName?: string;
  form?: string;
  size?: "S" | "M" | "L" | "XL";
  labelPosition?: "top" | "side";
  labelAlign?: "start" | "end";
  isEmphasized?: boolean;
  trackStyle?: "thin" | "thick";
  thumbStyle?: "default" | "precise";
  label?: string;
}

const RangeNames = createContext<Pick<
  RangeSliderProps,
  "startName" | "endName" | "form"
> | null>(null);
/** RAC owns two-thumb keyboard/drag behavior; the public value is S2's RangeValue. */
export const RangeSlider = forwardRef<HTMLDivElement, RangeSliderProps>(
  function RangeSlider(
    {
      value,
      defaultValue,
      onChange,
      onChangeEnd,
      startName,
      endName,
      form,
      size = "M",
      labelPosition = "top",
      labelAlign = "start",
      isEmphasized,
      trackStyle = "thin",
      thumbStyle = "default",
      label,
      ...props
    },
    ref,
  ) {
    const slotProps = useSlottedContext(SliderContext, props.slot);
    const fallback =
      defaultValue ??
      (slotProps?.defaultValue === undefined
        ? catalogRangeValue(
            RANGE_SEGMENT_DEFINITIONS.find(
              (definition) => definition.name === "RangeSlider",
            )!.defaults.value,
            props.minValue,
            props.maxValue,
            props.step,
          )
        : undefined);
    return (
      <RangeNames.Provider value={{ startName, endName, form }}>
        <Slider
          {...props}
          ref={ref}
          className={
            props.className ?? "react-aria-Slider react-aria-RangeSlider"
          }
          data-size={size}
          data-label-position={labelPosition}
          data-label-align={labelAlign}
          data-emphasized={isEmphasized || undefined}
          data-track-style={trackStyle}
          data-thumb-style={thumbStyle}
          aria-label={
            props["aria-label"] ??
            slotProps?.["aria-label"] ??
            ((props["aria-labelledby"] ?? slotProps?.["aria-labelledby"]) ||
            label !== ""
              ? undefined
              : "Range Slider")
          }
          value={value ? [value.start, value.end] : undefined}
          defaultValue={fallback ? [fallback.start, fallback.end] : undefined}
          onChange={(value) => onChange?.(catalogRangeValueFromThumbs(value))}
          onChangeEnd={(value) =>
            onChangeEnd?.(catalogRangeValueFromThumbs(value))
          }
        >
          {props.children ??
            rangeSegmentsDefaultChildren(
              "RangeSlider",
              { Label, SliderOutput, SliderTrack, SliderFill, SliderThumb },
              label === undefined ? {} : { label },
            )}
        </Slider>
      </RangeNames.Provider>
    );
  },
);

/** Exported Code View and Preview share the same form-name context for authored thumb nodes. */
export const SliderThumb = forwardRef<HTMLDivElement, SliderThumbProps>(
  function SliderThumb(props, ref) {
    const owner = useContext(RangeNames);
    return (
      <RacSliderThumb
        {...props}
        ref={ref}
        name={
          props.name ?? (props.index === 1 ? owner?.endName : owner?.startName)
        }
        form={props.form ?? owner?.form}
        aria-label={
          props["aria-label"] ??
          (owner ? (props.index === 1 ? "Maximum" : "Minimum") : undefined)
        }
      />
    );
  },
);
